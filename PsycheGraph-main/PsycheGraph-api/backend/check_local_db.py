import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

async def test_connection():
    # Load .env from the backend directory
    load_dotenv(".env")
    
    db_url = os.getenv("DATABASE_URL")
    print(f"DATABASE_URL: {db_url}")
    
    if not db_url:
        print("Error: DATABASE_URL not found in .env")
        return

    engine = create_async_engine(db_url)
    try:
        async with engine.connect() as conn:
            print("Successfully connected to the database!")
            result = await conn.execute(text("SELECT current_database();"))
            db_name = result.scalar()
            print(f"Current database: {db_name}")
            
            # Check if tables exist
            result = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"))
            tables = result.scalars().all()
            print(f"Tables found: {tables}")
            
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection())
