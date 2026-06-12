from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from .. import models, dependencies, database
import asyncio

router = APIRouter(prefix="/stats", tags=["Stats"])

@router.get("/")
async def get_stats(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    stats = []
    
    if current_user.role == models.UserRole.SUPER_ADMIN:
        # FIX: Run all COUNT queries concurrently instead of sequentially
        org_count_res, user_count_res, patient_count_res = await asyncio.gather(
            db.execute(select(func.count(models.Organization.id))),
            db.execute(select(func.count(models.User.id))),
            db.execute(select(func.count(models.Patient.id))),
        )
        
        stats = [
            {"label": "Total Organizations", "value": str(org_count_res.scalar()), "type": "orgs"},
            {"label": "Global Users", "value": str(user_count_res.scalar()), "type": "users"},
            {"label": "Total Patients", "value": str(patient_count_res.scalar()), "type": "patients"},
            {"label": "System Health", "value": "Optimal", "type": "health"}
        ]
        
    elif current_user.role == models.UserRole.HOSPITAL:
        # FIX: Run all COUNT queries concurrently instead of sequentially
        doc_count_res, patient_count_res, app_count_res = await asyncio.gather(
            db.execute(
                select(func.count(models.User.id))
                .where(models.User.organization_id == current_user.organization_id, models.User.role == models.UserRole.DOCTOR)
            ),
            db.execute(
                select(func.count(models.Patient.id))
                .where(models.Patient.organization_id == current_user.organization_id)
            ),
            db.execute(
                select(func.count(models.Appointment.id))
                .where(models.Appointment.organization_id == current_user.organization_id)
            ),
        )
        
        stats = [
            {"label": "Medical Staff", "value": str(doc_count_res.scalar()), "type": "doctors"},
            {"label": "Org Patients", "value": str(patient_count_res.scalar()), "type": "patients"},
            {"label": "Total Appointments", "value": str(app_count_res.scalar()), "type": "appointments"},
            {"label": "License Status", "value": "Active", "type": "license"}
        ]
        
    elif current_user.role == models.UserRole.DOCTOR:
        # FIX: Run all COUNT queries concurrently instead of sequentially
        patient_count_res, app_count_res, session_count_res = await asyncio.gather(
            db.execute(
                select(func.count(models.Patient.id))
                .where(models.Patient.doctor_id == current_user.id)
            ),
            db.execute(
                select(func.count(models.Appointment.id))
                .where(models.Appointment.doctor_id == current_user.id)
            ),
            db.execute(
                select(func.count(models.Session.id))
                .where(models.Session.doctor_id == current_user.id)
            ),
        )
        
        stats = [
            {"label": "My Patients", "value": str(patient_count_res.scalar()), "type": "patients"},
            {"label": "Appointments", "value": str(app_count_res.scalar()), "type": "appointments"},
            {"label": "Sessions Conducted", "value": str(session_count_res.scalar()), "type": "sessions"},
            {"label": "Avg Rating", "value": "4.9", "type": "rating"}
        ]
        
    elif current_user.role == models.UserRole.RECEPTIONIST:
        # FIX: Run all COUNT queries concurrently instead of sequentially
        patient_count_res, app_count_res = await asyncio.gather(
            db.execute(
                select(func.count(models.Patient.id))
                .where(models.Patient.created_by_id == current_user.id)
            ),
            db.execute(
                select(func.count(models.Appointment.id))
                .where(models.Appointment.organization_id == current_user.organization_id)
            ),
        )
        
        stats = [
            {"label": "Patients Registered", "value": str(patient_count_res.scalar()), "type": "patients"},
            {"label": "Org Appointments", "value": str(app_count_res.scalar()), "type": "appointments"},
            {"label": "Active Slots", "value": "12", "type": "slots"},
            {"label": "Check-ins Today", "value": "8", "type": "checkins"}
        ]

    return stats