from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from .. import models, schemas, dependencies, database
from ..services import audio
import shutil
import os
import uuid
from datetime import datetime
import logging
import traceback

logger = logging.getLogger("sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=schemas.SessionOut)
async def create_session(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    doctor_id: Optional[int] = Form(None), # Required if Hospital Admin is creating
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR, models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    # Logic: Doctors create for their patients, Hospital admin creates for their org
    if current_user.role == models.UserRole.DOCTOR:
        actual_doctor_id = current_user.id
    elif current_user.role in [models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN]:
        if not doctor_id:
            raise HTTPException(status_code=400, detail="doctor_id is required when Admin creates a session")
        actual_doctor_id = doctor_id
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    # Verify patient belongs to doctor or org
    stmt = select(models.Patient).where(models.Patient.id == patient_id)
    result = await db.execute(stmt)
    patient = result.scalars().first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Check if patient belongs to doctor's org
    if patient.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Patient not in your organization")

    # Save file permanently
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Reset file pointer for processing
    file.file.seek(0)
    
    # Process Audio (Transcription + Summary)
    # Note: process_audio_file saves its own temp copy, which is fine
    try:
        processed_data = await audio.process_audio_file(file)
    except Exception as e:
        # If processing fails, we might still want to save the session but mark as failed?
        # For now, let's just log and raise, but maybe returning the session with error status is better
        # We will assume happy path for MVP as per "do only backend things" request
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")

    new_session = models.Session(
        patient_id=patient_id,
        doctor_id=actual_doctor_id,
        created_by_id=current_user.id,
        date=datetime.utcnow(),
        audio_url=file_path,
        transcript=processed_data.get("english_translation", ""),
        summary=processed_data.get("summary", ""),
        soap_note=processed_data.get("summary", "") # Using summary as initial SOAP note for now
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session

@router.get("", response_model=List[schemas.SessionOut])
async def get_sessions(
    patient_id: Optional[int] = None,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Session)
    
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass # Super Admin sees all sessions
    elif current_user.role == models.UserRole.HOSPITAL:
        # Hospital Admin sees sessions for their organization's patients
        query = query.join(models.Patient).where(models.Patient.organization_id == current_user.organization_id)
    elif current_user.role == models.UserRole.DOCTOR:
        query = query.where(models.Session.doctor_id == current_user.id)
    elif current_user.role == models.UserRole.RECEPTIONIST: 
        # Receptionist sees sessions for patients they created
        query = query.join(models.Patient).where(models.Patient.created_by_id == current_user.id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if patient_id:
        query = query.where(models.Session.patient_id == patient_id)
        
    try:
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error in get_sessions: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/{session_id}", response_model=schemas.SessionOut)
async def get_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Session).where(models.Session.id == session_id)
    # Check permissions logic
    # Doctors can see their own sessions (or all in org if configured, but strictly speaking likely their own patients)
    # Admin/SuperAdmin can see all provided they belong to org
    
    result = await db.execute(query)
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Permission check
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass # Super Admin has full access
    elif current_user.role == models.UserRole.HOSPITAL:
         # Check patient's org
         patient_res = await db.execute(select(models.Patient).where(models.Patient.id == session.patient_id))
         patient = patient_res.scalars().first()
         if not patient or patient.organization_id != current_user.organization_id:
              raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
             raise HTTPException(status_code=403, detail="Not authorized to view this session")
    elif current_user.role == models.UserRole.RECEPTIONIST:
         # Check if patient was created by this receptionist
         patient_res = await db.execute(select(models.Patient).where(models.Patient.id == session.patient_id))
         patient = patient_res.scalars().first()
         if not patient or patient.created_by_id != current_user.id:
              raise HTTPException(status_code=403, detail="Not authorized")
    else:
         raise HTTPException(status_code=403, detail="Not authorized")
              
    return session

@router.put("/{session_id}", response_model=schemas.SessionOut)
async def update_session(
    session_id: int,
    session_update: schemas.SessionUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.DOCTOR])),
    db: AsyncSession = Depends(database.get_db)
):
    # Only doctors can update their sessions (notes/summary)
    query = select(models.Session).where(models.Session.id == session_id)
    result = await db.execute(query)
    session = result.scalars().first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Who can update: Super Admin, Hospital Admin (all in org), Doctor (their own)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        pass
    elif current_user.role == models.UserRole.HOSPITAL:
        # Check org
        patient_res = await db.execute(select(models.Patient).where(models.Patient.id == session.patient_id))
        patient = patient_res.scalars().first()
        if not patient or patient.organization_id != current_user.organization_id:
             raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this session")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    update_data = session_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session, key, value)
        
    # Increment version
    session.version += 1
    
    await db.commit()
    await db.refresh(session)
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.HOSPITAL, models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    # Admins can delete sessions
    query = select(models.Session).where(models.Session.id == session_id)
    result = await db.execute(query)
    session = result.scalars().first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Org check
    patient_res = await db.execute(select(models.Patient).where(models.Patient.id == session.patient_id))
    patient = patient_res.scalars().first()
    if current_user.role != models.UserRole.SUPER_ADMIN:
        if not patient or patient.organization_id != current_user.organization_id:
             raise HTTPException(status_code=403, detail="Not authorized")
             
    await db.delete(session)
    await db.commit()
    return None
