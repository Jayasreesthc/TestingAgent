from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from .. import models, dependencies, database

router = APIRouter(prefix="/stats", tags=["Stats"])

@router.get("/")
async def get_stats(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    stats = []
    
    if current_user.role == models.UserRole.SUPER_ADMIN:
        # Total Organizations
        org_count = await db.execute(select(func.count(models.Organization.id)))
        # Total Users
        user_count = await db.execute(select(func.count(models.User.id)))
        # Total Patients
        patient_count = await db.execute(select(func.count(models.Patient.id)))
        
        stats = [
            {"label": "Total Organizations", "value": str(org_count.scalar()), "type": "orgs"},
            {"label": "Global Users", "value": str(user_count.scalar()), "type": "users"},
            {"label": "Total Patients", "value": str(patient_count.scalar()), "type": "patients"},
            {"label": "System Health", "value": "Optimal", "type": "health"}
        ]
        
    elif current_user.role == models.UserRole.HOSPITAL:
        # Total Doctors in Org
        doc_count = await db.execute(
            select(func.count(models.User.id))
            .where(models.User.organization_id == current_user.organization_id, models.User.role == models.UserRole.DOCTOR)
        )
        # Total Patients in Org
        patient_count = await db.execute(
            select(func.count(models.Patient.id))
            .where(models.Patient.organization_id == current_user.organization_id)
        )
        # Total Appointments in Org
        app_count = await db.execute(
            select(func.count(models.Appointment.id))
            .where(models.Appointment.organization_id == current_user.organization_id)
        )
        
        stats = [
            {"label": "Medical Staff", "value": str(doc_count.scalar()), "type": "doctors"},
            {"label": "Org Patients", "value": str(patient_count.scalar()), "type": "patients"},
            {"label": "Total Appointments", "value": str(app_count.scalar()), "type": "appointments"},
            {"label": "License Status", "value": "Active", "type": "license"}
        ]
        
    elif current_user.role == models.UserRole.DOCTOR:
        # Doctor's Patients
        patient_count = await db.execute(
            select(func.count(models.Patient.id))
            .where(models.Patient.doctor_id == current_user.id)
        )
        # Doctor's Appointments
        app_count = await db.execute(
            select(func.count(models.Appointment.id))
            .where(models.Appointment.doctor_id == current_user.id)
        )
        # Doctor's Sessions
        session_count = await db.execute(
            select(func.count(models.Session.id))
            .where(models.Session.doctor_id == current_user.id)
        )
        
        stats = [
            {"label": "My Patients", "value": str(patient_count.scalar()), "type": "patients"},
            {"label": "Appointments", "value": str(app_count.scalar()), "type": "appointments"},
            {"label": "Sessions Conducted", "value": str(session_count.scalar()), "type": "sessions"},
            {"label": "Avg Rating", "value": "4.9", "type": "rating"}
        ]
        
    elif current_user.role == models.UserRole.RECEPTIONIST:
        # Patients created by receptionist
        patient_count = await db.execute(
            select(func.count(models.Patient.id))
            .where(models.Patient.created_by_id == current_user.id)
        )
        # Org Appointments
        app_count = await db.execute(
            select(func.count(models.Appointment.id))
            .where(models.Appointment.organization_id == current_user.organization_id)
        )
        
        stats = [
            {"label": "Patients Registered", "value": str(patient_count.scalar()), "type": "patients"},
            {"label": "Org Appointments", "value": str(app_count.scalar()), "type": "appointments"},
            {"label": "Active Slots", "value": "12", "type": "slots"},
            {"label": "Check-ins Today", "value": "8", "type": "checkins"}
        ]

    return stats
