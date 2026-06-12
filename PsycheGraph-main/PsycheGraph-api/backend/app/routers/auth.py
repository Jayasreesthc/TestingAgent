from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import timedelta
from typing import Union, Optional
from .. import models, schemas, auth, database
from ..models import Receptionist
import shutil, os, uuid
import base64

router = APIRouter(prefix="/auth", tags=["Authentication"])


# -------------------------------------------------------------------
# Helper — build UserWithToken from a User row
# -------------------------------------------------------------------

def build_user_with_token(user: models.User, access_token: str, refresh_token: str) -> schemas.UserWithToken:
    return schemas.UserWithToken(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        phone_number=user.phone_number,
        doctor_id=user.doctor_profile.id if user.role == models.UserRole.DOCTOR and user.doctor_profile else None,
        doctor_name=None,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


def make_tokens(user: models.User):
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": role_str},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = auth.create_refresh_token(
        data={"sub": user.email, "role": role_str}
    )
    return access_token, refresh_token


# -------------------------------------------------------------------
# Generic login
# -------------------------------------------------------------------

async def login_user(user_credentials: schemas.UserLogin, role: models.UserRole, db: AsyncSession):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile).selectinload(Receptionist.doctors)
        )
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

    access_token, refresh_token = make_tokens(user)
    return build_user_with_token(user, access_token, refresh_token)


# -------------------------------------------------------------------
# Hospital registration
# Change 3: org email must match — hospital sets their own password
# -------------------------------------------------------------------

async def register_hospital(user_data: schemas.HospitalRegister, db: AsyncSession, logo_url: Optional[str] = None):
    result = await db.execute(
        select(models.Organization).where(
            models.Organization.email == user_data.email,
            models.Organization.license_key == user_data.license_key
        )
    )
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=400, detail="Email and license key do not match any registered organization")
    if not org.is_approved:
        raise HTTPException(status_code=400, detail="Organization is not approved yet")

    existing = await db.execute(
        select(models.User).where(
            models.User.email == user_data.email,
            models.User.role == models.UserRole.HOSPITAL
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Hospital admin already registered for this organization")

    if logo_url:
        org.logo_url = logo_url

    new_user = models.User(
        email=user_data.email,
        hashed_password=auth.get_password_hash(user_data.password),
        role=models.UserRole.HOSPITAL,
        organization_id=org.id,
        full_name=org.pending_name,      # ← pull from org
        phone_number=org.pending_phone,  # ← pull from org
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    return schemas.RegisterResponse(
        message="Hospital admin registered successfully",
        user_id=new_user.id,
        organization_id=org.id
    )


# -------------------------------------------------------------------
# Universal login endpoint
# -------------------------------------------------------------------

@router.post("/token", response_model=schemas.UserWithToken)
async def login_for_access_token(
    user_credentials: schemas.UserLogin,
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.doctor_profile),
            selectinload(models.User.receptionist_profile).selectinload(Receptionist.doctors)
        )
        .where(models.User.email == user_credentials.email)
    )
    user = result.scalars().first()

    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, refresh_token = make_tokens(user)
    return build_user_with_token(user, access_token, refresh_token)


# -------------------------------------------------------------------
# Token refresh
# -------------------------------------------------------------------

@router.post("/token/refresh", response_model=Union[schemas.UserWithToken, schemas.Token])
async def refresh_access_token(
    token_data: schemas.TokenRefresh,
    db: AsyncSession = Depends(database.get_db)
):
    try:
        payload = jwt.decode(token_data.refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")

        if email is None or token_type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        result = await db.execute(
            select(models.User)
            .options(
                selectinload(models.User.doctor_profile),
                selectinload(models.User.receptionist_profile).selectinload(Receptionist.doctors)
            )
            .where(models.User.email == email)
        )
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        access_token, refresh_token = make_tokens(user)

        if user.role == models.UserRole.SUPER_ADMIN:
            return schemas.Token(
                access_token=access_token,
                refresh_token=refresh_token,
                token_type="bearer"
            )

        return build_user_with_token(user, access_token, refresh_token)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# -------------------------------------------------------------------
# Role-specific login endpoints
# -------------------------------------------------------------------

@router.post("/login/super-admin", response_model=schemas.UserWithToken)
async def login_super_admin(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.SUPER_ADMIN, db)

@router.post("/login/hospital", response_model=schemas.UserWithToken, tags=["Hospital Login"])
async def login_hospital(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.HOSPITAL, db)

@router.post("/login/doctor", response_model=schemas.UserWithToken, tags=["Doctor Login"])
async def login_doctor(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.DOCTOR, db)

@router.post("/login/receptionist", response_model=schemas.UserWithToken, tags=["Receptionist Login"])
async def login_receptionist(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(database.get_db)):
    return await login_user(user_credentials, models.UserRole.RECEPTIONIST, db)


# -------------------------------------------------------------------
# Hospital registration (only valid self-registration)
# Doctor and Receptionist are created by Hospital Admin only
# -------------------------------------------------------------------

@router.post(
    "/register/hospital",
    response_model=schemas.RegisterResponse,
    tags=["Hospital Login"],
    openapi_extra={
        "requestBody": {
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "email":       {"type": "string", "format": "email"},
                            "password":    {"type": "string"},
                            "license_key": {"type": "string"},
                            "logo":        {"type": "string", "format": "binary"},
                        },
                        "required": ["email", "password", "license_key"]
                    }
                }
            }
        }
    }
)
async def register_hospital_admin(
    email: str = Form(...),
    password: str = Form(...),
    license_key: str = Form(...),
    logo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(database.get_db)
):
    logo_url = None
    if logo and logo.filename:
        ext = os.path.splitext(logo.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
            raise HTTPException(status_code=400, detail="Logo must be JPG, PNG, WEBP or SVG")
        contents = await logo.read()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml"}
        mime = mime_map.get(ext, "image/png")
        logo_url = f"data:{mime};base64,{base64.b64encode(contents).decode('utf-8')}"

    user_data = schemas.HospitalRegister(
        email=email,
        password=password,
        license_key=license_key,
    )
    return await register_hospital(user_data, db, logo_url=logo_url)
