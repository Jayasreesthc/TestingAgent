from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from datetime import date, datetime, timedelta
import logging

logger = logging.getLogger("doctor_schedule")

router = APIRouter(prefix="/doctors", tags=["Doctor Schedule"])


# -------------------------------------------------------------------
# Schemas (add these to schemas.py too — see below)
# -------------------------------------------------------------------

@router.get("/{doctor_user_id}/schedule", response_model=List[schemas.DoctorScheduleOut])
async def get_doctor_schedule(
    doctor_user_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    # Fetch doctor profile row from user_id
    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    result = await db.execute(
        select(models.DoctorSchedule)
        .where(models.DoctorSchedule.doctor_id == doctor.id)
        .order_by(models.DoctorSchedule.id)
    )
    return result.scalars().all()


@router.put("/{doctor_user_id}/schedule", response_model=List[schemas.DoctorScheduleOut])
async def update_doctor_schedule(
    doctor_user_id: int,
    schedule_update: schemas.DoctorScheduleUpdate,
    current_user: models.User = Depends(dependencies.require_role(
        [models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN],
        detail="Doctors are not allowed to update schedules. Only Hospital Admins can manage doctor schedules."
    )),
    db: AsyncSession = Depends(database.get_db)
):
    # Hospital admin can only edit doctors in their org
    if current_user.role == models.UserRole.HOSPITAL:
        user_res = await db.execute(
            select(models.User).where(
                models.User.id == doctor_user_id,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not user_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    for day_name, day_data in schedule_update.model_dump(exclude_unset=True).items():
        if day_data is None:
            continue
        sched_res = await db.execute(
            select(models.DoctorSchedule).where(
                models.DoctorSchedule.doctor_id == doctor.id,
                models.DoctorSchedule.day == day_name
            )
        )
        row = sched_res.scalars().first()
        if row:
            for field, value in day_data.items():
                setattr(row, field, value)

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"update_doctor_schedule failed for doctor_user_id={doctor_user_id}: {e}")
        raise HTTPException(status_code=500, detail="Schedule update failed. Please try again.")

    result = await db.execute(
        select(models.DoctorSchedule)
        .where(models.DoctorSchedule.doctor_id == doctor.id)
        .order_by(models.DoctorSchedule.id)
    )
    return result.scalars().all()

@router.post("/{doctor_user_id}/availability/generate", response_model=List[schemas.AvailabilityOut])
async def generate_availability_from_schedule(
    doctor_user_id: int,
    request: schemas.GenerateAvailabilityRequest,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    # --- Authorization ---
    if current_user.role == models.UserRole.DOCTOR:
        if current_user.id != doctor_user_id:
            raise HTTPException(status_code=403, detail="Doctors can only generate their own availability")

    if current_user.role == models.UserRole.RECEPTIONIST:
        from sqlalchemy.orm import selectinload
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        rec = rec_res.scalars().first()
        if not rec or doctor_user_id not in [d.user_id for d in rec.doctors]:
            raise HTTPException(status_code=403, detail="You are not assigned to this doctor")

    if current_user.role == models.UserRole.HOSPITAL:
        user_res = await db.execute(
            select(models.User).where(
                models.User.id == doctor_user_id,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not user_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    # --- Fetch doctor ---
    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # --- Fetch doctor's org ---
    user_res = await db.execute(
        select(models.User).where(models.User.id == doctor_user_id)
    )
    doctor_user = user_res.scalars().first()
    org_id = doctor_user.organization_id

    # --- Helper: parse "HH:MM" into a datetime on the given date ---
    def to_dt(d: date, time_str: str) -> datetime:
        h, m = map(int, time_str.split(":"))
        return datetime(d.year, d.month, d.day, h, m, 0)

    duration = timedelta(minutes=request.duration_minutes)

    # --- Fetch all existing slots for the entire range (one query) ---
    range_start = datetime(request.start_date.year, request.start_date.month, request.start_date.day, 0, 0, 0)
    range_end   = datetime(request.end_date.year,   request.end_date.month,   request.end_date.day,   23, 59, 59)

    existing_res = await db.execute(
        select(models.Availability.start_time).where(
            models.Availability.doctor_id == doctor_user_id,
            models.Availability.start_time >= range_start,
            models.Availability.start_time <= range_end,
        )
    )
    existing_starts = {row[0].replace(tzinfo=None) for row in existing_res.fetchall()}

    # --- Loop through each date in range ---
    new_slots = []
    skipped_days = []

    current_date = request.start_date
    while current_date <= request.end_date:
        day_name = current_date.strftime("%A").lower()

        # Fetch schedule for this day
        sched_res = await db.execute(
            select(models.DoctorSchedule).where(
                models.DoctorSchedule.doctor_id == doctor.id,
                models.DoctorSchedule.day == day_name
            )
        )
        schedule = sched_res.scalars().first()

        if not schedule or not schedule.is_enabled:
            skipped_days.append(str(current_date))
            current_date += timedelta(days=1)
            continue

        # Build shifts for this day
        shifts = []
        if schedule.start_time_1 and schedule.end_time_1:
            shifts.append((to_dt(current_date, schedule.start_time_1), to_dt(current_date, schedule.end_time_1)))
        if schedule.start_time_2 and schedule.end_time_2:
            shifts.append((to_dt(current_date, schedule.start_time_2), to_dt(current_date, schedule.end_time_2)))

        if not shifts:
            skipped_days.append(str(current_date))
            current_date += timedelta(days=1)
            continue

        # Generate slots for this day
        for shift_start, shift_end in shifts:
            current_slot = shift_start
            while current_slot + duration <= shift_end:
                slot_end = current_slot + duration
                if current_slot not in existing_starts:
                    db.add(models.Availability(
                        doctor_id=doctor_user_id,
                        organization_id=org_id,
                        start_time=current_slot,
                        end_time=slot_end,
                        is_booked=False,
                        created_by_id=current_user.id
                    ))
                    new_slots.append(current_slot)
                current_slot = slot_end

        current_date += timedelta(days=1)

    if not new_slots:
        raise HTTPException(
            status_code=400,
            detail="All slots in this range already exist or doctor has no enabled schedule days"
        )

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"generate_availability failed for doctor_user_id={doctor_user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate availability slots.")

    # --- Return all slots for the entire range ---
    result = await db.execute(
        select(models.Availability)
        .where(
            models.Availability.doctor_id == doctor_user_id,
            models.Availability.start_time >= range_start,
            models.Availability.start_time <= range_end,
        )
        .order_by(models.Availability.start_time)
    )
    return result.scalars().all()

@router.get("/{doctor_user_id}/fee", response_model=schemas.DoctorFeeOut)
async def get_doctor_fee(
    doctor_user_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return schemas.DoctorFeeOut(doctor_user_id=doctor_user_id, fee=doctor.fee)


@router.post("/{doctor_user_id}/fee", response_model=schemas.DoctorFeeOut)
async def set_doctor_fee(
    doctor_user_id: int,
    body: schemas.DoctorFeeUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role == models.UserRole.DOCTOR and current_user.id != doctor_user_id:
        raise HTTPException(status_code=403, detail="Doctors can only set their own fee")

    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.fee = body.fee
    await db.commit()
    return schemas.DoctorFeeOut(doctor_user_id=doctor_user_id, fee=doctor.fee)


@router.put("/{doctor_user_id}/fee", response_model=schemas.DoctorFeeOut)
async def update_doctor_fee(
    doctor_user_id: int,
    body: schemas.DoctorFeeUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role == models.UserRole.DOCTOR and current_user.id != doctor_user_id:
        raise HTTPException(status_code=403, detail="Doctors can only update their own fee")

    doc_res = await db.execute(
        select(models.Doctor).where(models.Doctor.user_id == doctor_user_id)
    )
    doctor = doc_res.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.fee = body.fee
    await db.commit()
    return schemas.DoctorFeeOut(doctor_user_id=doctor_user_id, fee=doctor.fee)