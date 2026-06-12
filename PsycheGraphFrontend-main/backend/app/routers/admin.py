from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, auth, dependencies, database

router = APIRouter(prefix="/admin", tags=["Admin"])

# Super Admin: Create Organization
@router.post("/organizations", response_model=schemas.OrganizationOut)
async def create_organization(
    org: schemas.OrganizationCreate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    new_org = models.Organization(
        name=org.name, 
        license_key=auth.generate_license_key()
    )
    db.add(new_org)
    try:
        await db.commit()
        await db.refresh(new_org)
        return new_org
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Organization already exists")

# Helper for generic user listing/getting/updating/deleting with role filtering
async def get_role_users(
    role: models.UserRole,
    skip: int,
    limit: int,
    current_user: models.User,
    db: AsyncSession,
    org_id: Optional[int] = None
):
    query = select(models.User).where(models.User.role == role)
    if current_user.role == models.UserRole.SUPER_ADMIN:
        if org_id:
            query = query.where(models.User.organization_id == org_id)
    elif current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

# --- Hospital Admin Management (Super Admin only) ---
hospital_router = APIRouter(prefix="/admin/hospitals", tags=["Hospital Login"])

@hospital_router.get("", response_model=List[schemas.UserOut])
async def list_hospitals(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.HOSPITAL, skip, limit, current_user, db)

@hospital_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_hospital(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL))
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    return user

@hospital_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_hospital(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL))
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@hospital_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hospital(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.HOSPITAL))
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Hospital Admin not found")
    await db.delete(user)
    await db.commit()
    return None

# --- Doctor Management (Super Admin & Hospital Admin) ---
doctor_router = APIRouter(prefix="/admin/doctors", tags=["Doctor Login"])

