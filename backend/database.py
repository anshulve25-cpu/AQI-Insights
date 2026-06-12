from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, Integer, String, Float, DateTime
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class DroneTelemetry(Base):
    __tablename__ = "drone_telemetry"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    drone_id = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    aqi = Column(Integer)
    status = Column(String)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)