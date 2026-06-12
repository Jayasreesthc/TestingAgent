"""
Creates the super admin user in the users table.
Run once from the backend directory:
    python create_superadmin.py
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv
from passlib.context import CryptContext
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_async_engine(DATABASE_URL, echo=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def run():
    hashed_password = pwd_context.hash("Admin@123")

    async with engine.begin() as conn:
        # Check if already exists
        result = await conn.execute(
            text("SELECT id FROM users WHERE email = 'superadmin@gmail.com'")
        )
        if result.fetchone():
            print("⚠️  Super admin already exists.")
            return

        await conn.execute(text("""
            INSERT INTO users (email, hashed_password, role, is_active)
            VALUES ('superadmin@gmail.com', :pwd, 'SUPER_ADMIN', true)
        """), {"pwd": hashed_password})

    print("✅ Super admin created successfully!")
    print("   Email   : superadmin@gmail.com")
    print("   Password: Admin@123")

if __name__ == "__main__":
    asyncio.run(run())