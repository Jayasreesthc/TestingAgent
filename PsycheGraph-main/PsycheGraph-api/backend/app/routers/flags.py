import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional

from .. import models, schemas, dependencies, database

logger = logging.getLogger("flags")
router = APIRouter(tags=["Themes & Flags"])


# -------------------------------------------------------------------
# GET /themes — list all themes available to this user
# Returns default themes + their organization's custom themes
# -------------------------------------------------------------------

@router.get("/themes", response_model=List[schemas.ThemeOut])
async def get_themes(
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Theme).where(
            (models.Theme.is_default == True) |
            (models.Theme.organization_id == current_user.organization_id)
        ).order_by(models.Theme.is_default.desc(), models.Theme.name)
    )
    return result.scalars().all()


# -------------------------------------------------------------------
# POST /themes — create a custom theme for this organization
# -------------------------------------------------------------------

@router.post("/themes", response_model=schemas.ThemeOut)
async def create_theme(
    theme_in: schemas.ThemeCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    theme = models.Theme(
        name=theme_in.name,
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        is_default=False,
    )
    db.add(theme)
    await db.commit()
    await db.refresh(theme)
    return theme


# -------------------------------------------------------------------
# DELETE /themes/{theme_id} — delete a custom theme (not default ones)
# -------------------------------------------------------------------

@router.delete("/themes/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.Theme).where(models.Theme.id == theme_id)
    )
    theme = result.scalars().first()
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete a default theme")
    if theme.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(theme)
    await db.commit()
    return None


# -------------------------------------------------------------------
# POST /sessions/{session_id}/flags — add a flag to a session
# -------------------------------------------------------------------

@router.post("/sessions/{session_id}/flags", response_model=schemas.SessionFlagOut)
async def add_flag(
    session_id: int,
    flag_in: schemas.SessionFlagCreate,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    # Check session exists and user has access
    session_res = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = session_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Check theme exists
    theme_res = await db.execute(
        select(models.Theme).where(models.Theme.id == flag_in.theme_id)
    )
    if not theme_res.scalars().first():
        raise HTTPException(status_code=404, detail="Theme not found")

    flag = models.SessionFlag(
        session_id=session_id,
        theme_id=flag_in.theme_id,
        timestamp_seconds=flag_in.timestamp_seconds,
        transcript_position=flag_in.transcript_position,
        note=flag_in.note,
        created_by_id=current_user.id,
    )
    db.add(flag)
    await db.commit()

    # Reload with theme relationship for theme_name population
    await db.refresh(flag)
    result = await db.execute(
        select(models.SessionFlag)
        .options(selectinload(models.SessionFlag.theme))
        .where(models.SessionFlag.id == flag.id)
    )
    return result.scalars().first()


# -------------------------------------------------------------------
# GET /sessions/{session_id}/flags — get all flags for a session
# -------------------------------------------------------------------

@router.get("/sessions/{session_id}/flags", response_model=List[schemas.SessionFlagOut])
async def get_flags(
    session_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: AsyncSession = Depends(database.get_db)
):
    session_res = await db.execute(
        select(models.Session).where(models.Session.id == session_id)
    )
    session = session_res.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == models.UserRole.DOCTOR:
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(models.SessionFlag)
        .options(selectinload(models.SessionFlag.theme))
        .where(models.SessionFlag.session_id == session_id)
        .order_by(models.SessionFlag.timestamp_seconds.asc())
    )
    return result.scalars().all()


# -------------------------------------------------------------------
# DELETE /sessions/{session_id}/flags/{flag_id} — remove a flag
# -------------------------------------------------------------------

@router.delete("/sessions/{session_id}/flags/{flag_id}", status_code=204)
async def delete_flag(
    session_id: int,
    flag_id: int,
    current_user: models.User = Depends(dependencies.require_role([
        models.UserRole.DOCTOR,
        models.UserRole.HOSPITAL,
        models.UserRole.SUPER_ADMIN,
    ])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.SessionFlag).where(
            models.SessionFlag.id == flag_id,
            models.SessionFlag.session_id == session_id,
        )
    )
    flag = result.scalars().first()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    if current_user.role == models.UserRole.DOCTOR:
        session_res = await db.execute(
            select(models.Session).where(models.Session.id == session_id)
        )
        session = session_res.scalars().first()
        if session.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(flag)
    await db.commit()
    return None