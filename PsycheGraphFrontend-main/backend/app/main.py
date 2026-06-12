import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .database import engine, Base
from .routers import auth, admin, patients, sessions, appointments, stats

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

from sqlalchemy import text

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: Create tables and repair schema (Transactional)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Auto-repair schema for 'users' table if columns are missing
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """))
        existing_columns = [row[0] for row in result.fetchall()]
        
        columns_to_add = {
            "specialization": "VARCHAR",
            "license_key": "VARCHAR",
            "shift_timing": "VARCHAR"
        }

        for col, col_type in columns_to_add.items():
            if col and col not in existing_columns:
                logger.info(f"Adding missing column '{col}' to 'users' table...")
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                
    # 2. Fix UserRole Enum if labels are missing (PostgreSQL specific - MUST BE OUTSIDE TRANSACTION)
    async with engine.connect() as conn:
        for role in ["SUPER_ADMIN", "HOSPITAL", "DOCTOR", "RECEPTIONIST"]:
            try:
                # We use AUTOCOMMIT to ensure this runs outside a transaction block
                await conn.execution_options(isolation_level="AUTOCOMMIT").execute(
                    text(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{role}'")
                )
                logger.info(f"Verified/Added UserRole: {role}")
            except Exception as e:
                # Ignore errors if not using Postgres or label already exists
                pass
                
    logger.info("Database tables verified and synchronized.")
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(lifespan=lifespan, title="PsycheGraph API")

# Logging Configuration
import sys
import traceback
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("api")

# Middleware for Logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log Request
    logger.info(f"Incoming Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} - Duration: {process_time:.4f}s")
        return response
    except Exception as exc:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {request.method} {request.url} - Duration: {process_time:.4f}s")
        logger.error(f"Error details: {str(exc)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"message": "Internal Server Error", "details": str(exc)},
        )

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
    )

# CORS
origins = [
    "http://localhost:5173",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(admin.hospital_router)
app.include_router(admin.doctor_router)
app.include_router(admin.receptionist_router)
app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(appointments.router)
app.include_router(stats.router)

@app.get("/")
def read_root():
    logger.info("Root endpoint called")
    return {"Hello": "World", "Service": "PsycheGraph Backend", "Docs": "/docs"}
