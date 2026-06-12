from pydantic import BaseModel, EmailStr
from typing import Optional, List, Union
from datetime import datetime
from .models import UserRole

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenRefresh(BaseModel):
    refresh_token: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: Optional[bool] = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(UserBase):
    password: str
    organization_id: int

class UserOut(UserBase):
    id: int
    organization_id: Optional[int] = None
    specialization: Optional[str] = None
    license_key: Optional[str] = None
    shift_timing: Optional[str] = None
    doctor_id: Optional[int] = None

    
    class Config:
        from_attributes = True

class UserWithToken(UserOut):
    access_token: str
    refresh_token: str
    token_type: str

# Registration Schemas
class RegistrationBase(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    license_key: str

class HospitalRegister(RegistrationBase):
    pass

class DoctorRegister(RegistrationBase):
    specialization: str

class ReceptionistRegister(RegistrationBase):
    doctor_id: Optional[int] = None
    specialization: str
    shift_timing: str

class RegisterResponse(BaseModel):
    message: str
    user_id: int
    organization_id: int

class OrganizationBase(BaseModel):
    name: str
    license_key: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationOut(OrganizationBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class PatientBase(BaseModel):
    full_name: str
    date_of_birth: datetime
    contact_number: str
    email: Optional[str] = None

class PatientCreate(PatientBase):
    organization_id: Optional[int] = None

class PatientOut(PatientBase):
    id: int
    organization_id: Optional[int]
    doctor_id: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    patient_id: int
    doctor_id: int
    date: datetime

class SessionCreate(SessionBase):
    pass

class SessionOut(SessionBase):
    id: int
    audio_url: Optional[str]
    transcript: Optional[str]
    soap_note: Optional[str]
    summary: Optional[str]
    version: int
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None
    password: Optional[str] = None

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    license_key: Optional[str] = None
    is_active: Optional[bool] = None

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    doctor_id: Optional[int] = None

class AvailabilityBase(BaseModel):
    start_time: datetime
    end_time: datetime

class AvailabilityCreate(AvailabilityBase):
    doctor_id: int
    organization_id: Optional[int] = None

class AvailabilityBatchCreate(BaseModel):
    doctor_id: int
    organization_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 15

class AvailabilityOut(AvailabilityBase):
    id: int
    doctor_id: int
    organization_id: int
    is_booked: bool

    class Config:
        from_attributes = True

class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    meet_link: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    availability_id: int # The slot being booked

class AppointmentOut(AppointmentBase):
    id: int
    status: str
    organization_id: int

    class Config:
        from_attributes = True

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    meet_link: Optional[str] = None

class SessionUpdate(BaseModel):
    transcript: Optional[str] = None
    soap_note: Optional[str] = None
    summary: Optional[str] = None
