import os
import uuid
import json
import logging
import traceback
import tempfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from .. import models, schemas, dependencies, database
from ..services.fireflies import get_transcript
from ..services.audio import llama_summarize, transcribe_audio
from ..services.s3 import upload_audio as s3_upload, get_presigned_url, delete_audio as s3_delete


logger = logging.getLogger("sessions")
router = APIRouter(prefix="/sessions", tags=["Sessions"])

# AUDIO_DIR = os.getenv("AUDIO_STORAGE_PATH", "/var/app/audio")

def session_response(session: models.Session, current_user: models.User):
    """Return SessionOutAdmin for SUPER_ADMIN, SessionOut for everyone else."""
    
    # Safely extract appointment fields without triggering lazy load
    start_time = None
    end_time = None
    appointment_status = None
    try:
        from sqlalchemy.orm.base import instance_state
        state = instance_state(session)
        if "appointment" in state.dict and state.dict["appointment"] is not None:
            appt = state.dict["appointment"]
            start_time = appt.start_time
            end_time = appt.end_time
            appointment_status = appt.status
    except Exception:
        pass

    if current_user.role == models.UserRole.SUPER_ADMIN:
        out = schemas.SessionOutAdmin.model_validate(session)
    else:
        out = schemas.SessionOut.model_validate(session)

    out.start_time = start_time
    out.end_time = end_time
    out.appointment_status = appointment_status
    return out


# -------------------------------------------------------------------
# Create Session manually
# -------------------------------------------------------------------

