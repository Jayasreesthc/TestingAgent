import os
import asyncio
import logging
from dotenv import load_dotenv
from app import models, auth, database
from sqlalchemy.future import select

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_data():
    async with database.AsyncSessionLocal() as db:
        # Check if Super AdminOrg exists
        result = await db.execute(select(models.Organization).where(models.Organization.name == "PsycheGraph Global"))
        org = result.scalars().first()
        
        if not org:
            logger.info("Creating Global Organization...")
            org = models.Organization(name="PsycheGraph Global", license_key="GLOBAL_LICENSE")
            db.add(org)
            await db.commit()
            await db.refresh(org)
        
        # Dynamic Super Admin Credentials
        admin_email = os.getenv("SUPER_ADMIN_EMAIL", "")
        admin_password = os.getenv("SUPER_ADMIN_PASSWORD", "")

        if not admin_email or not admin_password:
            logger.error("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set in .env")
            return

        # Check if Super Admin exists
        result = await db.execute(select(models.User).where(models.User.email == admin_email))
        user = result.scalars().first()
        
        if not user:
            logger.info(f"Creating Super Admin User ({admin_email})...")
            hashed_pw = auth.get_password_hash(admin_password)
            user = models.User(
                email=admin_email,
                hashed_password=hashed_pw,
                full_name="Super Admin",
                role=models.UserRole.SUPER_ADMIN,
                organization_id=org.id
            )
            db.add(user)
            await db.commit()
            logger.info(f"Super Admin created: {admin_email}")
        else:
            logger.info("Super Admin already exists.")

if __name__ == "__main__":
    asyncio.run(init_data())
