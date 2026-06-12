# PsycheGraph - API Documentation

Detailed Request and Response formats for all major endpoints.

## Base URL
`http://127.0.0.1:8000`

---

## 1. Authentication

### [POST] `/auth/token`
**Description**: Standard login to get access and refresh tokens.
**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response (UserWithToken)**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "SUPER_ADMIN",
  "is_active": true,
  "organization_id": null,
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "token_type": "bearer"
}
```

### [POST] `/auth/login/{role}`
**Path Params**: `role` (hospital, doctor, receptionist)
**Description**: Dedicated login for specific roles. Fails if user role does not match.
**Request**: Same as `/auth/token`.
**Response**: Same as `UserWithToken`.

---

## 2. Registration

### [POST] `/auth/register/hospital`
**Request**:
```json
{
  "email": "admin@hospital.com",
  "password": "password123",
  "full_name": "Hospital Admin",
  "license_key": "ORG_LICENSE_XYZ"
}
```
**Response (RegisterResponse)**:
```json
{
  "message": "hospital registered successfully",
  "user_id": 2,
  "organization_id": 5
}
```

### [POST] `/auth/register/doctor`
**Request**:
```json
{
  "email": "doctor@hospital.com",
  "password": "password123",
  "full_name": "Dr. Smith",
  "license_key": "ORG_LICENSE_XYZ",
  "specialization": "Psychiatry"
}
```
**Response**: Same as `RegisterResponse`.

### [POST] `/auth/register/receptionist`
**Request**:
```json
{
  "email": "recep@hospital.com",
  "password": "password123",
  "full_name": "Receptionist Jane",
  "license_key": "ORG_LICENSE_XYZ",
  "specialization": "Administration",
  "shift_timing": "9 AM - 5 PM"
}
```
**Response**: Same as `RegisterResponse`.

---

## 3. Patient Management

### [GET] `/patients/`
**Response**: `List[PatientOut]`
```json
[
  {
    "full_name": "Patient Name",
    "date_of_birth": "1990-01-01T00:00:00",
    "contact_number": "1234567890",
    "email": "patient@email.com",
    "id": 1,
    "organization_id": 5,
    "doctor_id": null,
    "created_at": "2024-02-10T12:00:00"
  }
]
```

---

## 4. Scheduling & Appointments

### [POST] `/appointments/availability`
**Request**:
```json
{
  "doctor_id": 2,
  "start_time": "2024-02-12T10:00:00",
  "end_time": "2024-02-12T10:30:00"
}
```
**Response (AvailabilityOut)**:
```json
{
  "id": 101,
  "doctor_id": 2,
  "organization_id": 5,
  "start_time": "2024-02-12T10:00:00",
  "end_time": "2024-02-12T10:30:00",
  "is_booked": false
}
```

### [POST] `/appointments/book`
**Request (AppointmentCreate)**:
```json
{
  "availability_id": 101,
  "patient_id": 1,
  "doctor_id": 2,
  "start_time": "2024-02-12T10:00:00",
  "end_time": "2024-02-12T10:30:00",
  "notes": "Follow-up",
  "meet_link": "https://meet.google.com/..."
}
```
**Response (AppointmentOut)**:
```json
{
  "id": 50,
  "status": "BOOKED",
  "organization_id": 5,
  "patient_id": 1,
  "doctor_id": 2,
  "start_time": "2024-02-12T10:00:00",
  "end_time": "2024-02-12T10:30:00",
  "notes": "Follow-up",
  "meet_link": "https://meet.google.com/..."
}
```

---

## 5. Stats & Dashboard

### [GET] `/stats/`
**Description**: Returns dynamic stats based on the role of the logged-in user.
**Response**:
```json
[
  {
    "label": "Total Organizations",
    "value": "12",
    "type": "orgs"
  },
  {
    "label": "Global Users",
    "value": "150",
    "type": "users"
  }
]
```
*(Labels and values vary by user role: Hospital Admins see medical staff/patient counts; Doctors see patient/session counts).*
