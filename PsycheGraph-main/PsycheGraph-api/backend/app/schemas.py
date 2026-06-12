from pydantic import BaseModel, EmailStr, field_validator, model_validator, Field
from typing import Optional, List, Literal
from datetime import datetime, date
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
    full_name: Optional[str] = None
    role: UserRole
    is_active: Optional[bool] = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(UserBase):
    password: str
    organization_id: int


class DoctorBasic(BaseModel):
    id: int
    full_name: Optional[str] = None


    class Config:
        from_attributes = True


class UserOut(UserBase):
    id: int
    organization_id: Optional[int] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None 
    address: Optional[str] = None

    class Config:
        from_attributes = True

class DoctorOut(UserOut):
    pass


class ReceptionistOut(UserOut):
    assigned_doctors: Optional[List[DoctorBasic]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_assigned_doctors(cls, data):
        if hasattr(data, "receptionist_profile") and data.receptionist_profile:
            doctors = data.receptionist_profile.doctors
            if doctors:
                data.__dict__["assigned_doctors"] = [
                    {"id": d.id, "full_name": d.full_name}
                    for d in doctors
                ]
        return data

    class Config:
        from_attributes = True


class UserWithToken(UserOut):
    access_token: str
    refresh_token: str
    token_type: str


# -------------------------------------------------------------------
# Registration Schemas
# -------------------------------------------------------------------

class HospitalRegister(BaseModel):
    email: EmailStr
    password: str
    license_key: str  


class DoctorRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class ReceptionistRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None  
    assigned_doctor_user_ids: Optional[List[int]] = []


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    organization_id: int


class OrganizationBase(BaseModel):
    name: str
    license_key: Optional[str] = None


class OrganizationCreate(BaseModel):
    name: str
    email: EmailStr
    license_key: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None



class OrganizationOut(OrganizationBase):
    id: int
    name: str
    email: Optional[str] = None
    license_key: Optional[str] = None
    is_approved: Optional[bool] = False
    is_active: bool
    logo_url: Optional[str] = None
    created_at: datetime
    address: Optional[str] = None

    @field_validator("logo_url", mode="before")
    @classmethod
    def resolve_logo_url(cls, v):
        if not v:
            return None
        # Already a base64 string (old data) or full URL — return as-is
        if v.startswith("data:") or v.startswith("http"):
            return v
        # S3 key — generate presigned URL
        try:
            from .services.s3 import get_image_url
            return get_image_url(v)
        except Exception:
            return None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class PatientBase(BaseModel):
    full_name: str
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None

    @field_validator('date_of_birth', mode='before')
    @classmethod
    def parse_date_of_birth(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.date()
        return v


class PatientCreate(PatientBase):
    organization_id: Optional[int] = None

class PatientDocumentOut(BaseModel):
    id: int
    file_name: str
    file_type: Optional[str] = None
    url: str = Field(..., alias="s3_key") # We'll transform the key to a URL

    @field_validator("url", mode="before")
    @classmethod
    def resolve_url(cls, v):
        if not v or v.startswith("http"):
            return v
        try:
            from .services.s3 import get_document_url
            return get_document_url(v)
        except Exception:
            return None

    class Config:
        from_attributes = True
        populate_by_name = True


class PatientOut(PatientBase):
    id: int
    organization_id: Optional[int]
    doctor_id: Optional[int]
    age: Optional[int] = None
    # Change this from List[str] to List[PatientDocumentOut]
    documents: List[PatientDocumentOut] = [] 
    created_at: datetime
    is_active: bool = True

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class SessionBase(BaseModel):
    patient_id: int
    doctor_id: int
    date: datetime


class SOAPNote(BaseModel):
    subjective:  Optional[str] = None    # Patient's symptoms, complaints, history
    objective:   Optional[str] = None    # Doctor's observations, vitals, exam findings
    assessment:  Optional[str] = None    # Diagnosis / clinical impression
    plan:        Optional[str] = None    # Treatment plan, medications, follow-up


class SessionCreate(BaseModel):
    patient_id:     int
    doctor_id:      int
    appointment_id: Optional[int] = None
    soap_notes:     Optional[SOAPNote] = None
    notes:          Optional[str] = None
    treatment_plan: Optional[str] = None
    time_duration:  Optional[float] = None  
    flags_data:     Optional[str] = None
    


class SessionOut(SessionBase):
    id:             int
    session_number: int = 1
    appointment_id: Optional[int] = None
    soap_notes:     Optional[SOAPNote] = None
    summary:        Optional[str] = None
    notes:          Optional[str] = None
    transcript:     Optional[str] = None
    treatment_plan: Optional[str] = None
    time_duration:  Optional[float] = None
    flags_data:     Optional[str] = None
    version:        int
    appointment_status: Optional[str] = None
    start_time:     Optional[datetime] = None
    end_time:       Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def populate_from_appointment(cls, data):
        if hasattr(data, "appointment") and data.appointment is not None:
            appt = data.appointment
            if getattr(data, "start_time", None) is None:  # ← was data.start_time
                data.__dict__["start_time"] = appt.start_time
            if getattr(data, "end_time", None) is None:    # ← was data.end_time
                data.__dict__["end_time"] = appt.end_time
            if getattr(data, "appointment_status", None) is None:  # ← was data.appointment_status
                data.__dict__["appointment_status"] = appt.status
        return data

    @field_validator("soap_notes", mode="before")
    @classmethod
    def parse_soap_notes(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")}

class SessionOutAdmin(SessionOut):
    """Only returned to SUPER_ADMIN — exposes the raw audio file path/URL."""
    audio_url: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    organization_id: Optional[int] = None
    password: Optional[str] = None
    assigned_doctor_user_ids: Optional[List[int]] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    license_key: Optional[str] = None
    is_active: Optional[bool] = None
    address: Optional[str] = None


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
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
    duration_minutes: int = 30


class AvailabilityOut(AvailabilityBase):
    id: int
    doctor_id: int
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    booked_by_role: Optional[str] = None
    organization_id: int
    is_booked: bool

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class AppointmentBase(BaseModel):
    patient_id: int
    doctor_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None
    meet_link: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    availability_id: int
    booking_type: Literal["online", "offline"] = "online"
    fee: Optional[int] = None
    


class AppointmentOut(AppointmentBase):
    id: int
    status: str
    organization_id: int
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    booked_by_role: Optional[str] = None
    doctor_fee: Optional[int] = None
    booking_type: Literal["online", "offline"] = "online"
    fee: Optional[int] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }


class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    meet_link: Optional[str] = None


class AppointmentReschedule(BaseModel):
    new_availability_id: int


class SessionUpdate(BaseModel):
    soap_notes: Optional[SOAPNote] = None
    treatment_plan: Optional[str] = None
    transcript: Optional[str] = None
    notes: Optional[str] = None
    summary: Optional[str] = None

class DaySchedule(BaseModel):
    is_enabled:  bool = False
    start_time:  Optional[str] = None
    end_time:    Optional[str] = None
    break_start: Optional[str] = None
    break_end:   Optional[str] = None

    @field_validator("start_time", "end_time", "break_start", "break_end", mode="before")
    @classmethod
    def validate_time_format(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            import re
            if not re.match(r"^\d{2}:\d{2}$", v):
                raise ValueError("Time must be in HH:MM format e.g. 09:00")
        return v

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "is_enabled": True,
                "start_time": "09:00",
                "end_time": "17:00",
                "break_start": "12:00",
                "break_end": "13:00"
            }
        }


class WorkingHoursUpdate(BaseModel):
    monday:    Optional[DaySchedule] = None
    tuesday:   Optional[DaySchedule] = None
    wednesday: Optional[DaySchedule] = None
    thursday:  Optional[DaySchedule] = None
    friday:    Optional[DaySchedule] = None
    saturday:  Optional[DaySchedule] = None
    sunday:    Optional[DaySchedule] = None

    class Config:
        json_schema_extra = {
            "example": {
                "monday":    {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "tuesday":   {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "wednesday": {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "thursday":  {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "friday":    {"is_enabled": True,  "start_time": "09:00", "end_time": "17:00", "break_start": "12:00", "break_end": "13:00"},
                "saturday":  {"is_enabled": False, "start_time": None,    "end_time": None,    "break_start": None,    "break_end": None},
                "sunday":    {"is_enabled": False, "start_time": None,    "end_time": None,    "break_start": None,    "break_end": None}
            }
        }


class ScheduleOut(BaseModel):
    id:          int
    day:         str
    is_enabled:  bool
    start_time:  Optional[str] = None
    end_time:    Optional[str] = None
    break_start: Optional[str] = None
    break_end:   Optional[str] = None

    class Config:
        from_attributes = True

class HospitalProfileOut(BaseModel):
    org_name:     str
    email:        str
    logo_url:     Optional[str] = None
    address:      Optional[str] = None
    full_name:    Optional[str] = None
    phone_number: Optional[str] = None

    @field_validator("logo_url", mode="before")
    @classmethod
    def resolve_logo_url(cls, v):
        if not v:
            return None
        if v.startswith("data:") or v.startswith("http"):
            return v
        try:
            from .services.s3 import get_image_url
            return get_image_url(v)
        except Exception:
            return None

    class Config:
        from_attributes = True

class DoctorDaySchedule(BaseModel):
    is_enabled:   Optional[bool] = None
    start_time_1: Optional[str] = None
    end_time_1:   Optional[str] = None
    break_start:  Optional[str] = None
    break_end:    Optional[str] = None
    start_time_2: Optional[str] = None
    end_time_2:   Optional[str] = None


class DoctorScheduleUpdate(BaseModel):
    monday:    Optional[DoctorDaySchedule] = None
    tuesday:   Optional[DoctorDaySchedule] = None
    wednesday: Optional[DoctorDaySchedule] = None
    thursday:  Optional[DoctorDaySchedule] = None
    friday:    Optional[DoctorDaySchedule] = None
    saturday:  Optional[DoctorDaySchedule] = None
    sunday:    Optional[DoctorDaySchedule] = None


class DoctorScheduleOut(BaseModel):
    id:           int
    day:          str
    is_enabled:   bool
    start_time_1: Optional[str] = None
    end_time_1:   Optional[str] = None
    break_start:  Optional[str] = None
    break_end:    Optional[str] = None
    start_time_2: Optional[str] = None
    end_time_2:   Optional[str] = None

    class Config:
        from_attributes = True

class GenerateAvailabilityRequest(BaseModel):
    start_date: date
    end_date: date
    duration_minutes: int

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v):
        if v not in [15, 20, 25, 30, 35, 40, 45, 50, 55, 60]:
            raise ValueError("duration_minutes must be 15, 20, 25, 30, 35, 40, 45, 50, 55, or 60")
        return v

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be after or equal to start_date")
        if (self.end_date - self.start_date).days > 90:
            raise ValueError("Date range cannot exceed 90 days")
        return self

class DoctorFeeUpdate(BaseModel):
    fee: int

class DoctorFeeOut(BaseModel):
    doctor_user_id: int
    fee: Optional[int] = None

    class Config:
        from_attributes = True

class PatientStatusUpdate(BaseModel):
    is_active: bool

class HospitalUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None

class DoctorUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class HospitalOut(UserOut):
    address: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_address(cls, data):
        if hasattr(data, "organization") and data.organization:
            data.__dict__["address"] = data.organization.address
        return data

    class Config:
        from_attributes = True

class SessionAudioUpload(BaseModel):
    """Response after uploading offline session audio"""
    message: str
    transcript_status: str  # "completed", "pending", "failed"

class SessionVersionOut(BaseModel):
    id:             int
    session_id:     int
    version_number: int
    transcript:     Optional[str] = None
    summary:        Optional[str] = None
    soap_notes:     Optional[SOAPNote] = None
    treatment_plan: Optional[str] = None
    notes:          Optional[str] = None
    saved_by_id:    Optional[int] = None
    saved_at:       datetime

    @field_validator("soap_notes", mode="before")
    @classmethod
    def parse_soap_notes(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except Exception:
                return None
        return v

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")}

class SessionAudioListOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    session_date: datetime
    audio_url: Optional[str]
    version_number: int = Field(validation_alias="version")

    class Config:
        from_attributes = True
        populate_by_name = True

class PatientVersionHistoryOut(BaseModel):
    current_sessions: List[SessionOut]
    version_history:  List[SessionVersionOut]

# -------------------------------------------------------------------
# Theme Schemas
# -------------------------------------------------------------------

class ThemeCreate(BaseModel):
    name: str


class ThemeOut(BaseModel):
    id:              int
    name:            str
    is_default:      bool
    organization_id: Optional[int] = None

    class Config:
        from_attributes = True


# -------------------------------------------------------------------
# Session Flag Schemas
# -------------------------------------------------------------------

class SessionFlagCreate(BaseModel):
    theme_id:             int
    timestamp_seconds:    Optional[int] = None   # seconds into audio
    transcript_position:  Optional[int] = None   # character index in transcript
    note:                 Optional[str] = None


class SessionFlagOut(BaseModel):
    id:                   int
    session_id:           int
    theme_id:             int
    theme_name:           Optional[str] = None
    timestamp_seconds:    Optional[int] = None
    transcript_position:  Optional[int] = None
    note:                 Optional[str] = None
    created_at:           datetime

    @model_validator(mode="before")
    @classmethod
    def populate_theme_name(cls, data):
        if hasattr(data, "theme") and data.theme:
            data.__dict__["theme_name"] = data.theme.name
        return data

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")}


class IntakeCreate(BaseModel):
    # Section 1 — Identification
    full_name:          Optional[str] = None
    date_of_birth:      Optional[str] = None
    gender_pronouns:    Optional[str] = None
    marital_status:     Optional[str] = None
    occupation:         Optional[str] = None
    nationality:        Optional[str] = None
    place_of_residence: Optional[str] = None
    source_of_referral: Optional[str] = None
    date_of_admission:  Optional[str] = None

    # Section 2 — Presenting Complaints
    chief_complaint_patient:   Optional[str] = None
    chief_complaint_informant: Optional[str] = None
    onset_and_duration:        Optional[str] = None

    # Section 3 — History of Present Illness
    hpi_onset:              Optional[Literal["abrupt", "acute", "sub-acute", "insidious"]] = None
    hpi_course:             Optional[Literal["episodic", "continuous", "fluctuating", "progressive"]] = None
    hpi_duration:           Optional[str] = None
    hpi_precipitating:      Optional[str] = None
    hpi_symptoms:           Optional[str] = None
    hpi_treatment_received: Optional[str] = None
    hpi_impact_functioning: Optional[str] = None
    hpi_negative_history:   Optional[str] = None
    hpi_review_of_systems:  Optional[str] = None

    # Section 4 — Past Psychiatric History
    past_psych_episodes:   Optional[str] = None
    past_hospitalisations: Optional[str] = None
    past_treatments:       Optional[str] = None
    suicide_self_harm:     Optional[str] = None
    violence_history:      Optional[str] = None
    past_mh_services:      Optional[str] = None

    # Section 5 — Past Medical History
    childhood_illnesses: Optional[str] = None
    adult_illnesses:     Optional[str] = None
    surgeries:           Optional[str] = None
    current_medical:     Optional[str] = None
    allergies:           Optional[str] = None
    current_medications: Optional[str] = None

    # Section 6 — Personal History
    birth_pregnancy:          Optional[str] = None
    birth_delivery:           Optional[str] = None
    developmental_milestones: Optional[str] = None
    childhood_temperament:    Optional[str] = None
    childhood_separation:     Optional[str] = None
    childhood_abuse:          Optional[str] = None
    childhood_other:          Optional[str] = None
    childhood_neurotic:       Optional[str] = None
    education_school:         Optional[str] = None
    education_performance:    Optional[str] = None
    education_behaviour:      Optional[str] = None
    education_qualification:  Optional[str] = None
    education_relationships:  Optional[str] = None
    occupational_history:     Optional[str] = None
    occupational_other:       Optional[str] = None
    military_service:         Optional[str] = None
    relationship_history:     Optional[str] = None
    relationship_current:     Optional[str] = None
    relationship_sexual:      Optional[str] = None
    children:                 Optional[str] = None
    forensic_history:         Optional[str] = None
    financial_housing:        Optional[str] = None

    # Section 7 — Substance Use
    substance_alcohol:      Optional[str] = None
    substance_tobacco:      Optional[str] = None
    substance_other:        Optional[str] = None
    substance_prescription: Optional[str] = None
    substance_iv:           Optional[str] = None
    substance_treatment:    Optional[str] = None

    # Section 8 — Family History
    family_genogram:      Optional[str] = None
    family_structure:     Optional[str] = None
    family_psych_illness: Optional[str] = None
    family_medical:       Optional[str] = None
    family_substance:     Optional[str] = None
    family_dynamics:      Optional[str] = None
    family_suicide:       Optional[str] = None

    # Section 9 — Premorbid Personality
    premorbid_mood:          Optional[str] = None
    premorbid_traits:        Optional[str] = None
    premorbid_relationships: Optional[str] = None
    premorbid_leisure:       Optional[str] = None
    premorbid_coping:        Optional[str] = None
    premorbid_values:        Optional[str] = None
    premorbid_habits:        Optional[str] = None
    premorbid_self_concept:  Optional[str] = None
    premorbid_judgement:     Optional[str] = None

    # Section 10 — Summary
    history_summary: Optional[str] = None


class IntakeOut(IntakeCreate):
    id:            int
    patient_id:    int
    created_by_id: Optional[int] = None
    created_at:    datetime

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")}


class SessionFileUpdate(BaseModel):
    session_id:     int
    soap_notes:     Optional[SOAPNote] = None
    transcript:     Optional[str] = None
    summary:        Optional[str] = None
    treatment_plan: Optional[str] = None
    notes:          Optional[str] = None
    flags_data:     Optional[str] = None
    appointment_status: Optional[str] = None


class PatientFileUpdate(BaseModel):
    full_name:      Optional[str] = None
    date_of_birth:  Optional[date] = None
    contact_number: Optional[str] = None
    email:          Optional[str] = None
    gender:         Optional[str] = None
    address:        Optional[str] = None
    sessions:       Optional[List[SessionFileUpdate]] = None


class PatientFileOut(BaseModel):
    id:             int
    full_name:      str
    date_of_birth:  Optional[date] = None
    contact_number: Optional[str] = None
    email:          Optional[str] = None
    gender:         Optional[str] = None
    address:        Optional[str] = None
    doctor_id:      Optional[int] = None
    age:            Optional[int] = None
    is_active:      bool = True
    created_at:     datetime
    intake:         Optional[IntakeOut] = None
    sessions:       Optional[List[SessionOut]] = []

    @field_validator("contact_number", mode="before")
    @classmethod
    def populate_contact(cls, v, info):
        return v

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")}

class AppointmentStatusUpdate(BaseModel):
    status: str

class WalkInSessionCreate(BaseModel):
    full_name:      str
    contact_number: Optional[str] = None
    gender:         Optional[str] = None
    soap_notes:     Optional[SOAPNote] = None  # ← proper nested object now
    notes:          Optional[str] = None
    treatment_plan: Optional[str] = None
    time_duration:  Optional[float] = None
    flags_data:     Optional[str] = None # ← list of ints, not comma string

class WalkInSessionOut(BaseModel):
    patient_id:     int
    patient_name:   str
    contact_number: Optional[str] = None
    age:            Optional[int] = None
    session_id:     int
    session_number: int
    soap_notes:     Optional[SOAPNote] = None
    treatment_plan: Optional[str] = None
    notes:          Optional[str] = None
    flags_data:     Optional[str] = None
    transcript:     Optional[str] = None  # ← add this
    message:        str = "Walk-in session created. Patient details can be updated later."

    class Config:
        from_attributes = True