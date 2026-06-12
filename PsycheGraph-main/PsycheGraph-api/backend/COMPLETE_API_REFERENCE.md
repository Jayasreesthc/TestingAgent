# PsycheGraph - Complete API Reference (with Authorization Status)

This document categorizes all API endpoints into **Public** (No Auth required) and **Authorized** (Requires Bearer Token).

---

## 🔐 1. Authentication & Registration (Public)
*These endpoints do not require a token.*

### [POST] `/auth/token`
- **Status**: 🔓 Public
- **Request/Response**: Standard login flow.

### [POST] `/auth/token/refresh`
- **Status**: 🔓 Public
- **Description**: Uses refresh token to get new access token.

### [POST] `/auth/login/hospital`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Hospital Admins.

### [POST] `/auth/login/doctor`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Doctors.

### [POST] `/auth/login/receptionist`
- **Status**: 🔓 Public
- **Description**: Dedicated login for Receptionists.

### [POST] `/auth/register/hospital`
- **Status**: 🔓 Public
- **Description**: Registration for Hospital Admins using License Key.

### [POST] `/auth/register/doctor`
- **Status**: 🔓 Public
- **Description**: Registration for Doctors using License Key.

### [POST] `/auth/register/receptionist`
- **Status**: 🔓 Public
- **Description**: Registration for Receptionists using License Key.

---

## 🏥 2. Admin & Organization Management (Authorized)
*Requires: Authorization: Bearer <token>*

### [POST] `/admin/organizations`
- **Status**: 🔐 Authorized (SUPER_ADMIN)

### [GET] `/admin/organizations`
- **Status**: 🔐 Authorized (SUPER_ADMIN / HOSPITAL)

### [GET/PUT/DELETE] `/admin/organizations/{org_id}`
- **Status**: 🔐 Authorized

### [GET/PUT/DELETE] `/admin/hospitals`
- **Status**: 🔐 Authorized

### [POST/GET] `/admin/doctors`
- **Status**: � Authorized

### [POST/GET] `/admin/receptionists`
- **Status**: 🔐 Authorized

---

## 👥 3. Patient Management (Authorized)
*Requires: Authorization: Bearer <token>*

## 👥 3. Patient Management (Authorized)
*Requires: Authorization: Bearer <token>*

### [POST] `/patients/`
- **Status**: 🔐 Authorized
- **Description**: Register a new patient.
- **Request Body**:
  ```json
  {
    "full_name": "John Doe",
    "date_of_birth": "1990-05-15T00:00:00",
    "contact_number": "9876543210",
    "email": "john.doe@example.com",
    "organization_id": 1  // Optional if user is Org Admin
  }
  ```
- **Response**:
  ```json
  {
    "full_name": "John Doe",
    "date_of_birth": "1990-05-15T00:00:00",
    "contact_number": "9876543210",
    "email": "john.doe@example.com",
    "id": 15,
    "organization_id": 1,
    "doctor_id": null,
    "created_at": "2026-02-11T10:00:00.000000"
  }
  ```

### [GET] `/patients`
- **Status**: 🔐 Authorized
- **Description**: Get list of patients (Doctors see assigned/all, Receptionists see created/all).
- **Response**: Array of Patient objects (see above).

### [GET/PUT/DELETE] `/patients/{patient_id}`
- **Status**: 🔐 Authorized
- **Description**: Manage specific patient details.

---

## 📅 5. Appointments & Scheduling

### [POST] `/appointments/availability`
- **Status**: 🔐 Authorized (Doctors/Receptionists)
- **Description**: Create a **single** availability slot.
- **Request Body**:
  ```json
  {
    "start_time": "2026-02-12T09:00:00",
    "end_time": "2026-02-12T09:15:00",
    "doctor_id": 5,
    "organization_id": 1 // Optional
  }
  ```
- **Response**:
  ```json
  {
    "start_time": "2026-02-12T09:00:00",
    "end_time": "2026-02-12T09:15:00",
    "id": 101,
    "doctor_id": 5,
    "organization_id": 1,
    "is_booked": false
  }
  ```

### [POST] `/appointments/availability/batch` **(NEW)**
- **Status**: � Authorized
- **Description**: Create **multiple** slots at once (e.g., 9 AM to 5 PM in 15-min intervals).
- **Request Body**:
  ```json
  {
    "doctor_id": 5,
    "organization_id": 1, // Optional
    "start_time": "2026-02-12T09:00:00",
    "end_time": "2026-02-12T17:00:00",
    "duration_minutes": 15
  }
  ```
- **Response**: Array of created Availability objects.

### [GET] `/appointments/availability`
- **Status**: 🔓 Public
- **Description**: Fetch available slots. Now supports date filtering.
- **Query Parameters**:
    - `doctor_id` (int, optional)
    - `organization_id` (int, optional)
    - `start_date` (datetime, optional) - *e.g., 2026-02-12T00:00:00*
    - `end_date` (datetime, optional) - *e.g., 2026-02-12T23:59:59*
- **Response**: Array of Availability objects.

### [POST] `/appointments/book`
- **Status**: 🔐 Authorized
- **Description**: Book a specific slot for a patient.
- **Request Body**:
  ```json
  {
    "patient_id": 15,
    "doctor_id": 5,
    "start_time": "2026-02-12T09:00:00", // Must match slot
    "end_time": "2026-02-12T09:15:00",   // Must match slot
    "availability_id": 101,              // ID of the slot
    "notes": "Regular checkup"
  }
  ```
- **Response**:
  ```json
  {
    "patient_id": 15,
    "doctor_id": 5,
    "start_time": "2026-02-12T09:00:00",
    "end_time": "2026-02-12T09:15:00",
    "notes": "Regular checkup",
    "meet_link": "https://meet.psychegraph.com/101-15",
    "id": 501,
    "status": "SCHEDULED",
    "organization_id": 1
  }
  ```

### [GET] `/appointments`
- **Status**: 🔐 Authorized
- **Description**: List all appointments for the current user's role.

---

## 📈 6. Stats & Root

### [GET] `/stats/`
- **Status**: 🔐 Authorized
- **Description**: Role-based analytics.

### [GET] `/`
- **Status**: 🔓 Public
- **Description**: Root health check.
