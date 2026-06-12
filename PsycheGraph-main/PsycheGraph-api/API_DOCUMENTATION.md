# PsycheGraph Backend API Documentation

This document provides details on the available API endpoints and example requests.
**Base URL**: `http://localhost:8000`
**Interactive Docs**: `http://localhost:8000/docs`

## Roles & Permissions
- **SUPER_ADMIN**: Manages Organizations. Can create Hospital Admins.
- **HOSPITAL**: Manages their own Organization. Can create Doctors and Receptionists.
- **DOCTOR**: Manages Patients and Sessions.
- **RECEPTIONIST**: Manages Patients.

---

## 1. Authentication

### Login (Get Token)
**POST** `/token`
- **Body** (`application/json`):
```json
{
  "email": "user@example.com",
  "password": "secretparams"
}
```
**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "refresh_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer"
}
```

### Refresh Access Token
**POST** `/token/refresh`
- **Body** (`application/json`):
```json
{
  "refresh_token": "YOUR_REFRESH_TOKEN"
}
```

---

## 2. Admin & User Management

### Create Organization (Super Admin Only)
**POST** `/organizations`
- **Headers**: `Authorization: Bearer <SUPER_ADMIN_TOKEN>`
- **Body**:
```json
{
  "name": "City Hospital",
  "license_key": "CITY-HOSP-001"
}
```

### Get Organizations
**GET** `/organizations/`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Access**:
    - **SUPER_ADMIN**: Views all organizations
    - **HOSPITAL**: Views only their own organization

### Get Organization by ID
**GET** `/organizations/{id}`
- **Headers**: `Authorization: Bearer <TOKEN>`
- **Access**:
    - **SUPER_ADMIN**: Can view any organization
    - **HOSPITAL**: Can only view their own organization

### Create User (Hospital Admin / Doctor / Receptionist)
**POST** `/users`
- **Headers**: `Authorization: Bearer <TOKEN>`
    - **Super Admin** creates **Hospital Admin**.
    - **Hospital Admin** creates **Doctor** or **Receptionist**.
- **Body**:
```json
{
  "email": "admin@cityhospital.com",
  "full_name": "Hospital Administrator",
  "role": "HOSPITAL",
  "password": "securepassword123",
  "organization_id": 1
}
```
**Response (Includes Tokens for the new user)**:
```json
{
  "id": 5,
  "email": "admin@cityhospital.com",
  "role": "HOSPITAL",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Get Users
**GET** `/users/`
- **Headers**: `Authorization: Bearer <TOKEN>`
- Returns list of users. Hospital Admins only see users in their organization.

### Update User
**PUT** `/users/{id}`
- **Body**: Fields to update (e.g., `is_active`, `full_name`).

### Delete User
**DELETE** `/users/{id}`

---

## 3. Patient Management

### Create Patient
**POST** `/patients/`
- **Headers**: `Authorization: Bearer <RECEPTIONIST_TOKEN>` or `<HOSPITAL_TOKEN>`
- **Body**:
```json
{
  "full_name": "John Doe",
  "date_of_birth": "1990-05-20T00:00:00",
  "contact_number": "+1234567890",
  "email": "john.doe@example.com"
}
```

### Get Patients
**GET** `/patients/`
- Returns all patients in the user's organization.

### Update/Delete Patient
- **PUT** `/patients/{id}`
- **DELETE** `/patients/{id}`

---

## 4. Session Management

### Create Session (Upload Audio)
**POST** `/sessions/`
- **Headers**: `Authorization: Bearer <DOCTOR_TOKEN>`
- **Body** (Multipart Form Data):
    - `patient_id`: `1` (Integer)
    - `file`: (Select Audio File)
**Response**: Contains initial transcript and summary (if processed).

### Get Sessions
**GET** `/sessions/`
- Optional Query Param: `?patient_id=1`
- Doctors see their own sessions.

### Get Session Details
**GET** `/sessions/{id}`

### Update Session (Notes)
**PUT** `/sessions/{id}`
- **Headers**: `Authorization: Bearer <DOCTOR_TOKEN>`
- **Body**:
```json
{
  "soap_note": "Updated subjective notes...",
  "summary": "Revised summary..."
}
```

### Delete Session
**DELETE** `/sessions/{id}`
