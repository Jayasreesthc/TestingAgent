import os
import logging
import sys
import traceback
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text

from .database import engine, Base
from .routers import auth, admin, patients, sessions, appointments, stats, working_hours, doctor_schedule, flags, intake
from .services.audio import audio_router

# Load .env from the backend directory explicitly
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("api")


MIGRATIONS = [
    ("add_org_email",           "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email VARCHAR;"),
    ("add_org_is_approved",     "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;"),
    ("drop_org_license_not_null","ALTER TABLE organizations ALTER COLUMN license_key DROP NOT NULL;"),
    ("add_avail_org_id",        "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"),
    ("add_avail_created_by",    "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);"),
    ("add_avail_created_at",    "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE;"),
    ("add_avail_patient_name",  "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"),
    ("add_avail_doctor_name",   "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"),
    ("add_avail_org_name",      "ALTER TABLE availabilities ADD COLUMN IF NOT EXISTS organization_name VARCHAR;"),
    ("add_apt_org_id",          "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);"),
    ("add_apt_patient_name",    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_name VARCHAR;"),
    ("add_apt_patient_age",     "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_age INTEGER;"),
    ("add_apt_doctor_name",     "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_name VARCHAR;"),
    ("add_apt_booked_by_role",  "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booked_by_role VARCHAR;"),
    ("add_apt_meet_link",       "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link VARCHAR;"),
    ("drop_users_specialization",        "ALTER TABLE users DROP COLUMN IF EXISTS specialization;"),
    ("drop_doctors_specialization",      "ALTER TABLE doctors DROP COLUMN IF EXISTS specialization;"),
    ("drop_receptionists_specialization","ALTER TABLE receptionists DROP COLUMN IF EXISTS specialization;"),
    ("drop_idx_doctor_specialization",   "DROP INDEX IF EXISTS idx_doctor_specialization;"),
    ("create_doctors_table",
        "CREATE TABLE IF NOT EXISTS doctors ("
        "id SERIAL PRIMARY KEY, "
        "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
        "full_name VARCHAR NOT NULL, "
        "created_by_id INTEGER REFERENCES users(id), "
        "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"),
    ("create_receptionists_table",
        "CREATE TABLE IF NOT EXISTS receptionists ("
        "id SERIAL PRIMARY KEY, "
        "user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), "
        "full_name VARCHAR, "
        "shift_timing VARCHAR, "
        "doctor_ids INTEGER[], "
        "created_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"),

    ("create_doctor_schedules_table", """
        CREATE TABLE IF NOT EXISTS doctor_schedules (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        day VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT FALSE,  -- ← was TRUE, now FALSE
        start_time_1 VARCHAR,
        end_time_1 VARCHAR,
        break_start VARCHAR,
        break_end VARCHAR,
        start_time_2 VARCHAR,
        end_time_2 VARCHAR,
        CONSTRAINT uq_doctor_schedule_day UNIQUE (doctor_id, day)
        );"""),

    ("create_session_versions_table", """
    CREATE TABLE IF NOT EXISTS session_versions (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        transcript TEXT,
        summary TEXT,
        soap_notes TEXT,
        treatment_plan TEXT,
        saved_by_id INTEGER REFERENCES users(id),
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );"""),
    ("idx_session_versions_session_id", "CREATE INDEX IF NOT EXISTS idx_session_versions_session_id ON session_versions(session_id);"),
    
    ("add_rec_doctor_ids",        "ALTER TABLE receptionists ADD COLUMN IF NOT EXISTS doctor_ids INTEGER[];"),
    ("add_session_treatment_plan", "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS treatment_plan TEXT;"),
    ("drop_receptionist_doctors", "DROP TABLE IF EXISTS receptionist_doctors;"),
    ("idx_org_email",             "CREATE INDEX IF NOT EXISTS idx_org_email ON organizations(email);"),
    ("idx_org_is_approved",       "CREATE INDEX IF NOT EXISTS idx_org_is_approved ON organizations(is_approved);"),
    ("idx_org_is_active",         "CREATE INDEX IF NOT EXISTS idx_org_is_active ON organizations(is_active);"),
    ("idx_patient_created_by",    "CREATE INDEX IF NOT EXISTS idx_patient_created_by ON patients(created_by_id);"),
    ("idx_patient_is_active",     "CREATE INDEX IF NOT EXISTS idx_patient_is_active ON patients(is_active);"),
    ("idx_apt_start_time",        "CREATE INDEX IF NOT EXISTS idx_apt_start_time ON appointments(start_time);"),
    ("idx_apt_availability",      "CREATE INDEX IF NOT EXISTS idx_apt_availability ON appointments(availability_id);"),
    ("idx_apt_created_by",        "CREATE INDEX IF NOT EXISTS idx_apt_created_by ON appointments(created_by_id);"),
    ("idx_apt_doctor_status",     "CREATE INDEX IF NOT EXISTS idx_apt_doctor_status ON appointments(doctor_id, status);"),
    ("idx_apt_org_status",        "CREATE INDEX IF NOT EXISTS idx_apt_org_status ON appointments(organization_id, status);"),
    ("idx_apt_patient_status",    "CREATE INDEX IF NOT EXISTS idx_apt_patient_status ON appointments(patient_id, status);"),
    ("idx_apt_date_status",       "CREATE INDEX IF NOT EXISTS idx_apt_date_status ON appointments(appointment_date, status);"),
    ("idx_avail_org_booked",      "CREATE INDEX IF NOT EXISTS idx_avail_org_booked ON availabilities(organization_id, is_booked);"),
    ("idx_avail_doctor_booked",   "CREATE INDEX IF NOT EXISTS idx_avail_doctor_booked ON availabilities(doctor_id, is_booked);"),
    ("idx_session_date",          "CREATE INDEX IF NOT EXISTS idx_session_date ON sessions(session_date);"),
    ("idx_session_appointment",   "CREATE INDEX IF NOT EXISTS idx_session_appointment ON sessions(appointment_id);"),
    ("idx_session_created_by",    "CREATE INDEX IF NOT EXISTS idx_session_created_by ON sessions(created_by_id);"),
    ("idx_doctor_user_id",        "CREATE INDEX IF NOT EXISTS idx_doctor_user_id ON doctors(user_id);"),
    ("idx_receptionist_user_id",  "CREATE INDEX IF NOT EXISTS idx_receptionist_user_id ON receptionists(user_id);"),
    ("idx_receptionist_doctor_ids_gin",
        "CREATE INDEX IF NOT EXISTS idx_receptionist_doctor_ids ON receptionists USING GIN (doctor_ids);"),
    ("add_user_phone_number",   "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;"),
    ("add_org_logo_url",        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url VARCHAR;"),
    ("add_org_address",         "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address VARCHAR;"),
    ("add_doctor_fee", "ALTER TABLE doctors ADD COLUMN IF NOT EXISTS fee INTEGER;"),
    ("add_appointment_booking_type", "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_type VARCHAR DEFAULT 'online';"),
    ("add_org_pending_name",  "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_name VARCHAR;"),
    ("add_org_pending_phone", "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_phone VARCHAR;"),
    ("add_appointment_fee", "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS fee INTEGER;"),
    ("add_user_description", "ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;"),
    ("add_user_address", "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR;"),
    ("add_audio_url_to_session_versions", "ALTER TABLE session_versions ADD COLUMN IF NOT EXISTS audio_url TEXT;"),
    ("add_session_notes", "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;"),
    ("create_org_schedules_table",
        "CREATE TABLE IF NOT EXISTS organization_schedules ("
        "id SERIAL PRIMARY KEY, "
        "organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, "
        "day VARCHAR NOT NULL, "
        "is_enabled BOOLEAN NOT NULL DEFAULT FALSE, "
        "start_time VARCHAR, "
        "end_time VARCHAR, "
        "break_start VARCHAR, "
        "break_end VARCHAR"
        ");"),
    ("idx_org_schedules_org_id", "CREATE INDEX IF NOT EXISTS idx_org_schedules_org_id ON organization_schedules(organization_id);"),
    ("uq_org_schedule_day",      "CREATE UNIQUE INDEX IF NOT EXISTS uq_org_schedule_day ON organization_schedules(organization_id, day);"),
    ("make_patient_doctor_id_nullable", "ALTER TABLE patients ALTER COLUMN doctor_id DROP NOT NULL;"),
    ("drop_user_shift_timing",         "ALTER TABLE users DROP COLUMN IF EXISTS shift_timing;"),
    ("drop_receptionist_shift_timing", "ALTER TABLE receptionists DROP COLUMN IF EXISTS shift_timing;"),
    ("alter_org_logo_url_to_text", "ALTER TABLE organizations ALTER COLUMN logo_url TYPE TEXT;"),
    ("backfill_doctor_schedules", """
        INSERT INTO doctor_schedules (doctor_id, day, is_enabled, start_time_1, end_time_1, break_start, break_end, start_time_2, end_time_2)
        SELECT 
           d.id,
           unnest(ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
           false, NULL, NULL, NULL, NULL, NULL, NULL
        FROM doctors d
        WHERE d.id NOT IN (SELECT DISTINCT doctor_id FROM doctor_schedules)
        ON CONFLICT ON CONSTRAINT uq_doctor_schedule_day DO NOTHING;
    """),

    ("reset_doctor_schedule_times", """
        UPDATE doctor_schedules SET
            is_enabled   = false,
            start_time_1 = NULL,
            end_time_1   = NULL,
            break_start  = NULL,
            break_end    = NULL,
            start_time_2 = NULL,
            end_time_2   = NULL;
    """),

    ("add_session_number_column",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_number INTEGER;"
    ),
    ("backfill_session_numbers", """
        UPDATE sessions s
        SET session_number = sub.rn
        FROM (
            SELECT id,
                ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY session_date ASC) AS rn
            FROM sessions
        ) sub
        WHERE s.id = sub.id
        AND s.session_number IS NULL;
    """),
    ("add_session_version_notes","ALTER TABLE session_versions ADD COLUMN IF NOT EXISTS notes TEXT;"),
    ("add_patient_documents_column", "ALTER TABLE patients ADD COLUMN IF NOT EXISTS documents TEXT[];"),
    ("add_patient_is_active_column", "ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"),
    ("add_patient_age_column", "ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INTEGER;"),
    ("add_patient_age_backfill", "UPDATE patients SET age = EXTRACT(YEAR FROM age(current_date, date_of_birth)) WHERE date_of_birth IS NOT NULL;"),
    ("add_patient_documents_index", "CREATE INDEX IF NOT EXISTS idx_patient_documents ON patients USING GIN (documents);"),
    ("create_themes_table", """
    CREATE TABLE IF NOT EXISTS themes (
        id              SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        created_by_id   INTEGER REFERENCES users(id),
        name            VARCHAR NOT NULL,
        is_default      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT now());
     """),
    ("idx_themes_org_id",
    "CREATE INDEX IF NOT EXISTS idx_themes_org_id ON themes(organization_id);"
    ),
    ("create_session_flags_table", """
    CREATE TABLE IF NOT EXISTS session_flags (
        id                   SERIAL PRIMARY KEY,
        session_id           INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        theme_id             INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
        timestamp_seconds    INTEGER,
        transcript_position  INTEGER,
        note                 TEXT,
        created_by_id        INTEGER REFERENCES users(id),
        created_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    """),
    ("idx_session_flags_session_id","CREATE INDEX IF NOT EXISTS idx_session_flags_session_id ON session_flags(session_id);"),
    ("idx_session_flags_theme_id","CREATE INDEX IF NOT EXISTS idx_session_flags_theme_id ON session_flags(theme_id);"),
    ("seed_default_themes", """
    INSERT INTO themes (name, is_default, organization_id, created_by_id)
    VALUES
        ('Anxiety',           TRUE, NULL, NULL),
        ('Depression',        TRUE, NULL, NULL),
        ('Trauma',            TRUE, NULL, NULL),
        ('Grief',             TRUE, NULL, NULL),
        ('Anger',             TRUE, NULL, NULL),
        ('Relationship',      TRUE, NULL, NULL),
        ('Self-esteem',       TRUE, NULL, NULL),
        ('Suicidal ideation', TRUE, NULL, NULL),
        ('Substance use',     TRUE, NULL, NULL),
        ('Family conflict',   TRUE, NULL, NULL)
    ON CONFLICT DO NOTHING;
    """),
    ("create_patient_intakes_table", """
    CREATE TABLE IF NOT EXISTS patient_intakes (
        id                       SERIAL PRIMARY KEY,
        patient_id               INTEGER UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        created_by_id            INTEGER REFERENCES users(id),
        created_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),

        -- Section 1: Identification
        full_name                VARCHAR,
        date_of_birth            VARCHAR,
        gender_pronouns          VARCHAR,
        marital_status           VARCHAR,
        occupation               VARCHAR,
        nationality              VARCHAR,
        place_of_residence       VARCHAR,
        source_of_referral       VARCHAR,
        date_of_admission        VARCHAR,

        -- Section 2: Presenting Complaints
        chief_complaint_patient   TEXT,
        chief_complaint_informant TEXT,
        onset_and_duration        TEXT,

        -- Section 3: History of Present Illness
        hpi_onset              VARCHAR,
        hpi_course             VARCHAR,
        hpi_duration           VARCHAR,
        hpi_precipitating      TEXT,
        hpi_symptoms           TEXT,
        hpi_treatment_received TEXT,
        hpi_impact_functioning TEXT,
        hpi_negative_history   TEXT,
        hpi_review_of_systems  TEXT,

        -- Section 4: Past Psychiatric History
        past_psych_episodes   TEXT,
        past_hospitalisations TEXT,
        past_treatments       TEXT,
        suicide_self_harm     TEXT,
        violence_history      TEXT,
        past_mh_services      TEXT,

        -- Section 5: Past Medical History
        childhood_illnesses TEXT,
        adult_illnesses     TEXT,
        surgeries           TEXT,
        current_medical     TEXT,
        allergies           TEXT,
        current_medications TEXT,

        -- Section 6: Personal History
        birth_pregnancy          TEXT,
        birth_delivery           TEXT,
        developmental_milestones TEXT,
        childhood_temperament    TEXT,
        childhood_separation     TEXT,
        childhood_abuse          TEXT,
        childhood_other          TEXT,
        childhood_neurotic       TEXT,
        education_school         TEXT,
        education_performance    TEXT,
        education_behaviour      TEXT,
        education_qualification  TEXT,
        education_relationships  TEXT,
        occupational_history     TEXT,
        occupational_other       TEXT,
        military_service         TEXT,
        relationship_history     TEXT,
        relationship_current     TEXT,
        relationship_sexual      TEXT,
        children                 TEXT,
        forensic_history         TEXT,
        financial_housing        TEXT,

        -- Section 7: Substance Use
        substance_alcohol      TEXT,
        substance_tobacco      TEXT,
        substance_other        TEXT,
        substance_prescription TEXT,
        substance_iv           TEXT,
        substance_treatment    TEXT,

        -- Section 8: Family History
        family_genogram      TEXT,
        family_structure     TEXT,
        family_psych_illness TEXT,
        family_medical       TEXT,
        family_substance     TEXT,
        family_dynamics      TEXT,
        family_suicide       TEXT,

        -- Section 9: Premorbid Personality
        premorbid_mood          TEXT,
        premorbid_traits        TEXT,
        premorbid_relationships TEXT,
        premorbid_leisure       TEXT,
        premorbid_coping        TEXT,
        premorbid_values        TEXT,
        premorbid_habits        TEXT,
        premorbid_self_concept  TEXT,
        premorbid_judgement     TEXT,

        -- Section 10: Summary
        history_summary TEXT
    );"""),
    ("idx_patient_intakes_patient_id","CREATE INDEX IF NOT EXISTS idx_patient_intakes_patient_id ON patient_intakes(patient_id);"),
    ("add_session_flags_data","ALTER TABLE sessions ADD COLUMN IF NOT EXISTS flags_data TEXT;"
),


]


async def run_migrations(conn):
    # Ensure tracking table exists
    await conn.execute(text(
        "CREATE TABLE IF NOT EXISTS migrations_log ("
        "  migration_id VARCHAR PRIMARY KEY,"
        "  applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()"
        ");"
    ))

    # Get already-applied migrations
    result = await conn.execute(text("SELECT migration_id FROM migrations_log;"))
    applied = {row[0] for row in result.fetchall()}

    pending = [(mid, sql) for mid, sql in MIGRATIONS if mid not in applied]

    if not pending:
        logger.info(f"All {len(MIGRATIONS)} migrations already applied — skipping.")
        return

    logger.info(f"Applying {len(pending)} pending migration(s)...")

    succeeded = []
    for migration_id, sql in pending:
        # Each migration gets its own savepoint so one failure never aborts the rest
        await conn.execute(text(f"SAVEPOINT mig_{migration_id};"))
        try:
            await conn.execute(text(sql))
            await conn.execute(text(f"RELEASE SAVEPOINT mig_{migration_id};"))
            succeeded.append(migration_id)
            logger.info(f"  ✓ {migration_id}")
        except Exception as e:
            await conn.execute(text(f"ROLLBACK TO SAVEPOINT mig_{migration_id};"))
            logger.warning(f"  ✗ {migration_id} skipped: {e}")

    # Record all succeeded migrations in one bulk insert
    if succeeded:
        placeholders = ", ".join(f"(:id_{i})" for i in range(len(succeeded)))
        params = {f"id_{i}": mid for i, mid in enumerate(succeeded)}
        await conn.execute(
            text(f"INSERT INTO migrations_log (migration_id) VALUES {placeholders} ON CONFLICT DO NOTHING;"),
            params
        )
        logger.info(f"Migrations complete: {len(succeeded)} applied.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_migrations(conn)

    logger.info("Database ready.")
    yield

    await engine.dispose()


app = FastAPI(lifespan=lifespan, title="PsycheGraph API")


# ── Request logging middleware ─────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} - Duration: {process_time:.4f}s")
        return response
    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {request.method} {request.url} - Duration: {process_time:.4f}s")
        logger.error(f"Error: {str(exc)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error"},
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
    )


# ── CORS ───────────────────────────────────────────────────────────────────

origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://52.66.143.164",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(admin.hospital_router)
app.include_router(admin.hospital_profile_router)
app.include_router(admin.doctor_router)
app.include_router(admin.receptionist_router)
app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(appointments.router)
app.include_router(stats.router)
app.include_router(working_hours.router)
app.include_router(doctor_schedule.router)
app.include_router(audio_router)
app.include_router(flags.router)
app.include_router(intake.router)


@app.get("/")
def read_root():
    logger.info("Root endpoint called")
    return {"Hello": "World", "Service": "PsycheGraph Backend", "Docs": "/docs"}