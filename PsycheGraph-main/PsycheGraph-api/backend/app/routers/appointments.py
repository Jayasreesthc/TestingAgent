from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, dependencies, database
from ..database import AsyncSessionLocal
from sqlalchemy import text
from datetime import datetime, timedelta, timezone, time, date
from ..services.google_calendar import GoogleCalendarService
from ..services.email import send_meet_link_email, send_reschedule_email
from ..services.fireflies import send_bot_to_meeting as ff_send_bot
from apscheduler.schedulers.background import BackgroundScheduler
import asyncio
import traceback
import psycopg2
import os
import threading
import logging
from concurrent.futures import ThreadPoolExecutor

scheduler = BackgroundScheduler()
scheduler.start()

logger = logging.getLogger("appointments")

executor = ThreadPoolExecutor()

IST = timezone(timedelta(hours=5, minutes=30))

_calendar_service = None

def get_calendar_service():
    global _calendar_service
    if _calendar_service is None:
        try:
            _calendar_service = GoogleCalendarService()
            logger.info("[GOOGLE] Calendar service initialized successfully")
        except Exception as e:
            logger.warning(f"Google Calendar not available: {e}")
            return None
    return _calendar_service


router = APIRouter(prefix="/appointments", tags=["Appointments"])


def save_meet_link_sync(appointment_id: int, meet_link: str):
    """Pure sync function to save meet link — runs in a thread, no event loop needed."""
    try:
        database_url = os.getenv("DATABASE_URL")
        
        if database_url:
            # Parse from DATABASE_URL if available e.g. postgresql://user:pass@host:port/db
            import urllib.parse
            parsed = urllib.parse.urlparse(database_url)
            conn = psycopg2.connect(
                host=parsed.hostname,
                port=parsed.port or 5432,
                database=parsed.path.lstrip("/"),
                user=parsed.username,
                password=parsed.password
            )
        else:
            # Fall back to individual env vars
            conn = psycopg2.connect(
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", 5432)),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD")
            )

        cur = conn.cursor()
        cur.execute("UPDATE appointments SET meet_link = %s WHERE id = %s", (meet_link, appointment_id))
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"[MEET LINK] Saved for appointment {appointment_id}: {meet_link}")
    except Exception as e:
        logger.error(f"[MEET LINK] Failed to save for appointment {appointment_id}: {e}")
        logger.error(traceback.format_exc())


def generate_meet_link_sync(
    appointment_id: int,
    summary: str,
    start_time_utc: datetime,
    end_time_utc: datetime,
    patient_email: Optional[str],
    doctor_email: Optional[str],
    patient_name: str,
    doctor_name: str,
    appointment_date: str,
    start_time_str: str,
    end_time_str: str,
    appointment_start_utc: datetime,
):
    """
    Fully synchronous background function — runs in a thread.
    1. Creates Google Meet link
    2. Saves to DB
    3. Sends Fireflies bot to transcribe
    4. Sends email reminders
    """
    print(f"[MEET LINK] Starting for appointment {appointment_id}")

    # Step 1: Generate meet link
    meet_link = None
    try:
        service = get_calendar_service()
        if service:
            meet_link = service.create_event(
                summary=summary,
                start_time=start_time_utc,
                end_time=end_time_utc,
                attendee_email=None
            )
    except Exception as e:
        logger.error(f"[MEET LINK] Failed to save for appointment {appointment_id}: {e}")
        logger.error(traceback.format_exc())

    if not meet_link:
        logger.error(f"[MEET LINK] No link generated for appointment {appointment_id}")
        return

    # Step 2: Save meet link to DB
    save_meet_link_sync(appointment_id, meet_link)

    # Step 3: Send Fireflies bot to transcribe the meeting
    try:
        success = ff_send_bot(meet_link=meet_link, title=summary)
        if success:
            logger.info(f"[FIREFLIES] Bot sent to meeting for appointment {appointment_id}: {meet_link}")
        else:
            logger.error(f"[FIREFLIES] Bot could not be sent for appointment {appointment_id} (non-fatal)")
    except Exception as e:
        logger.error(f"[FIREFLIES] Error sending bot for appointment {appointment_id}: {e}")

    # Step 4: Send email reminders
    def send_emails():
        try:
            if patient_email:
                send_meet_link_email(
                    to_email=patient_email,
                    recipient_name=patient_name,
                    doctor_name=doctor_name,
                    appointment_date=appointment_date,
                    start_time=start_time_str,
                    end_time=end_time_str,
                    meet_link=meet_link
                )
            if doctor_email:
                send_meet_link_email(
                    to_email=doctor_email,
                    recipient_name=f"Dr. {doctor_name}",
                    doctor_name=doctor_name,
                    appointment_date=appointment_date,
                    start_time=start_time_str,
                    end_time=end_time_str,
                    meet_link=meet_link
                )
        except Exception as e:
            logger.error(f"[MEET EMAIL] Failed for appointment {appointment_id}: {e}")

    send_at = appointment_start_utc - timedelta(minutes=30)
    now = datetime.now(timezone.utc)

    if send_at <= now:
        send_emails()
    else:
        scheduler.add_job(
            func=send_emails,
            trigger='date',
            run_date=send_at,
            id=f"email_appointment_{appointment_id}",
            replace_existing=True
        )
        logger.info(f"[MEET EMAIL] Scheduled for appointment {appointment_id} at {send_at} UTC")


