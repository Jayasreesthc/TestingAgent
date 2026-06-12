from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from .database import get_db
from .models import User, UserRole, Receptionist
from .auth import SECRET_KEY, ALGORITHM
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Eagerly load both profiles + receptionist's doctors in one query
    # Missing selectinload(Receptionist.doctors) was causing hidden lazy loads on every request
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.doctor_profile),
            selectinload(User.receptionist_profile).selectinload(Receptionist.doctors)
        )
        .where(User.email == email)
    )
    user = result.scalars().first()

    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: list[UserRole], detail: str = None):
    def role_checker(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            message = detail or f"Access denied. This action requires one of the following roles: {', '.join(r.value for r in allowed_roles)}"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=message
            )
        return user
    return role_checker

