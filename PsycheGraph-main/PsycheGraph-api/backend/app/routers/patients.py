from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime, date, timezone
from typing import List, Optional
import logging
import uuid
from .. import models, schemas, dependencies, database
from ..routers.sessions import session_response
from ..services import s3
import json

logger = logging.getLogger("patients")

router = APIRouter(prefix="/patients", tags=["Patients"])

ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE_MB = 10
MAX_DOCUMENTS = 10


# ── Shared helper: validate & read uploaded files ────────────────────────────
async def _validate_uploads(documents: List[UploadFile]) -> list[tuple[str, str, bytes]]:
    """Returns list of (filename, content_type, file_bytes) after validation."""
    if len(documents) > MAX_DOCUMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"You can upload a maximum of {MAX_DOCUMENTS} documents per patient.",
        )
    validated = []
    for doc in documents:
        if not doc.filename or doc.size == 0:
            continue
        if doc.content_type not in ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"'{doc.filename}' has unsupported type '{doc.content_type}'. "
                       f"Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX.",
            )
        file_bytes = await doc.read()
        if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"'{doc.filename}' exceeds the {MAX_FILE_SIZE_MB} MB size limit.",
            )
        validated.append((doc.filename, doc.content_type, file_bytes))
    return validated


# ── Shared helper: upload files to S3 and persist DB rows ───────────────────
async def _upload_and_persist(
    validated_files: list[tuple[str, str, bytes]],
    patient_id: int,
    org_id: int,
    db: AsyncSession,
) -> None:
    for filename, content_type, file_bytes in validated_files:
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        s3_key = f"medical-records/{org_id}/{patient_id}/{unique_filename}"

        try:
            s3.upload_document(file_bytes, s3_key, content_type)
        except Exception as upload_err:
            logger.error(f"S3 upload failed: {upload_err}")
            raise HTTPException(status_code=502, detail=f"Upload failed for '{filename}'.")

        db.add(models.PatientDocument(
            patient_id=patient_id,
            file_name=filename,
            s3_key=s3_key,
            content_type=content_type,
        ))


# ── POST /patients/ ──────────────────────────────────────────────────────────
@router.post("/", response_model=schemas.PatientOut)
async def create_patient(
    full_name: str = Form(...),
    date_of_birth: Optional[date] = Form(None),
    contact_number: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    documents: List[UploadFile] = File(default=[]),
    current_user: models.User = Depends(
        dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL, models.UserRole.DOCTOR])
    ),
    db: AsyncSession = Depends(database.get_db),
):
    if current_user.role in [models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST, models.UserRole.DOCTOR]:
        org_id = current_user.organization_id
    else:
        org_id = organization_id

    if not org_id:
        raise HTTPException(status_code=400, detail="organization_id is required")

    valid_docs = [d for d in (documents or []) if d.filename and d.size and d.size > 0]
    validated_files = await _validate_uploads(valid_docs)

    new_patient = models.Patient(
        full_name=full_name,
        date_of_birth=datetime.combine(date_of_birth, datetime.min.time()) if date_of_birth else None,
        phone=contact_number,
        email=email,
        gender=gender,
        address=address,
        organization_id=org_id,
        created_by_id=current_user.id,
    )
    db.add(new_patient)

    try:
        await db.flush()
        await _upload_and_persist(validated_files, new_patient.id, org_id, db)
        await db.commit()

        result = await db.execute(
            select(models.Patient)
            .where(models.Patient.id == new_patient.id)
            .options(selectinload(models.Patient.documents))
        )
        return result.scalar_one()

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"create_patient failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /patients ────────────────────────────────────────────────────────────
@router.get("", response_model=List[schemas.PatientOut])
async def get_patients(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db),
):
    query = select(models.Patient).options(selectinload(models.Patient.documents))  # ← added

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(
            (models.Patient.doctor_id == current_user.id) |
            (models.Patient.created_by_id == current_user.id)
        )
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = query.offset(skip).limit(limit)
    try:
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"get_patients failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patients.")