# -------------------------------------------------------------------
# DEBUG — Test meet link generation directly
# -------------------------------------------------------------------

@router.get("/test-meet-link")
async def test_meet_link():
    from ..services.google_calendar import TOKEN_PATH, CREDENTIALS_PATH

    results = {}
    results["token_path"] = TOKEN_PATH
    results["credentials_path"] = CREDENTIALS_PATH
    results["token_exists"] = os.path.exists(TOKEN_PATH)
    results["credentials_exists"] = os.path.exists(CREDENTIALS_PATH)

    if not results["token_exists"]:
        return {"status": "failed", "reason": "token.json not found at the path above", **results}

    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        creds = Credentials.from_authorized_user_file(
            TOKEN_PATH, ['https://www.googleapis.com/auth/calendar']
        )
        results["creds_valid"] = creds.valid
        results["creds_expired"] = creds.expired
        results["has_refresh_token"] = bool(creds.refresh_token)

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            results["refresh_attempted"] = True
            results["creds_valid_after_refresh"] = creds.valid
    except Exception as e:
        return {
            "status": "failed",
            "reason": f"credentials error: {str(e)}",
            "traceback": traceback.format_exc(),
            **results
        }

    try:
        service = get_calendar_service()
        if not service:
            return {"status": "failed", "reason": "GoogleCalendarService returned None", **results}

        start = datetime.now(timezone.utc) + timedelta(hours=1)
        end = start + timedelta(minutes=30)
        link = service.create_event("Test Meeting", start, end)
        results["meet_link"] = link
        return {
            "status": "ok" if link else "failed — event created but no hangoutLink in response",
            **results
        }
    except Exception as e:
        return {
            "status": "failed",
            "reason": f"create_event error: {str(e)}",
            "traceback": traceback.format_exc(),
            **results
        }


# -------------------------------------------------------------------
# 1. Manage Availability
# -------------------------------------------------------------------