@doctor_router.post("", response_model=schemas.UserOut)
async def create_doctor(
    user: schemas.DoctorRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    # Verify license key matches org if hospital admin
    result = await db.execute(select(models.Organization).where(models.Organization.license_key == user.license_key))
    org = result.scalars().first()
    if not org: raise HTTPException(status_code=400, detail="Invalid license key")
    
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="License key does not match your organization")

    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        full_name=user.full_name,
        role=models.UserRole.DOCTOR,
        organization_id=org.id,
        specialization=user.specialization,
        license_key=user.license_key
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@doctor_router.get("", response_model=List[schemas.UserOut])
async def list_doctors(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    return await get_role_users(models.UserRole.DOCTOR, skip, limit, current_user, db)

@doctor_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
    return user

@doctor_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_doctor(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(update_data.pop("password"))
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user

@doctor_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.DOCTOR)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Doctor not found")
    await db.delete(user)
    await db.commit()
    return None

# --- Receptionist Management (Super Admin & Hospital Admin) ---
receptionist_router = APIRouter(prefix="/admin/receptionists", tags=["Receptionist Login"])

@receptionist_router.post("", response_model=schemas.UserOut)
async def create_receptionist(
    user: schemas.ReceptionistRegister,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.license_key == user.license_key))
    org = result.scalars().first()
    if not org: raise HTTPException(status_code=400, detail="Invalid license key")
    
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="License key does not match your organization")
    
    # Validate doctor_id if provided
    if user.doctor_id:
        doc_res = await db.execute(
            select(models.User).where(
                models.User.id == user.doctor_id,
                models.User.role == models.UserRole.DOCTOR,
                models.User.organization_id == org.id
            )
        )
        if not doc_res.scalars().first():
            raise HTTPException(status_code=400, detail="Invalid doctor_id for this organization")

    new_user = models.User(
        email=user.email,
        hashed_password=auth.get_password_hash(user.password),
        full_name=user.full_name,
        role=models.UserRole.RECEPTIONIST,
        organization_id=org.id,
        specialization=user.specialization,
        license_key=user.license_key,
        shift_timing=user.shift_timing
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@receptionist_router.get("", response_model=List[schemas.UserOut])
async def list_receptionists(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(
        dependencies.require_role([
            models.UserRole.SUPER_ADMIN,
            models.UserRole.HOSPITAL
        ])
    ),
    db: AsyncSession = Depends(database.get_db)
):
    query = (
        select(models.User)
        .options(selectinload(models.User.receptionist_profile))
        .where(models.User.role == models.UserRole.RECEPTIONIST)
        .offset(skip)
        .limit(limit)
    )

    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(
            models.User.organization_id == current_user.organization_id
        )

    result = await db.execute(query)
    users = result.scalars().all()

    # Attach doctor_id dynamically
    for user in users:
        if user.receptionist_profile:
            user.doctor_id = user.receptionist_profile.doctor_id
        else:
            user.doctor_id = None

    return users

@receptionist_router.get("/{user_id}", response_model=schemas.UserOut)
async def get_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Receptionist not found")
    return user

@receptionist_router.put("/{user_id}", response_model=schemas.UserOut)
async def update_receptionist(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(
        dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])
    ),
    db: AsyncSession = Depends(database.get_db)
):
    # 1️⃣ Fetch receptionist user
    query = select(models.User).where(
        models.User.id == user_id,
        models.User.role == models.UserRole.RECEPTIONIST
    )

    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(
            models.User.organization_id == current_user.organization_id
        )

    result = await db.execute(query)
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Receptionist not found")

    update_data = user_update.model_dump(exclude_unset=True)

    # 2️⃣ Handle password update
    if "password" in update_data:
        update_data["hashed_password"] = auth.get_password_hash(
            update_data.pop("password")
        )

    # 3️⃣ Handle doctor assignment separately
    doctor_id = update_data.pop("doctor_id", None)

    if doctor_id is not None:
        # Validate doctor exists & belongs to same org
        doc_query = select(models.User).where(
            models.User.id == doctor_id,
            models.User.role == models.UserRole.DOCTOR
        )

        if current_user.role == models.UserRole.HOSPITAL:
            doc_query = doc_query.where(
                models.User.organization_id == current_user.organization_id
            )

        doc_res = await db.execute(doc_query)
        doctor = doc_res.scalars().first()

        if not doctor:
            raise HTTPException(
                status_code=400,
                detail="Invalid doctor_id for this organization"
            )

        # Update receptionist profile
        rec_res = await db.execute(
            select(models.Receptionist).where(
                models.Receptionist.id == user.id
            )
        )
        receptionist_profile = rec_res.scalars().first()

        if receptionist_profile:
            receptionist_profile.doctor_id = doctor_id

    # 4️⃣ Update normal user fields
    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)

    return user


@receptionist_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receptionist(
    user_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.User).where(models.User.id == user_id, models.User.role == models.UserRole.RECEPTIONIST)
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.User.organization_id == current_user.organization_id)
    
    result = await db.execute(query)
    user = result.scalars().first()
    if not user: raise HTTPException(status_code=404, detail="Receptionist not found")
    await db.delete(user)
    await db.commit()
    return None

# Add remaining endpoints (individual GET, PUT, DELETE for doctors and receptionists) as needed follow the same pattern

# Organization CRUD
@router.get("/organizations", response_model=List[schemas.OrganizationOut])
async def get_organizations(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    query = select(models.Organization)
    
    # HOSPITAL admins can only see their own organization
    if current_user.role == models.UserRole.HOSPITAL:
        query = query.where(models.Organization.id == current_user.organization_id)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def get_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN, models.UserRole.HOSPITAL])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # HOSPITAL admins can only view their own organization
    if current_user.role == models.UserRole.HOSPITAL and org.id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this organization")
    
    return org

@router.put("/organizations/{org_id}", response_model=schemas.OrganizationOut)
async def update_organization(
    org_id: int,
    org_update: schemas.OrganizationUpdate,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    update_data = org_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(org, key, value)
        
    await db.commit()
    await db.refresh(org)
    return org

@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    current_user: models.User = Depends(dependencies.require_role([models.UserRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Organization).where(models.Organization.id == org_id))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    await db.delete(org)
    await db.commit()
    return None
