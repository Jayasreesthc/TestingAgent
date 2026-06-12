import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .. import models, schemas, dependencies, database

logger = logging.getLogger("intake")
router = APIRouter(prefix="/patients", tags=["Intake"])


@router.post("/{patient_id}/intake", response_model=schemas.IntakeOut)
async def create_intake(
    patient_id: int,
    intake_in: schemas.IntakeCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
    ])),
    db: AsyncSession = Depends(database.get_db),
):
    # 1. Patient must exist
    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 2. Doctor must belong to the same organization as the patient
    if patient.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 3. Intake must not already exist — immutable once created
    existing_res = await db.execute(
        select(models.PatientIntake).where(models.PatientIntake.patient_id == patient_id)
    )
    if existing_res.scalars().first():
        raise HTTPException(status_code=409, detail="Intake form already exists for this patient")

    # 4. Create
    intake = models.PatientIntake(
        patient_id=patient_id,
        created_by_id=current_user.id,
        **intake_in.model_dump()
    )
    db.add(intake)
    await db.commit()
    await db.refresh(intake)
    logger.info(f"[INTAKE] Created for patient {patient_id} by doctor {current_user.id}")
    return intake


@router.get("/{patient_id}/intake", response_model=schemas.IntakeOut)
async def get_intake(
    patient_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db),
):
    # 1. Patient must exist
    patient_res = await db.execute(
        select(models.Patient).where(models.Patient.id == patient_id)
    )
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 2. Authorization
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

    # 3. Fetch intake
    intake_res = await db.execute(
        select(models.PatientIntake).where(models.PatientIntake.patient_id == patient_id)
    )
    intake = intake_res.scalars().first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake form not found")

    return intake