# ── GET /patients/{patient_id} ───────────────────────────────────────────────
@router.get("/{patient_id}", response_model=schemas.PatientOut)
async def get_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db),
):
    query = (
        select(models.Patient)
        .where(models.Patient.id == patient_id)
        .options(selectinload(models.Patient.documents))  # ← added
    )

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role in [models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST]:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(
            (models.Patient.doctor_id == current_user.id) |
            (models.Patient.created_by_id == current_user.id)
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return patient
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patient.")


# ── PUT /patients/{patient_id} ───────────────────────────────────────────────
@router.put("/{patient_id}", response_model=schemas.PatientOut)
async def update_patient(
    patient_id: int,
    # Patient fields
    full_name: Optional[str] = Form(None),
    date_of_birth: Optional[date] = Form(None),
    contact_number: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    # New documents to append
    documents: List[UploadFile] = File(default=[]),
    # IDs of existing documents to delete (comma-separated string, e.g. "1,2,3")
    delete_document_ids: Optional[str] = Form(None),
    current_user: models.User = Depends(
        dependencies.require_role([models.UserRole.RECEPTIONIST, models.UserRole.HOSPITAL])
    ),
    db: AsyncSession = Depends(database.get_db),
):
    query = (
        select(models.Patient)
        .where(models.Patient.id == patient_id)
        .options(selectinload(models.Patient.documents))
    )
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.RECEPTIONIST:
        query = query.where(models.Patient.organization_id == current_user.organization_id)

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # ── 1. Apply scalar field updates ────────────────────────────────────
        if full_name is not None:
            patient.full_name = full_name
        if date_of_birth is not None:
            patient.date_of_birth = datetime.combine(date_of_birth, datetime.min.time())
        if contact_number is not None:
            patient.phone = contact_number
        if email is not None:
            patient.email = email
        if gender is not None:
            patient.gender = gender
        if address is not None:
            patient.address = address

        # ── 2. Delete requested documents ────────────────────────────────────
        ids_to_delete = set()
        if delete_document_ids:
            ids_to_delete = {int(i) for i in delete_document_ids.split(",") if i.strip().isdigit()}
            for doc in list(patient.documents):
                if doc.id in ids_to_delete:
                    try:
                        s3.delete_document(doc.s3_key)
                    except Exception as e:
                        logger.warning(f"S3 delete failed for key {doc.s3_key}: {e}")
                    await db.delete(doc)

        # ── 3. Validate & enforce MAX_DOCUMENTS cap ──────────────────────────
        remaining_count = len(patient.documents) - (len(ids_to_delete) if delete_document_ids else 0)
        valid_docs = [d for d in (documents or []) if d.filename and d.size and d.size > 0]
        validated_files = await _validate_uploads(valid_docs)

        if remaining_count + len(validated_files) > MAX_DOCUMENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Adding these files would exceed the {MAX_DOCUMENTS}-document limit. "
                       f"Patient currently has {remaining_count} document(s).",
            )

        # ── 4. Upload & persist new documents ────────────────────────────────
        await _upload_and_persist(validated_files, patient.id, patient.organization_id, db)

        await db.commit()

        # Re-fetch with updated documents
        refreshed = await db.execute(
            select(models.Patient)
            .where(models.Patient.id == patient_id)
            .options(selectinload(models.Patient.documents))
        )
        return refreshed.scalar_one()

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"update_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update patient.")


# ── DELETE /patients/{patient_id} ────────────────────────────────────────────
@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    query = (
        select(models.Patient)
        .where(models.Patient.id == patient_id)
        .options(selectinload(models.Patient.documents))  # ← added to access s3_keys
    )

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role in [models.UserRole.HOSPITAL, models.UserRole.RECEPTIONIST]:
        query = query.where(models.Patient.organization_id == current_user.organization_id)

    try:
        result = await db.execute(query)
        patient = result.scalars().first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # ── Delete all S3 objects before removing the DB row ─────────────────
        for doc in patient.documents:
            try:
                s3.delete_document(doc.s3_key)
            except Exception as e:
                # Log but don't abort — a missing S3 object shouldn't block deletion
                logger.warning(f"S3 delete skipped for key {doc.s3_key}: {e}")

        await db.delete(patient)  # cascades to PatientDocument rows
        await db.commit()
        return None

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"delete_patient failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete patient.")


