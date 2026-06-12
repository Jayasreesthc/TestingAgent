from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from datetime import datetime, timedelta

router = APIRouter(prefix="/appointments", tags=["Appointments"])

# 1. Manage Availability (Doctors/Receptionists)
@router.post("/availability", response_model=schemas.AvailabilityOut)
async def create_availability(
    slot: schemas.AvailabilityCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    # Logic: Doctors create for themselves, Receptionists/Admins can create for any doctor in their org
    target_doctor_id = slot.doctor_id
    org_id = slot.organization_id or current_user.organization_id

    if current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")
    elif current_user.role == models.UserRole.RECEPTIONIST:

        # Load receptionist profile
        rec_res = await db.execute(
            select(models.Receptionist).where(
                models.Receptionist.id == current_user.id
            )
        )
        receptionist_profile = rec_res.scalars().first()

        if not receptionist_profile:
            raise HTTPException(status_code=403, detail="Receptionist profile not found")

        # 🔒 Restrict to assigned doctor only
        if receptionist_profile.doctor_id != target_doctor_id:
            raise HTTPException(
                status_code=403,
                detail="Not allowed to manage this doctor's availability"
            )

        # Also verify doctor exists in same org
        doc_res = await db.execute(
            select(models.User).where(
                models.User.id == target_doctor_id,
                models.User.role == models.UserRole.DOCTOR,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")


    elif current_user.role == models.UserRole.HOSPITAL:
        # Hospital can manage any doctor in org
        doc_res = await db.execute(
            select(models.User).where(
                models.User.id == target_doctor_id,
                models.User.role == models.UserRole.DOCTOR,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    new_slot = models.Availability(
        doctor_id=target_doctor_id,
        organization_id=org_id,
        start_time=slot.start_time,
        end_time=slot.end_time,
        is_booked=False
    )
    db.add(new_slot)
    await db.commit()
    await db.refresh(new_slot)
    return new_slot

@router.post("/availability/batch", response_model=List[schemas.AvailabilityOut])
async def batch_create_availability(
    batch: schemas.AvailabilityBatchCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    # Verify permission (same as single create)
    target_doctor_id = batch.doctor_id
    org_id = batch.organization_id or current_user.organization_id

    if current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")
    elif current_user.role in [models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL]:
        doc_res = await db.execute(select(models.User).where(models.User.id == target_doctor_id, models.User.organization_id == org_id))
        if not doc_res.scalars().first():
             raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    # Generate slots
    slots = []
    current_time = batch.start_time
    while current_time + timedelta(minutes=batch.duration_minutes) <= batch.end_time:
        slot_end = current_time + timedelta(minutes=batch.duration_minutes)
        new_slot = models.Availability(
            doctor_id=target_doctor_id,
            organization_id=org_id,
            start_time=current_time,
            end_time=slot_end,
            is_booked=False
        )
        db.add(new_slot) # Add to session
        slots.append(new_slot)
        current_time = slot_end
    
    await db.commit()
    # No need to refresh all if we just want to return them, but IDs won't be populated until commit. 
    # SQLAlchemy asyncpg might not populate IDs on objects automatically after commit without refresh or returning.
    # We can re-query or iterate refresh.
    for slot in slots:
        await db.refresh(slot)
        
    return slots

@router.get("/availability", response_model=List[schemas.AvailabilityOut])
async def get_availability(
    doctor_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    only_available: bool = True,
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Availability)
    if doctor_id:
        query = query.where(models.Availability.doctor_id == doctor_id)
    if organization_id:
        query = query.where(models.Availability.organization_id == organization_id)
    if start_date:
        query = query.where(models.Availability.start_time >= start_date)
    if end_date:
        query = query.where(models.Availability.start_time <= end_date)
    if only_available:
        query = query.where(models.Availability.is_booked == False)
    
    result = await db.execute(query)
    return result.scalars().all()

# 2. Booking Logic
@router.post("/book", response_model=schemas.AppointmentOut)
async def book_appointment(
    booking: schemas.AppointmentCreate,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    # 1. Verify slot exists and is not booked
    slot_res = await db.execute(select(models.Availability).where(models.Availability.id == booking.availability_id))
    slot = slot_res.scalars().first()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot is already booked")

    # 2. Create Appointment
    # In a real app, generate a unique Zoom/Meet link here
    meet_link = f"https://meet.psychegraph.com/{booking.availability_id}-{booking.patient_id}"
    
    new_app = models.Appointment(
        patient_id=booking.patient_id,
        doctor_id=slot.doctor_id,
        organization_id=slot.organization_id,
        start_time=slot.start_time,
        end_time=slot.end_time,
        notes=booking.notes,
        meet_link=meet_link,
        status="SCHEDULED"
    )
    
    # 3. Mark slot as booked
    slot.is_booked = True
    
    db.add(new_app)
    await db.commit()
    await db.refresh(new_app)
    return new_app

# 3. Cancellation / Slot Removal Logic
@router.delete("/availability/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability_slot(
    slot_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    slot_res = await db.execute(select(models.Availability).where(models.Availability.id == slot_id))
    slot = slot_res.scalars().first()
    
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Check permission
    if current_user.role == models.UserRole.DOCTOR and slot.doctor_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role in [models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL] and slot.organization_id != current_user.organization_id:
         raise HTTPException(status_code=403, detail="Not authorized")

    # If booked, find and cancel appointment
    if slot.is_booked:
        app_res = await db.execute(
            select(models.Appointment).where(
                models.Appointment.doctor_id == slot.doctor_id,
                models.Appointment.start_time == slot.start_time,
                models.Appointment.status == "SCHEDULED"
            )
        )
        appointment = app_res.scalars().first()
        if appointment:
            appointment.status = "CANCELLED"
            appointment.notes = (appointment.notes or "") + " [CANCELLED: Doctor Unavailable]"
            # Logic for "sending message" placeholder
            print(f"NOTIFICATION: Appointment {appointment.id} for Patient {appointment.patient_id} has been CANCELLED.")

    await db.delete(slot)
    await db.commit()
    return None

@router.get("", response_model=List[schemas.AppointmentOut])
async def get_appointments(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Appointment)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Appointment.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Appointment.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Appointment.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    result = await db.execute(query)
    return result.scalars().all()