@router.post("/availability", response_model=schemas.AvailabilityOut)
async def create_availability(
    slot: schemas.AvailabilityCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    target_doctor_id = slot.doctor_id
    org_id = slot.organization_id or current_user.organization_id

    if slot.start_time.tzinfo:
        start_naive = slot.start_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        start_naive = slot.start_time.replace(microsecond=0)

    if slot.end_time.tzinfo:
        end_naive = slot.end_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        end_naive = slot.end_time.replace(microsecond=0)

    if current_user.role == models.UserRole.RECEPTIONIST:
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        receptionist_profile = rec_res.scalars().first()
        if not receptionist_profile:
            raise HTTPException(status_code=403, detail="Receptionist profile not found")
        assigned_user_ids = [d.user_id for d in receptionist_profile.doctors]
        if target_doctor_id not in assigned_user_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this doctor")

    elif current_user.role == models.UserRole.HOSPITAL:
        doc_res = await db.execute(
            select(models.Doctor)
            .join(models.User, models.User.id == models.Doctor.user_id)
            .where(
                models.Doctor.user_id == target_doctor_id,
                models.User.organization_id == current_user.organization_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    elif current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")

    new_slot = models.Availability(
        doctor_id=target_doctor_id,
        organization_id=org_id,
        start_time=start_naive,
        end_time=end_naive,
        is_booked=False,
        created_by_id=current_user.id
    )
    db.add(new_slot)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"create_availability commit failed for doctor_id={target_doctor_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create availability slot.")

    res = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(models.Availability.id == new_slot.id)
    )
    return res.scalars().first()


@router.post("/availability/batch", response_model=List[schemas.AvailabilityOut])
async def batch_create_availability(
    batch: schemas.AvailabilityBatchCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    target_doctor_id = batch.doctor_id
    org_id = batch.organization_id or current_user.organization_id

    if current_user.role == models.UserRole.DOCTOR:
        if target_doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Doctors can only manage their own availability")

    elif current_user.role == models.UserRole.RECEPTIONIST:
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        receptionist_profile = rec_res.scalars().first()
        if not receptionist_profile:
            raise HTTPException(status_code=403, detail="Receptionist profile not found")
        assigned_user_ids = [d.user_id for d in receptionist_profile.doctors]
        if target_doctor_id not in assigned_user_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this doctor")

    elif current_user.role == models.UserRole.HOSPITAL:
        doc_res = await db.execute(
            select(models.Doctor)
            .join(models.User, models.User.id == models.Doctor.user_id)
            .where(
                models.Doctor.user_id == target_doctor_id,
                models.User.organization_id == org_id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=403, detail="Doctor not found in your organization")

    slots = []

    if batch.start_time.tzinfo:
        current_time = batch.start_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        current_time = batch.start_time.replace(microsecond=0)

    if batch.end_time.tzinfo:
        batch_end_time = batch.end_time.astimezone(IST).replace(tzinfo=None, microsecond=0)
    else:
        batch_end_time = batch.end_time.replace(microsecond=0)

    while current_time and batch_end_time and current_time + timedelta(minutes=batch.duration_minutes) <= batch_end_time:
        slot_end = current_time + timedelta(minutes=batch.duration_minutes)
        new_slot = models.Availability(
            doctor_id=target_doctor_id,
            organization_id=org_id,
            start_time=current_time,
            end_time=slot_end,
            is_booked=False,
            created_by_id=current_user.id
        )
        db.add(new_slot)
        slots.append(new_slot)
        current_time = slot_end

    if not slots:
        raise HTTPException(status_code=400, detail="No slots generated — check start/end time and duration")

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"batch_create_availability commit failed for doctor_id={target_doctor_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create availability slots.")

    result = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(
            models.Availability.doctor_id == target_doctor_id,
            models.Availability.organization_id == org_id,
            models.Availability.start_time >= slots[0].start_time,
            models.Availability.start_time <= slots[-1].start_time
        )
        .order_by(models.Availability.start_time)
    )
    return result.scalars().all()


@router.get("/availability", response_model=List[schemas.AvailabilityOut])
async def get_availability(
    doctor_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    only_available: bool = True,
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Availability).options(selectinload(models.Availability.doctor))
    if doctor_id:
        query = query.where(models.Availability.doctor_id == doctor_id)
    if organization_id:
        query = query.where(models.Availability.organization_id == organization_id)
    if start_date:
        query = query.where(models.Availability.start_time >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(models.Availability.start_time <= datetime.combine(end_date, time.max))
    if only_available:
        query = query.where(models.Availability.is_booked == False)

    result = await db.execute(query)
    return result.scalars().all()


# -------------------------------------------------------------------
# 2. Booking
# -------------------------------------------------------------------

@router.post("/book", response_model=schemas.AppointmentOut)
async def book_appointment(
    booking: schemas.AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    slot_res = await db.execute(
        select(models.Availability)
        .options(selectinload(models.Availability.doctor))
        .where(models.Availability.id == booking.availability_id)
    )
    slot = slot_res.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    if slot.is_booked:
        raise HTTPException(status_code=400, detail="Slot is already booked")
    if not slot.doctor_id:
        raise HTTPException(status_code=400, detail="Slot has no doctor assigned")

    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == booking.patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.is_active:
        raise HTTPException(status_code=400, detail="Cannot book appointment for a discharged/inactive patient")

    doctor_user = slot.doctor

    new_app = models.Appointment(
        patient_id=booking.patient_id,
        doctor_id=slot.doctor_id,
        organization_id=slot.organization_id,
        availability_id=slot.id,
        appointment_date=slot.start_time,
        start_time=slot.start_time,
        end_time=slot.end_time,
        notes=booking.notes,
        booking_type=booking.booking_type,
        meet_link=None,
        patient_name=patient.full_name,
        patient_age=patient.age,
        doctor_name=slot.doctor.full_name if slot.doctor else None,
        booked_by_role=current_user.role.value,
        fee=booking.fee,
        created_by_id=current_user.id
    )

    patient.doctor_id = slot.doctor_id
    slot.is_booked = True
    db.add(new_app)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"book_appointment commit failed for slot {booking.availability_id}: {e}")
        raise HTTPException(status_code=500, detail="Booking failed. Please try again.")

    doctor_email = doctor_user.email if (doctor_user and doctor_user.role == models.UserRole.DOCTOR) else None

# Only generate meet link for online appointments
    if booking.booking_type == "online":
        doctor_email = doctor_user.email if (doctor_user and doctor_user.role == models.UserRole.DOCTOR) else None
        thread = threading.Thread(
            target=generate_meet_link_sync,
            kwargs=dict(
                appointment_id=new_app.id,
                summary=f"Appointment: {patient.full_name} with Dr. {slot.doctor.full_name if slot.doctor else 'Unknown'}",
                start_time_utc=slot.start_time.replace(tzinfo=IST).astimezone(timezone.utc),
                end_time_utc=slot.end_time.replace(tzinfo=IST).astimezone(timezone.utc),
                patient_email=patient.email,
                doctor_email=doctor_email,
                patient_name=patient.full_name,
                doctor_name=slot.doctor.full_name if slot.doctor else "Unknown",
                appointment_date=slot.start_time.strftime("%Y-%m-%d"),
                start_time_str=slot.start_time.strftime("%H:%M"),
                end_time_str=slot.end_time.strftime("%H:%M"),
                appointment_start_utc=slot.start_time.replace(tzinfo=IST).astimezone(timezone.utc),
            ),
            daemon=True
        )
        thread.start()

    res = await db.execute(
        select(models.Appointment)
        .options(
            selectinload(models.Appointment.doctor),
            selectinload(models.Appointment.patient),
            selectinload(models.Appointment.doctor_profile),
        )
        .where(models.Appointment.id == new_app.id)
    )
    appointment = res.scalars().first()
    out = schemas.AppointmentOut.model_validate(appointment)
    out.doctor_fee = appointment.doctor_profile.fee if appointment.doctor_profile else None
    return out


# -------------------------------------------------------------------
# 3. Cancellation / Slot Removal
# -------------------------------------------------------------------

@router.delete("/availability/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability_slot(
    slot_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == slot_id)
    )
    slot = slot_res.scalars().first()

    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized")

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
            print(f"NOTIFICATION: Appointment {appointment.id} cancelled.")

    await db.delete(slot)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"delete_availability_slot commit failed for slot {slot_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete availability slot.")