@router.post("/", response_model=schemas.SessionOut)
async def create_session(
    session_in: schemas.SessionCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role == models.UserRole.DOCTOR:
        actual_doctor_id = current_user.id
    else:
        actual_doctor_id = session_in.doctor_id

    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == session_in.patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Patient not in your organization")

    # Serialize SOAPNote to JSON string for storage
    soap_notes_str = None
    if session_in.soap_notes:
        soap_notes_str = json.dumps(session_in.soap_notes.model_dump())

    if session_in.appointment_id:
        existing_res = await db.execute(
            select(models.Session).where(models.Session.appointment_id == session_in.appointment_id)
        )
        if existing_res.scalars().first():
            raise HTTPException(status_code=400, detail="A session already exists for this appointment")

    # Compute visit number for this patient
    from sqlalchemy import func
    count_res = await db.execute(
        select(func.count()).where(models.Session.patient_id == session_in.patient_id)
    )
    visit_number = (count_res.scalar() or 0) + 1

    new_session = models.Session(
        patient_id=session_in.patient_id,
        doctor_id=actual_doctor_id,
        appointment_id=session_in.appointment_id,
        created_by_id=current_user.id,
        session_date=datetime.now(timezone.utc),
        soap_notes=soap_notes_str,
        treatment_plan=session_in.treatment_plan,
        notes=session_in.notes,
        session_number=visit_number,
        time_duration=session_in.time_duration,
        flags_data=session_in.flags_data,
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return session_response(new_session, current_user)


# -------------------------------------------------------------------
# Fetch transcript from Fireflies and save to session
# POST /sessions/{appointment_id}/fetch-transcript
#
# Call this after the meeting ends.
# Fireflies takes 3-5 minutes to process after meeting ends.
# -------------------------------------------------------------------

@router.post("/{appointment_id}/fetch-transcript", response_model=schemas.SessionOut)
async def fetch_and_save_transcript(
    appointment_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    apt_res = await db.execute(
        select(models.Appointment).where(models.Appointment.id == appointment_id)
    )
    appointment = apt_res.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not appointment.meet_link:
        raise HTTPException(status_code=400, detail="No meet link found for this appointment")

    fireflies_data = get_transcript(appointment.meet_link)
    if not fireflies_data:
        raise HTTPException(
            status_code=404,
            detail="No transcript found on Fireflies yet — wait 3-5 minutes after meeting ends and try again"
        )

    transcript_text = fireflies_data.get("transcript", "")
    try:
        summary_text = await llama_summarize(transcript_text)
    except Exception:
        summary_text = fireflies_data.get("summary", "")  # fallback to Fireflies' own summary

    session_res = await db.execute(
        select(models.Session).where(models.Session.appointment_id == appointment_id)
    )
    existing_session = session_res.scalars().first()

    if existing_session:
        # Only update transcript and summary — never overwrite doctor's soap_notes
        existing_session.transcript = transcript_text
        existing_session.summary = summary_text
        await db.commit()
        await db.refresh(existing_session)
        logger.info(f"[FIREFLIES] Updated session {existing_session.id} for appointment {appointment_id}")
        return session_response(existing_session, current_user)
    else:
        from sqlalchemy import func
        count_res = await db.execute(
            select(func.count()).where(models.Session.patient_id == appointment.patient_id)
        )
        visit_number = (count_res.scalar() or 0) + 1

        new_session = models.Session(
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            appointment_id=appointment_id,
            created_by_id=current_user.id,
            session_date=datetime.now(timezone.utc),
            transcript=transcript_text,
            summary=summary_text,
            session_number=visit_number,
        )


        db.add(new_session)
        await db.commit()
        await db.refresh(new_session)
        logger.info(f"[FIREFLIES] Created new session for appointment {appointment_id}")
        return session_response(new_session, current_user)


# -------------------------------------------------------------------
# Get all sessions
# -------------------------------------------------------------------

@router.get("", response_model=List[schemas.SessionOut])
async def get_sessions(
    patient_id: Optional[int] = None,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Session).order_by(models.Session.session_number.asc())

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.join(models.Patient).where(
            models.Patient.organization_id == current_user.organization_id
        )
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Session.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.join(models.Patient).where(
            models.Patient.created_by_id == current_user.id
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    if patient_id:
        query = query.where(models.Session.patient_id == patient_id)

    try:
        result = await db.execute(query)
        sessions = result.scalars().all()
        return [session_response(s, current_user) for s in sessions]
    except Exception as e:
        logger.error(f"Error in get_sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sessions.")


# -------------------------------------------------------------------
# Get single session
# -------------------------------------------------------------------

# GET /sessions/audio-recordings — super admin lists all sessions with audio
@router.get("/audio-recordings", response_model=List[schemas.SessionAudioListOut])
async def list_audio_recordings(
    organization_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    """
    List all sessions that have audio recordings.
    Filter by organization (hospital), doctor, or patient.
    Returns ONLY the audio_url and basic identifiers to save bandwidth.
    """
    query = (
        select(models.Session)
        .join(models.Patient)
        .where(models.Session.audio_url.isnot(None))
    )

    if organization_id:
        query = query.where(models.Patient.organization_id == organization_id)

    if doctor_id:
        query = query.where(models.Session.doctor_id == doctor_id)

    if patient_id:
        query = query.where(models.Session.patient_id == patient_id)

    query = query.order_by(models.Session.session_date.desc())

    result = await db.execute(query)
    sessions = result.scalars().all()

    # Generate presigned URLs for each session
    output = []
    for s in sessions:
        # Validate against the new lightweight schema
        validated = schemas.SessionAudioListOut.model_validate(s)
        if validated.audio_url:
            try:
                validated.audio_url = get_presigned_url(validated.audio_url)
            except Exception:
                validated.audio_url = None
        output.append(validated)

    return output

@router.get("/patient/{patient_id}/versions", response_model=schemas.PatientVersionHistoryOut)
async def get_patient_version_history(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    """
    Returns both the current state of all sessions AND the full edit history
    for a patient — so the doctor can see what it looks like now vs what changed.
    """
    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        pass  # filtered below
    elif current_user.role == models.UserRole.RECEPTIONIST:
        if patient.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get current sessions
    sessions_query = (
        select(models.Session)
        .where(models.Session.patient_id == patient_id)
        .order_by(models.Session.session_number.asc())
    )

    if current_user.role == models.UserRole.DOCTOR:
        sessions_query = sessions_query.where(
            models.Session.doctor_id == current_user.id
        )
    sessions_res = await db.execute(sessions_query)
    sessions = sessions_res.scalars().all()

    session_ids = [s.id for s in sessions]

    # Get all version snapshots for those sessions
    versions_res = await db.execute(
        select(models.SessionVersion)
        .where(models.SessionVersion.session_id.in_(session_ids))
        .order_by(
            models.SessionVersion.session_id.desc(),
            models.SessionVersion.version_number.desc()
        )
    ) if session_ids else None

    versions = versions_res.scalars().all() if versions_res else []

    return schemas.PatientVersionHistoryOut(
        current_sessions=[session_response(s, current_user) for s in sessions],
        version_history=versions,
    )

@router.get("/{session_id}", response_model=schemas.SessionOut)
async def get_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.RECEPTIONIST:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    return session_response(session, current_user)


# -------------------------------------------------------------------
# Update session — doctor fills soap_notes manually here
# -------------------------------------------------------------------

@router.put("/{session_id}", response_model=schemas.SessionOut)
async def update_session(
    session_id: int,
    session_update: schemas.SessionUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # ── Snapshot current state BEFORE overwriting ──────────────────────
    snapshot = models.SessionVersion(
        session_id=session_id,
        version_number=session.version,
        transcript=session.transcript,
        summary=session.summary,
        soap_notes=session.soap_notes,
        treatment_plan=session.treatment_plan,
        notes=session.notes,
        saved_by_id=current_user.id,
    )
    db.add(snapshot)

    # ── Update session ──────────────────────────────────────────────

    update_data = session_update.model_dump(exclude_unset=True)
    if "soap_notes" in update_data and update_data["soap_notes"] is not None:
        update_data["soap_notes"] = json.dumps(update_data["soap_notes"])
    for key, value in update_data.items():
        setattr(session, key, value)
    session.version += 1

    await db.commit()
    await db.refresh(session)
    return session_response(session, current_user)


# -------------------------------------------------------------------
# Delete session
# -------------------------------------------------------------------

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role != models.UserRole.SUPER_ADMIN:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Delete audio file from S3 if it exists
    if session.audio_url:
        try:
            s3_delete(session.audio_url)
        except Exception:
            pass  # don't block deletion if S3 cleanup fails

    await db.delete(session)
    await db.commit()
    return None

def _save_transcript_sync(session_id: int, transcript: str, summary: str):
    """Save transcript to DB using synchronous psycopg2 — safe from any thread."""
    import psycopg2

    database_url = os.getenv("DATABASE_URL", "")
    sync_url = database_url.replace("postgresql+asyncpg://", "postgresql://")

    try:
        conn = psycopg2.connect(sync_url)
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE sessions 
            SET transcript = %s, summary = %s
            WHERE id = %s
            """,
            (transcript, summary, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"[TRANSCRIPTION COMPLETE] session {session_id}")
    except Exception as e:
        logger.error(f"[DB SAVE FAILED] session {session_id}: {e}")


def run_transcription_sync(session_id: int, temp_path: str):
    """Wrapper for BackgroundTasks — runs transcription then saves to DB synchronously."""
    import asyncio
    
    logger.info(f"[BACKGROUND] Starting transcription for session {session_id}")  # ← add this
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(transcribe_audio(temp_path))
        transcript = result.get("transcript", "")
        summary = result.get("summary", "")
        logger.info(f"[BACKGROUND] Transcription done, saving to DB — chars: {len(transcript)}")
        _save_transcript_sync(session_id, transcript, summary)
    except Exception as e:
        logger.error(f"[TRANSCRIPTION FAILED] session {session_id}: {e}")
        logger.error(traceback.format_exc())
    finally:
        loop.close()
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/{session_id}/upload-audio", response_model=schemas.SessionOut)
async def upload_offline_session_audio(
    session_id: int,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...), 
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.RECEPTIONIST,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    # 1. Fetch session with appointment
    session_res = await db.execute(
        select(models.Session)
        .options(selectinload(models.Session.appointment))
        .where(models.Session.id == session_id)
    )
    session = session_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. Offline-only guard
    if session.appointment and session.appointment.booking_type != "offline":
        raise HTTPException(
            status_code=400,
            detail="Audio upload is only for offline appointments."
        )

    # 3. Authorization
    if current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # 4. Validate extension
    allowed = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".mp4"}
    file_ext = os.path.splitext(audio_file.filename or "")[1].lower()
    if file_ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Allowed types: {', '.join(allowed)}")

    # 5. Read audio bytes once
    try:
        contents = await audio_file.read()
    except Exception as e:
        logger.error(f"Failed to read audio upload for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to read audio file")

    # 5a. Extract audio duration in seconds
    try:
        import io
        from mutagen import File as MutagenFile
        audio_meta = MutagenFile(io.BytesIO(contents))
        if audio_meta and audio_meta.info:
            session.time_duration = round(audio_meta.info.length, 2)
            logger.info(f"[AUDIO] Duration for session {session_id}: {session.time_duration}s")
        else:
            logger.warning(f"[AUDIO] Could not read duration for session {session_id}")
    except Exception as e:
        logger.warning(f"[AUDIO] Duration extraction failed for session {session_id}: {e}")

    try:
        ext_to_mime = {
            ".mp3": "audio/mpeg", ".wav": "audio/wav",
            ".m4a": "audio/mp4",  ".ogg": "audio/ogg",
            ".webm": "audio/webm", ".mp4": "audio/mp4",
        }
        content_type = ext_to_mime.get(file_ext, "application/octet-stream")
        s3_key = f"audio/session_{session_id}_{uuid.uuid4().hex}{file_ext}"
        s3_upload(contents, s3_key, content_type)
        session.audio_url = s3_key   # store S3 key, not a local path
    except Exception as e:
        logger.error(f"Failed to upload audio to S3 for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload audio file")

    # 7. Transcribe (write to temp file, then clean up)
    temp_path = os.path.join(tempfile.gettempdir(), f"session_{session_id}_{uuid.uuid4().hex}{file_ext}")
    with open(temp_path, "wb") as f:
        f.write(contents)
    
    session.transcript = "[Transcription in progress...]"
    background_tasks.add_task(run_transcription_sync, session_id, temp_path)

    # 8. Commit and return immediately — no waiting
    try:
        await db.commit()
        await db.refresh(session)
    except Exception as e:
        await db.rollback()
        logger.error(f"Commit failed for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save session")

    return session_response(session, current_user)

@router.get("/{session_id}/versions/{version_number}/audio")
async def stream_version_audio(
    session_id: int,
    version_number: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    version_res = await db.execute(
        select(models.SessionVersion).where(
            models.SessionVersion.session_id == session_id,
            models.SessionVersion.version_number == version_number
        )
    )
    version = version_res.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if not version.audio_url:
        raise HTTPException(status_code=404, detail="No audio for this version")

    try:
        url = get_presigned_url(version.audio_url)
        return {"audio_url": url, "expires_in_seconds": 3600}
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate audio URL")


# GET /sessions/{session_id}/versions — list all versions
@router.get("/{session_id}/versions", response_model=List[schemas.SessionVersionOut])
async def get_session_versions(
    session_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    """List all saved versions for a session — newest first."""
    result = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Auth check
    if current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.HOSPITAL:
        patient_res = await db.execute(
            select(models.Patient).where(models.Patient.id == session.patient_id)
        )
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    versions_res = await db.execute(
        select(models.SessionVersion)
        .where(models.SessionVersion.session_id == session_id)
        .order_by(models.SessionVersion.version_number.desc())
    )
    return versions_res.scalars().all()


# GET /sessions/{session_id}/versions/{version_number} — view one version (read-only)
@router.get("/{session_id}/versions/{version_number}", response_model=schemas.SessionVersionOut)
async def get_session_version(
    session_id: int,
    version_number: int,          # ← renamed from version_id
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    """Read-only view of a specific saved version — looked up by version number."""
    version_res = await db.execute(
        select(models.SessionVersion).where(
            models.SessionVersion.session_id == session_id,
            models.SessionVersion.version_number == version_number   # ← changed from .id
        )
    )
    version = version_res.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return version

@router.post("/walk-in", response_model=schemas.WalkInSessionOut)
async def create_walkin_session(
    body: schemas.WalkInSessionCreate,  # ← clean JSON again
    current_user: models.User = Depends(
        dependencies.require_role([
            models.UserRole.DOCTOR,
            models.UserRole.HOSPITAL,
            models.UserRole.RECEPTIONIST,
        ])
    ),
    db: AsyncSession = Depends(database.get_db),
):
    from sqlalchemy import func

    new_patient = models.Patient(
        full_name=body.full_name,
        phone=body.contact_number,
        gender=body.gender,
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        doctor_id=current_user.id if current_user.role == models.UserRole.DOCTOR else None,
    )
    db.add(new_patient)
    await db.flush()

    count_res = await db.execute(
        select(func.count()).where(models.Session.patient_id == new_patient.id)
    )
    visit_number = (count_res.scalar() or 0) + 1

    soap_notes_str = None
    parsed_soap = None
    if body.soap_notes:
        parsed_soap = body.soap_notes.model_dump()
        soap_notes_str = json.dumps(parsed_soap)

    new_session = models.Session(
        patient_id=new_patient.id,
        doctor_id=current_user.id,
        appointment_id=None,
        created_by_id=current_user.id,
        session_date=datetime.now(timezone.utc),
        soap_notes=soap_notes_str,
        notes=body.notes,
        treatment_plan=body.treatment_plan,
        session_number=visit_number,
        time_duration=body.time_duration,
        flags_data=body.flags_data,
    )
    db.add(new_session)
    await db.flush()

    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"walk-in session creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create walk-in session.")

    return schemas.WalkInSessionOut(
        patient_id=new_patient.id,
        patient_name=new_patient.full_name,
        contact_number=new_patient.phone,
        age=new_patient.age,
        session_id=new_session.id,
        session_number=new_session.session_number,
        soap_notes=schemas.SOAPNote(**parsed_soap) if parsed_soap else None,
        treatment_plan=body.treatment_plan,
        notes=body.notes,
        transcript=None,
    )

@router.post("/walk-in/{session_id}/upload-audio", response_model=schemas.WalkInSessionOut)
async def upload_walkin_audio(
    session_id: int,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...),
    current_user: models.User = Depends(
        dependencies.require_role([
            models.UserRole.DOCTOR,
            models.UserRole.HOSPITAL,
            models.UserRole.RECEPTIONIST,
        ])
    ),
    db: AsyncSession = Depends(database.get_db),
):
    import tempfile, uuid as uuid_lib

    session_res = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = session_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == session.patient_id)
    )
    patient = patient_res.scalars().first()

    allowed = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".mp4"}
    file_ext = os.path.splitext(audio_file.filename or "")[1].lower()
    if file_ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Allowed types: {', '.join(allowed)}")

    try:
        contents = await audio_file.read()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read audio file")

    # Extract duration
    try:
        import io
        from mutagen import File as MutagenFile
        audio_meta = MutagenFile(io.BytesIO(contents))
        if audio_meta and audio_meta.info:
            session.time_duration = round(audio_meta.info.length, 2)
    except Exception:
        pass

    # Upload to S3
    try:
        ext_to_mime = {
            ".mp3": "audio/mpeg", ".wav": "audio/wav",
            ".m4a": "audio/mp4",  ".ogg": "audio/ogg",
            ".webm": "audio/webm", ".mp4": "audio/mp4",
        }
        s3_key = f"audio/walkin_{session_id}_{uuid_lib.uuid4().hex}{file_ext}"
        s3_upload(contents, s3_key, ext_to_mime.get(file_ext, "application/octet-stream"))
        session.audio_url = s3_key
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload audio")

    temp_path = os.path.join(tempfile.gettempdir(), f"walkin_{session_id}_{uuid_lib.uuid4().hex}{file_ext}")
    with open(temp_path, "wb") as f:
        f.write(contents)

    session.transcript = "[Transcription in progress...]"

    try:
        await db.commit()
        await db.refresh(session)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save session")

    from ..routers.sessions import run_transcription_sync
    background_tasks.add_task(run_transcription_sync, session.id, temp_path)

    # Parse soap notes for response
    soap_out = None
    if session.soap_notes:
        try:
            soap_out = schemas.SOAPNote(**json.loads(session.soap_notes))
        except Exception:
            pass

    return schemas.WalkInSessionOut(
        patient_id=patient.id,
        patient_name=patient.full_name,
        contact_number=patient.phone,
        age=patient.age,
        session_id=session.id,
        session_number=session.session_number,
        soap_notes=soap_out,
        treatment_plan=session.treatment_plan,
        notes=session.notes,
        transcript=session.transcript,
    )