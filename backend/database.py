import os
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'rivals_tracker.db')
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    claimed_url = Column(String(500), nullable=True)
    last_scraped_at = Column(DateTime, nullable=True)
    cached_profile_json = Column(Text, nullable=True)

class SeasonCache(Base):
    __tablename__ = 'season_cache'

    id = Column(Integer, primary_key=True, autoincrement=True)
    season_number = Column(String(20), nullable=False)
    season_title = Column(String(150), nullable=False)
    days_left = Column(Integer, nullable=True)
    end_date = Column(String(50), nullable=True)
    progress_percentage = Column(Integer, nullable=True)
    new_hero_name = Column(String(100), nullable=True)
    new_hero_icon = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TrackedPlayer(Base):
    __tablename__ = 'tracked_players'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_name = Column(String(100), unique=True, index=True, nullable=False)
    profile_url = Column(String(500), nullable=False)
    platform = Column(String(20), default='pc')
    is_claimed = Column(Integer, default=1)
    last_scraped_at = Column(DateTime, default=datetime.utcnow)
    cached_stats = Column(Text, nullable=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tracked_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT UNIQUE NOT NULL,
                profile_url TEXT NOT NULL,
                platform TEXT DEFAULT 'pc',
                is_claimed INTEGER DEFAULT 1,
                last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cached_stats TEXT
            );
        """))

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