@router.get("", response_model=List[schemas.AppointmentOut])
async def get_appointments(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Appointment).options(
        selectinload(models.Appointment.doctor),
        selectinload(models.Appointment.patient)
    )
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Appointment.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Appointment.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        rec_res = await db.execute(
            select(models.Receptionist)
            .options(selectinload(models.Receptionist.doctors))
            .where(models.Receptionist.user_id == current_user.id)
        )
        rec = rec_res.scalars().first()
        if not rec or not rec.doctors:
            return []
        assigned_doctor_user_ids = [d.user_id for d in rec.doctors]
        query = query.where(models.Appointment.doctor_id.in_(assigned_doctor_user_ids))
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
async def reschedule_appointment(
    appointment_id: int,
    new_booking: schemas.AppointmentReschedule,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    app_res = await db.execute(
        select(models.Appointment)
        .options(selectinload(models.Appointment.doctor), selectinload(models.Appointment.patient))
        .where(models.Appointment.id == appointment_id)
    )
    appointment = app_res.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appointment.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")

    slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == new_booking.new_availability_id)
    )
    new_slot = slot_res.scalars().first()
    if not new_slot or new_slot.is_booked:
        raise HTTPException(status_code=400, detail="New slot is unavailable or already booked")

    old_slot_res = await db.execute(
        select(models.Availability).where(models.Availability.id == appointment.availability_id)
    )
    old_slot = old_slot_res.scalars().first()
    if old_slot:
        old_slot.is_booked = False

    appointment.availability_id = new_slot.id
    appointment.start_time = new_slot.start_time
    appointment.end_time = new_slot.end_time
    appointment.appointment_date = new_slot.start_time
    appointment.status = models.AppointmentStatus.RESCHEDULED
    new_slot.is_booked = True

    try:
        await db.commit()
        await db.refresh(appointment)
    except Exception as e:
        await db.rollback()
        logger.error(f"reschedule_appointment commit failed for appointment_id={appointment_id}: {e}")
        raise HTTPException(status_code=500, detail="Reschedule failed. Please try again.")

    # Send reschedule emails to patient and doctor
    new_date_str  = new_slot.start_time.strftime("%Y-%m-%d")
    new_start_str = new_slot.start_time.strftime("%H:%M")
    new_end_str   = new_slot.end_time.strftime("%H:%M")

    patient = appointment.patient
    doctor_user = appointment.doctor

    if patient and patient.email:
        background_tasks.add_task(
            send_reschedule_email,
            to_email=patient.email,
            recipient_name=patient.full_name,
            doctor_name=appointment.doctor_name,
            appointment_date=new_date_str,
            start_time=new_start_str,
            end_time=new_end_str,
            meet_link=appointment.meet_link
        )
    if doctor_user and doctor_user.email:
        background_tasks.add_task(
            send_reschedule_email,
            to_email=doctor_user.email,
            recipient_name=f"Dr. {appointment.doctor_name}",
            doctor_name=appointment.doctor_name,
            appointment_date=new_date_str,
            start_time=new_start_str,
            end_time=new_end_str,
            meet_link=appointment.meet_link
        )

    res = await db.execute(
        select(models.Appointment)
        .options(
            selectinload(models.Appointment.doctor),
            selectinload(models.Appointment.patient)
        )
        .where(models.Appointment.id == appointment_id)
    )
    return res.scalars().first()