# ── PATCH /patients/{patient_id}/status ──────────────────────────────────────
@router.patch("/{patient_id}/status", response_model=schemas.PatientOut)
async def update_patient_status(
    patient_id: int,
    body: schemas.PatientStatusUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.RECEPTIONIST,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    result = await db.execute(
        select(models.Patient)
        .where(models.Patient.id == patient_id)
        .options(selectinload(models.Patient.documents))  # ← consistent with other endpoints
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role != models.UserRole.SUPER_ADMIN:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    patient.is_active = body.is_active
    try:
        await db.commit()
        await db.refresh(patient)
    except Exception as e:
        await db.rollback()
        logger.error(f"update_patient_status failed for patient_id={patient_id}: {e}")
        raise HTTPException(status_code=500, detail="Status update failed. Please try again.")

    return patient

# ── GET /patients/{patient_id}/file ─────────────────────────────────────────
@router.get("/{patient_id}/file", response_model=schemas.PatientFileOut)
async def get_patient_file(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db),
):
    result = await db.execute(
        select(models.Patient)
        .options(
            selectinload(models.Patient.intake),
            selectinload(models.Patient.sessions).selectinload(models.Session.appointment),
            selectinload(models.Patient.documents),
        )
        .where(models.Patient.id == patient_id)
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.RECEPTIONIST:
        if patient.created_by_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    sorted_sessions = sorted(patient.sessions, key=lambda s: s.session_number)
    session_outs = [session_response(s, current_user) for s in sorted_sessions] 

    return schemas.PatientFileOut(
        id=patient.id,
        full_name=patient.full_name,
        date_of_birth=patient.date_of_birth,
        contact_number=patient.phone,
        email=patient.email,
        gender=patient.gender,
        address=patient.address,
        doctor_id=patient.doctor_id,
        age=patient.age,
        is_active=patient.is_active,
        created_at=patient.created_at,
        intake=patient.intake,
        sessions=session_outs,
    )


# ── PUT /patients/{patient_id}/file ─────────────────────────────────────────
@router.put("/{patient_id}/file", response_model=schemas.PatientFileOut)
async def update_patient_file(
    patient_id: int,
    file_update: schemas.PatientFileUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    result = await db.execute(
        select(models.Patient)
        .options(
            selectinload(models.Patient.intake),
            selectinload(models.Patient.sessions).selectinload(models.Session.appointment),
            selectinload(models.Patient.documents),
        )
        .where(models.Patient.id == patient_id)
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if patient.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update patient demographics — intake is never touched
    patient_updates = file_update.model_dump(exclude_unset=True, exclude={"sessions"})
    for key, value in patient_updates.items():
        if key == "contact_number":
            patient.phone = value
        else:
            setattr(patient, key, value)

    # Update sessions if provided
    if file_update.sessions:
        session_map = {s.id: s for s in patient.sessions}

        for session_update in file_update.sessions:
            session = session_map.get(session_update.session_id)
            if not session:
                raise HTTPException(
                    status_code=404,
                    detail=f"Session {session_update.session_id} not found for this patient"
                )

            if current_user.role == models.UserRole.DOCTOR:
                if session.doctor_id != current_user.id:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Not authorized to edit session {session_update.session_id}"
                    )

            # Snapshot before overwriting
            snapshot = models.SessionVersion(
                session_id=session.id,
                version_number=session.version,
                transcript=session.transcript,
                summary=session.summary,
                soap_notes=session.soap_notes,
                treatment_plan=session.treatment_plan,
                notes=session.notes,
                saved_by_id=current_user.id,
            )
            db.add(snapshot)

            update_data = session_update.model_dump(exclude_unset=True, exclude={"session_id"})
            # Handle appointment status update separately
            if "appointment_status" in update_data:
                apt_status = update_data.pop("appointment_status")
                if session.appointment:
                    session.appointment.status = apt_status
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Session {session_update.session_id} has no linked appointment"
                    )

            if "soap_notes" in update_data and update_data["soap_notes"] is not None:
                update_data["soap_notes"] = json.dumps(update_data["soap_notes"])
            for key, value in update_data.items():
                setattr(session, key, value)
            session.version += 1

    await db.commit()

    # Re-fetch fresh
    refreshed = await db.execute(
        select(models.Patient)
        .options(
            selectinload(models.Patient.intake),
            selectinload(models.Patient.sessions),
            selectinload(models.Patient.documents),
        )
        .where(models.Patient.id == patient_id)
    )
    patient = refreshed.scalars().first()
    sorted_sessions = sorted(patient.sessions, key=lambda s: s.session_number)

    return schemas.PatientFileOut(
        id=patient.id,
        full_name=patient.full_name,
        date_of_birth=patient.date_of_birth,
        contact_number=patient.phone,
        email=patient.email,
        gender=patient.gender,
        address=patient.address,
        doctor_id=patient.doctor_id,
        age=patient.age,
        is_active=patient.is_active,
        created_at=patient.created_at,
        intake=patient.intake,
        sessions=sorted_sessions,
    )
