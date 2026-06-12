from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    HOSPITAL = "HOSPITAL"
    DOCTOR = "DOCTOR"
    RECEPTIONIST = "RECEPTIONIST"

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    license_key = Column(String, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="organization")
    patients = relationship("Patient", back_populates="organization")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(Enum(UserRole))
    is_active = Column(Boolean, default=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True) # Super Admin might be null
    
    # Role-specific fields
    specialization = Column(String, nullable=True)
    license_key = Column(String, nullable=True)
    shift_timing = Column(String, nullable=True)
    
    organization = relationship("Organization", back_populates="users")
    # For doctors
    patients = relationship("Patient", back_populates="doctor", foreign_keys="[Patient.doctor_id]") 
    appointments_as_doctor = relationship("Appointment", back_populates="doctor")
    sessions = relationship("Session", back_populates="doctor", foreign_keys="[Session.doctor_id]")
    
    # Tracking record creation
    patients_created = relationship("Patient", back_populates="created_by", foreign_keys="[Patient.created_by_id]")
    sessions_created = relationship("Session", back_populates="created_by", foreign_keys="[Session.created_by_id]")

    # One-to-One relationships
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    receptionist_profile = relationship("Receptionist", back_populates="user", uselist=False, foreign_keys="[Receptionist.id]")
    assigned_receptionists = relationship(
    "Receptionist",
    foreign_keys="[Receptionist.doctor_id]",
    back_populates="doctor"
)

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    specialization = Column(String)
    license_key = Column(String, nullable=True) # Personal license

    user = relationship("User", back_populates="doctor_profile")

class Receptionist(Base):
    __tablename__ = "receptionists"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    specialization = Column(String, nullable=True)
    shift_timing = Column(String)

    # NEW FIELD
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="receptionist_profile", foreign_keys=[id])
    doctor = relationship("User", foreign_keys=[doctor_id])


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    date_of_birth = Column(DateTime)
    contact_number = Column(String)
    email = Column(String, nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Assigned doctor
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Who registered the patient
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    organization = relationship("Organization", back_populates="patients")
    doctor = relationship("User", back_populates="patients", foreign_keys=[doctor_id])
    created_by = relationship("User", back_populates="patients_created", foreign_keys=[created_by_id])
    appointments = relationship("Appointment", back_populates="patient")
    sessions = relationship("Session", back_populates="patient")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="SCHEDULED") # SCHEDULED, COMPLETED, CANCELLED
    notes = Column(Text, nullable=True)
    meet_link = Column(String, nullable=True)
    
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("User", back_populates="appointments_as_doctor")

class Availability(Base):
    __tablename__ = "availabilities"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    is_booked = Column(Boolean, default=False)

    doctor = relationship("User", backref="availability_slots")
    organization = relationship("Organization")

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Who created the session
    date = Column(DateTime, default=datetime.utcnow)
    
    audio_url = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    soap_note = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    
    # Versioning could be a separate table, but for simplicity we keep last version here + audit logs for changes
    version = Column(Integer, default=1)
    
    patient = relationship("Patient", back_populates="sessions")
    doctor = relationship("User", back_populates="sessions", foreign_keys=[doctor_id])
    created_by = relationship("User", back_populates="sessions_created", foreign_keys=[created_by_id])

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String) # CREATE, READ, UPDATE, DELETE
    resource_type = Column(String) # PATIENT, SESSION, USER
    resource_id = Column(Integer)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