@router.get("/updated", response_model=List[schemas.AppointmentOut])
async def get_updated_appointments(
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.RECEPTIONIST])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Appointment).options(
        selectinload(models.Appointment.doctor),
        selectinload(models.Appointment.patient)
    ).where(
        models.Appointment.status == models.AppointmentStatus.RESCHEDULED,
        models.Appointment.organization_id == current_user.organization_id
    )
    if current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Appointment.doctor_id == current_user.id)

    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/{appointment_id}/status", response_model=schemas.AppointmentOut)
async def update_appointment_status(
    appointment_id: int,
    body: schemas.AppointmentStatusUpdate,  # ← change this
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    result = await db.execute(
        select(models.Appointment).where(models.Appointment.id == appointment_id)
    )
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role != models.UserRole.SUPER_ADMIN:
        if appointment.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    appointment.status = body.status  # ← only status updated

    try:
        await db.commit()
        await db.refresh(appointment)
    except Exception as e:
        await db.rollback()
        logger.error(f"update_appointment_status failed for appointment_id={appointment_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update appointment.")

    res = await db.execute(
        select(models.Appointment)
        .options(
            selectinload(models.Appointment.doctor),
            selectinload(models.Appointment.patient),
            selectinload(models.Appointment.doctor_profile),
        )
        .where(models.Appointment.id == appointment_id)
    )
    appointment = res.scalars().first()
    out = schemas.AppointmentOut.model_validate(appointment)
    out.doctor_fee = appointment.doctor_profile.fee if appointment.doctor_profile else None
    return out