from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import timedelta
from typing import Union
import secrets
import string
from .. import models, schemas, auth, database

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/token", response_model=schemas.UserWithToken)
async def login_for_access_token(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    # Authenticate user
    # Eager load profiles
    result = await db.execute(
        select(models.User)
        .options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile))
        .where(models.User.email == user_credentials.email)
    )
    user = result.scalars().first()
    
    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Ensure role is string for JWT
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    
    # Create token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": role_str},
        expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "role": role_str}
    )
    
    return schemas.UserWithToken(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        specialization=user.doctor_profile.specialization if user.doctor_profile else (user.receptionist_profile.specialization if user.receptionist_profile else user.specialization),
        license_key=user.doctor_profile.license_key if user.doctor_profile else user.license_key,
        shift_timing=user.receptionist_profile.shift_timing if user.receptionist_profile else user.shift_timing,
        doctor_id=user.id if user.role == models.UserRole.DOCTOR else (user.receptionist_profile.doctor_id if user.receptionist_profile else None),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/token/refresh", response_model=Union[schemas.UserWithToken, schemas.Token])
async def refresh_access_token(token_data: schemas.TokenRefresh, db: AsyncSession = Depends(database.get_db)):
    try:
        payload = jwt.decode(token_data.refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
            
        result = await db.execute(select(models.User).where(models.User.email == email))
        user = result.scalars().first()
        if not user:
             raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
             
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": user.email, "role": role_str},
            expires_delta=access_token_expires
        )
        new_refresh_token = auth.create_refresh_token(
            data={"sub": user.email, "role": role_str}
        )
        
        # Super Admin should only get the tokens
        if user.role == models.UserRole.SUPER_ADMIN:
            return schemas.Token(
                access_token=access_token,
                refresh_token=new_refresh_token,
                token_type="bearer"
            )
        
        # Need to re-fetch with profiles to return UserWithToken populated
        # Or just return basic
        # Ideally we should eager load here too if we want to return profile data
        # For now, let's just return what we have or re-query
        
        # Re-query with profiles for consistency in refresh
        result = await db.execute(
            select(models.User)
            .options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile))
            .where(models.User.id == user.id)
        )
        user_refresh = result.scalars().first()
        
        return schemas.UserWithToken(
            id=user_refresh.id,
            email=user_refresh.email,
            full_name=user_refresh.full_name,
            role=user_refresh.role,
            organization_id=user_refresh.organization_id,
            is_active=user_refresh.is_active,
            specialization=user_refresh.doctor_profile.specialization if user_refresh.doctor_profile else (user_refresh.receptionist_profile.specialization if user_refresh.receptionist_profile else user_refresh.specialization),
            license_key=user_refresh.doctor_profile.license_key if user_refresh.doctor_profile else user_refresh.license_key,
            shift_timing=user_refresh.receptionist_profile.shift_timing if user_refresh.receptionist_profile else user_refresh.shift_timing,
            doctor_id=user_refresh.id if user_refresh.role == models.UserRole.DOCTOR else (user_refresh.receptionist_profile.doctor_id if user_refresh.receptionist_profile else None),
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Helper for registration
async def register_user(
    user_data: schemas.RegistrationBase, 
    role: models.UserRole, 
    db: AsyncSession,
    extra_fields: dict = {}
):
    # 1. Verify license key and find organization
    result = await db.execute(select(models.Organization).where(models.Organization.license_key == user_data.license_key))
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=400, detail="Invalid license key")
        
    # 2. Check if email already exists
    result = await db.execute(select(models.User).where(models.User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # 3. Create user
    user_fields = extra_fields.copy()
    if "doctor_id" in user_fields:
        del user_fields["doctor_id"]

    new_user = models.User(
        email=user_data.email,
        hashed_password=auth.get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=role,
        organization_id=org.id,
        license_key=user_data.license_key,  # Unified license field
        **user_fields
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # 4. Create Role Profile
    try:
        if role == models.UserRole.DOCTOR:
            new_profile = models.Doctor(
                id=new_user.id,
                specialization=extra_fields.get("specialization"),
                license_key=extra_fields.get("license_key") 
            )
            db.add(new_profile)
        elif role == models.UserRole.RECEPTIONIST:
            new_profile = models.Receptionist(
                id=new_user.id,
                specialization=extra_fields.get("specialization"),
                shift_timing=extra_fields.get("shift_timing"),
                doctor_id=extra_fields.get("doctor_id")
            )
            db.add(new_profile)
        
        await db.commit()
    except Exception as e:
        pass 

    return schemas.RegisterResponse(
        message=f"{role.value} registered successfully",
        user_id=new_user.id,
        organization_id=org.id
    )

# Helper for login
async def login_user(
    user_credentials: schemas.UserLogin, 
    role: models.UserRole,
    db: AsyncSession
):
    # Eager load profiles
    result = await db.execute(
        select(models.User)
        .options(selectinload(models.User.doctor_profile), selectinload(models.User.receptionist_profile))
        .where(models.User.email == user_credentials.email)
    )
    user = result.scalars().first()
    
    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.role != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User is not registered as a {role.value}"
        )
    
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": role_str},
        expires_delta=access_token_expires
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "role": role_str}
    )
    
    return schemas.UserWithToken(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        specialization=user.doctor_profile.specialization if user.doctor_profile else (user.receptionist_profile.specialization if user.receptionist_profile else user.specialization),
        license_key=user.doctor_profile.license_key if user.doctor_profile else user.license_key,
        shift_timing=user.receptionist_profile.shift_timing if user.receptionist_profile else user.shift_timing,
        doctor_id=user.id if user.role == models.UserRole.DOCTOR else (user.receptionist_profile.doctor_id if user.receptionist_profile else None),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/login/hospital", response_model=schemas.UserWithToken, tags=["Hospital Login"])
async def login_hospital(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.HOSPITAL, db)

@router.post("/login/doctor", response_model=schemas.UserWithToken, tags=["Doctor Login"])
async def login_doctor(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.DOCTOR, db)

@router.post("/login/receptionist", response_model=schemas.UserWithToken, tags=["Receptionist Login"])
async def login_receptionist(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.RECEPTIONIST, db)

@router.post("/register/hospital", response_model=schemas.RegisterResponse, tags=["Hospital Login"])
async def register_hospital_admin(user_data: schemas.HospitalRegister, db: AsyncSession = Depends(database.get_db)):
    return await register_user(user_data, models.UserRole.HOSPITAL, db)

@router.post("/register/doctor", response_model=schemas.RegisterResponse, tags=["Doctor Login"])
async def register_doctor(user_data: schemas.DoctorRegister, db: AsyncSession = Depends(database.get_db)):
    extra = {
        "specialization": user_data.specialization
    }
    return await register_user(user_data, models.UserRole.DOCTOR, db, extra)

@router.post("/register/receptionist", response_model=schemas.RegisterResponse, tags=["Receptionist Login"])
async def register_receptionist(user_data: schemas.ReceptionistRegister, db: AsyncSession = Depends(database.get_db)):
    extra = {
        "specialization": user_data.specialization,
        "shift_timing": user_data.shift_timing,
        "doctor_id": user_data.doctor_id
    }
    return await register_user(user_data, models.UserRole.RECEPTIONIST, db, extra)
