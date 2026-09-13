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
    uid = Column(String(50), unique=True, index=True, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    level = Column(Integer, nullable=True)

class Player(Base):
    __tablename__ = 'players'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), index=True, nullable=False)
    uid = Column(String(50), unique=True, index=True, nullable=True)
    platform = Column(String(20), index=True, default='pc')
    avatar_url = Column(String(500), nullable=True)
    level = Column(Integer, nullable=True)
    profile_url = Column(String(500), nullable=True)
    last_scraped_at = Column(DateTime, default=datetime.utcnow)
    cached_stats = Column(Text, nullable=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                uid TEXT UNIQUE,
                platform TEXT DEFAULT 'pc',
                avatar_url TEXT,
                level INTEGER,
                profile_url TEXT,
                last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cached_stats TEXT
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tracked_players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT UNIQUE NOT NULL,
                profile_url TEXT NOT NULL,
                platform TEXT DEFAULT 'pc',
                is_claimed INTEGER DEFAULT 1,
                last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cached_stats TEXT,
                uid TEXT UNIQUE,
                avatar_url TEXT,
                level INTEGER
            );
        """))

        for tbl in ['players', 'tracked_players']:
            try:
                res = await conn.execute(text(f"PRAGMA table_info({tbl});"))
                existing_cols = {row[1] for row in res.fetchall()}
                if 'uid' not in existing_cols:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN uid TEXT;"))
                if 'platform' not in existing_cols:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN platform TEXT DEFAULT 'pc';"))
                if 'avatar_url' not in existing_cols:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN avatar_url TEXT;"))
                if 'level' not in existing_cols:
                    await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN level INTEGER;"))
            except Exception:
                pass

        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_player_platform ON players(platform);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_player_uid ON players(uid);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tracked_platform ON tracked_players(platform);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tracked_uid ON tracked_players(uid);"))

def migrate_sqlite_db_file(db_filename):
    import sqlite3
    db_file_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_file_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                uid TEXT UNIQUE,
                platform TEXT DEFAULT 'pc',
                avatar_url TEXT,
                level INTEGER,
                profile_url TEXT,
                last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cached_stats TEXT
            );
        """)
        for tbl in ['players', 'tracked_players']:
            try:
                cur.execute(f"PRAGMA table_info({tbl});")
                existing_cols = {row[1] for row in cur.fetchall()}
                if 'uid' not in existing_cols:
                    cur.execute(f"ALTER TABLE {tbl} ADD COLUMN uid TEXT;")
                if 'platform' not in existing_cols:
                    cur.execute(f"ALTER TABLE {tbl} ADD COLUMN platform TEXT DEFAULT 'pc';")
                if 'avatar_url' not in existing_cols:
                    cur.execute(f"ALTER TABLE {tbl} ADD COLUMN avatar_url TEXT;")
                if 'level' not in existing_cols:
                    cur.execute(f"ALTER TABLE {tbl} ADD COLUMN level INTEGER;")
            except Exception:
                pass
        cur.execute("CREATE INDEX IF NOT EXISTS idx_player_platform ON players(platform);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_player_uid ON players(uid);")
        conn.commit()
        conn.close()
    except Exception:
        pass

for db_name in ['rivals.db', 'rivals_tracker.db', 'stats.db']:
    migrate_sqlite_db_file(db_name)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

