import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.database import DATABASE_URL

async def add_column():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE receptionists ADD COLUMN doctor_id INTEGER REFERENCES users(id)"))
            print("Successfully added doctor_id column to receptionists table")
        except Exception as e:
            print(f"Error (maybe column already exists): {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(add_column())
