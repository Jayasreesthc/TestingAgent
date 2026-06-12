# PsycheGraph System Workflow

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Roles"
        SA[SUPER_ADMIN]
        HA[HOSPITAL Admin]
        DOC[DOCTOR]
        REC[RECEPTIONIST]
    end
    
    subgraph "Core Entities"
        ORG[Organizations]
        USR[Users]
        PAT[Patients]
        SESS[Sessions]
    end
    
    SA -->|Creates & Manages| ORG
    SA -->|Creates| HA
    HA -->|Creates| DOC
    HA -->|Creates| REC
    HA -->|Manages| ORG
    REC -->|Creates & Manages| PAT
    DOC -->|Creates & Manages| SESS
    DOC -->|Views| PAT
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant API
    participant DB
    
    User->>API: POST /token (email, password)
    API->>DB: Verify credentials
    DB-->>API: User data
    API-->>User: Access Token + Refresh Token
    
    Note over User,API: Token expires after 30 minutes
    
    User->>API: POST /token/refresh (refresh_token)
    API->>API: Validate refresh token
    API-->>User: New Access Token + Refresh Token
```

## User Creation Workflow

```mermaid
flowchart TD
    Start([Start]) --> Login[Login as SUPER_ADMIN]
    Login --> CreateOrg[Create Organization]
    CreateOrg --> CreateHA[Create HOSPITAL Admin]
    CreateHA --> GetTokens[Receive Access & Refresh Tokens]
    
    GetTokens --> HALogin[Login as HOSPITAL Admin]
    HALogin --> CreateStaff{Create Staff}
    
    CreateStaff -->|Doctor| CreateDoc[Create DOCTOR]
    CreateStaff -->|Receptionist| CreateRec[Create RECEPTIONIST]
    
    CreateDoc --> DocTokens[Receive Tokens]
    CreateRec --> RecTokens[Receive Tokens]
    
    DocTokens --> End([End])
    RecTokens --> End
```

## Patient & Session Management

```mermaid
flowchart LR
    subgraph "Patient Creation"
        REC[RECEPTIONIST] -->|POST /patients| CreatePat[Create Patient]
        HA[HOSPITAL Admin] -->|POST /patients| CreatePat
    end
    
    subgraph "Session Management"
        CreatePat --> AssignDoc[Assign to Doctor]
        AssignDoc --> DOC[DOCTOR]
        DOC -->|POST /sessions| Upload[Upload Audio]
        Upload --> Process[AI Processing]
        Process --> Generate[Generate Transcript & Summary]
        Generate --> SOAP[Create SOAP Notes]
    end
    
    subgraph "Access Control"
        SOAP --> DocView[Doctor Views Own Sessions]
        SOAP --> HAView[Hospital Admin Views Org Sessions]
        SOAP --> SAView[Super Admin Views All]
    end
```

## Data Access Permissions

```mermaid
graph TD
    subgraph "SUPER_ADMIN Access"
        SA[SUPER_ADMIN] -->|Full Access| AllOrg[All Organizations]
        SA -->|Full Access| AllUsers[All Users]
        SA -->|Full Access| AllPat[All Patients]
        SA -->|Full Access| AllSess[All Sessions]
    end
    
    subgraph "HOSPITAL Admin Access"
        HA[HOSPITAL] -->|Own Only| OwnOrg[Own Organization]
        HA -->|Org Scope| OrgUsers[Organization Users]
        HA -->|Org Scope| OrgPat[Organization Patients]
        HA -->|Org Scope| OrgSess[Organization Sessions]
    end
    
    subgraph "DOCTOR Access"
        DOC[DOCTOR] -->|Assigned| AssignedPat[Assigned Patients]
        DOC -->|Own Only| OwnSess[Own Sessions]
    end
    
    subgraph "RECEPTIONIST Access"
        REC[RECEPTIONIST] -->|Org Scope| RecPat[Organization Patients]
    end
```

## API Endpoint Access Matrix

| Endpoint | SUPER_ADMIN | HOSPITAL | DOCTOR | RECEPTIONIST |
|----------|-------------|----------|--------|--------------|
| **Organizations** |
| GET /organizations/ | All | Own Only | ❌ | ❌ |
| GET /organizations/{id} | Any | Own Only | ❌ | ❌ |
| POST /organizations | ✅ | ❌ | ❌ | ❌ |
| **Users** |
| GET /users/ | All | Org Only | ❌ | ❌ |
| POST /users | ✅ | Doctors/Receptionists | ❌ | ❌ |
| **Patients** |
| GET /patients/ | All | Org Only | Org Only | Org Only |
| POST /patients/ | ✅ | ✅ | ❌ | ✅ |
| **Sessions** |
| GET /sessions/ | All | Org Only | Own Only | ❌ |
| POST /sessions/ | ❌ | ❌ | ✅ | ❌ |

## Complete User Journey

```mermaid
journey
    title Hospital Admin Journey
    section Setup
      Login as Super Admin: 5: Super Admin
      Create Organization: 5: Super Admin
      Create Hospital Admin: 5: Super Admin
      Receive Tokens: 5: Hospital Admin
    section Staff Management
      Login as Hospital Admin: 5: Hospital Admin
      View Own Organization: 5: Hospital Admin
      Create Doctors: 5: Hospital Admin
      Create Receptionists: 5: Hospital Admin
    section Patient Care
      Receptionist Creates Patient: 4: Receptionist
      Doctor Views Patients: 4: Doctor
      Doctor Creates Session: 5: Doctor
      Doctor Reviews AI Summary: 5: Doctor
    section Monitoring
      Hospital Admin Views Sessions: 4: Hospital Admin
      Super Admin Audits System: 5: Super Admin
```

## Session Processing Pipeline

```mermaid
flowchart TD
    Start([Doctor Uploads Audio]) --> Validate{Validate Patient}
    Validate -->|Invalid| Error[Return 404]
    Validate -->|Valid| CheckOrg{Check Organization}
    CheckOrg -->|Mismatch| Forbidden[Return 403]
    CheckOrg -->|Match| SaveFile[Save Audio File]
    SaveFile --> Transcribe[AI Transcription]
    Transcribe --> Translate[English Translation]
    Translate --> Summarize[Generate Summary]
    Summarize --> CreateSOAP[Create SOAP Note]
    CreateSOAP --> SaveDB[Save to Database]
    SaveDB --> Return[Return Session Data]
    Return --> End([End])
```

## Error Handling Flow

```mermaid
flowchart TD
    Request[API Request] --> Auth{Authenticated?}
    Auth -->|No| Unauth[401 Unauthorized]
    Auth -->|Yes| Role{Authorized Role?}
    Role -->|No| Forbid[403 Forbidden]
    Role -->|Yes| Validate{Valid Data?}
    Validate -->|No| BadReq[400 Bad Request]
    Validate -->|Yes| Process[Process Request]
    Process --> DBError{Database Error?}
    DBError -->|Yes| Log[Log Error]
    Log --> ServerErr[500 Internal Error]
    DBError -->|No| Success[200/201 Success]
```
