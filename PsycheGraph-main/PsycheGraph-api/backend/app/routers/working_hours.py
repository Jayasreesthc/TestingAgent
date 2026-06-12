from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import case
from typing import List
from .. import models, schemas, dependencies, database

router = APIRouter(prefix="/organizations", tags=["Working Hours"])

VALID_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

# Maps each day name to its correct week order position for sorting
DAY_ORDER = case(
    {day: pos for pos, day in enumerate(VALID_DAYS)},
    value=models.OrganizationSchedule.day
)


# -------------------------------------------------------------------
# GET /organizations/{org_id}/working-hours
# Accessible by: any authenticated user
# -------------------------------------------------------------------

@router.get("/{org_id}/working-hours", response_model=List[schemas.ScheduleOut])
async def get_working_hours(
    org_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    org_res = await db.execute(
        select(models.Organization).where(models.Organization.id == org_id)
    )
    if not org_res.scalars().first():
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await db.execute(
        select(models.OrganizationSchedule)
        .where(models.OrganizationSchedule.organization_id == org_id)
        .order_by(DAY_ORDER)
    )
    return result.scalars().all()


# -------------------------------------------------------------------
# PUT /organizations/{org_id}/working-hours
# Accessible by: Hospital Admin (own org), Super Admin
# Upserts one row per day
# -------------------------------------------------------------------

@router.put("/{org_id}/working-hours", response_model=List[schemas.ScheduleOut])
async def set_working_hours(
    org_id: int,
    schedule: schemas.WorkingHoursUpdate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    if current_user.role == models.UserRole.HOSPITAL:
        if current_user.organization_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized")

    org_res = await db.execute(
        select(models.Organization).where(models.Organization.id == org_id)
    )
    if not org_res.scalars().first():
        raise HTTPException(status_code=404, detail="Organization not found")

    submitted = schedule.model_dump(exclude_unset=True)

    for day, day_data in submitted.items():
        if day not in VALID_DAYS:
            continue

        existing_res = await db.execute(
            select(models.OrganizationSchedule).where(
                models.OrganizationSchedule.organization_id == org_id,
                models.OrganizationSchedule.day == day
            )
        )
        existing = existing_res.scalars().first()

        if existing:
            existing.is_enabled  = day_data.get("is_enabled",  existing.is_enabled)
            existing.start_time  = day_data.get("start_time")
            existing.end_time    = day_data.get("end_time")
            existing.break_start = day_data.get("break_start")
            existing.break_end   = day_data.get("break_end")
        else:
            db.add(models.OrganizationSchedule(
                organization_id=org_id,
                day=day,
                is_enabled=day_data.get("is_enabled", False),
                start_time=day_data.get("start_time"),
                end_time=day_data.get("end_time"),
                break_start=day_data.get("break_start"),
                break_end=day_data.get("break_end"),
            ))

    await db.commit()

    result = await db.execute(
        select(models.OrganizationSchedule)
        .where(models.OrganizationSchedule.organization_id == org_id)
        .order_by(DAY_ORDER)
    )
    return result.scalars().all()