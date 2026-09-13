import os
from datetime import datetime
from typing import Optional, List, Dict, Any
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

class PlayerMap(Base):
    __tablename__ = 'player_maps'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uid = Column(String(50), index=True, nullable=False)
    map_name = Column(String(100), nullable=False)
    game_mode = Column(String(50), default='Competitive')
    matches_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    win_rate = Column(Text, default=0.0)
    attack_win_rate = Column(Text, default=0.0)
    defense_win_rate = Column(Text, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PlayerSynergy(Base):
    __tablename__ = 'player_synergy'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uid = Column(String(50), index=True, nullable=False)
    teammate_name = Column(String(100), nullable=False)
    teammate_uid = Column(String(50), nullable=True)
    matches_together = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    win_rate = Column(Text, default=0.0)
    avg_kda = Column(Text, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BugReport(Base):
    __tablename__ = 'bug_reports'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    player_uid = Column(String(50), nullable=True)
    app_version = Column(String(50), nullable=True)
    platform = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FeatureSuggestion(Base):
    __tablename__ = 'feature_suggestions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), default='General')
    player_uid = Column(String(50), nullable=True)
    app_version = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class HeroMastery(Base):
    __tablename__ = 'hero_mastery'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uid = Column(String(50), index=True, nullable=False)
    hero_name = Column(String(100), nullable=False)
    mastery_level = Column(Integer, default=1)
    current_xp = Column(Integer, default=0)
    next_level_xp = Column(Integer, default=1000)
    badge_url = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AccountConduct(Base):
    __tablename__ = 'account_conduct'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uid = Column(String(50), unique=True, nullable=False)
    conduct_rating = Column(Integer, default=100)
    status_standing = Column(String(100), default='Good Standing')
    active_penalties_json = Column(Text, default='[]')
    warning_count = Column(Integer, default=0)
    last_incident_date = Column(String(50), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GlobalTierList(Base):
    __tablename__ = 'global_tier_lists'

    id = Column(Integer, primary_key=True, autoincrement=True)
    hero_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    tier = Column(String(10), nullable=False)
    win_rate = Column(Text, default=0.0)
    pick_rate = Column(Text, default=0.0)
    source = Column(String(100), default='rivalstracker.com')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserGoal(Base):
    __tablename__ = 'user_goals'

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uid = Column(String(50), index=True, nullable=False)
    goal_id = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    current_value = Column(Text, default=0.0)
    target_value = Column(Text, default=0.0)
    is_pinned = Column(Integer, default=0)
    is_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

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
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS player_maps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                map_name TEXT NOT NULL,
                game_mode TEXT DEFAULT 'Competitive',
                matches_played INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0.0,
                attack_win_rate REAL DEFAULT 0.0,
                defense_win_rate REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, map_name, game_mode)
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS player_synergy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                teammate_name TEXT NOT NULL,
                teammate_uid TEXT,
                matches_together INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0.0,
                avg_kda REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, teammate_name)
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bug_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                player_uid TEXT,
                app_version TEXT,
                platform TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS feature_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                player_uid TEXT,
                app_version TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS hero_mastery (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                hero_name TEXT NOT NULL,
                mastery_level INTEGER DEFAULT 1,
                current_xp INTEGER DEFAULT 0,
                next_level_xp INTEGER DEFAULT 1000,
                badge_url TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, hero_name)
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS account_conduct (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT UNIQUE NOT NULL,
                conduct_rating INTEGER DEFAULT 100,
                status_standing TEXT DEFAULT 'Good Standing',
                active_penalties_json TEXT DEFAULT '[]',
                warning_count INTEGER DEFAULT 0,
                last_incident_date TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS global_tier_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hero_name TEXT NOT NULL,
                role TEXT NOT NULL,
                tier TEXT NOT NULL,
                win_rate REAL,
                pick_rate REAL,
                source TEXT DEFAULT 'rivalstracker.com',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(hero_name, source)
            );
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                goal_id TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                current_value REAL,
                target_value REAL,
                is_pinned BOOLEAN DEFAULT 0,
                is_completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, goal_id)
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
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_maps_uid ON player_maps(player_uid);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_synergy_uid ON player_synergy(player_uid);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mastery_uid ON hero_mastery(player_uid);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_tier_hero ON global_tier_lists(hero_name);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_goals_uid ON user_goals(player_uid);"))

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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS player_maps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                map_name TEXT NOT NULL,
                game_mode TEXT DEFAULT 'Competitive',
                matches_played INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0.0,
                attack_win_rate REAL DEFAULT 0.0,
                defense_win_rate REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, map_name, game_mode)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS player_synergy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                teammate_name TEXT NOT NULL,
                teammate_uid TEXT,
                matches_together INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                losses INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0.0,
                avg_kda REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, teammate_name)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bug_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                player_uid TEXT,
                app_version TEXT,
                platform TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS feature_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT DEFAULT 'General',
                player_uid TEXT,
                app_version TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS hero_mastery (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                hero_name TEXT NOT NULL,
                mastery_level INTEGER DEFAULT 1,
                current_xp INTEGER DEFAULT 0,
                next_level_xp INTEGER DEFAULT 1000,
                badge_url TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, hero_name)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS account_conduct (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT UNIQUE NOT NULL,
                conduct_rating INTEGER DEFAULT 100,
                status_standing TEXT DEFAULT 'Good Standing',
                active_penalties_json TEXT DEFAULT '[]',
                warning_count INTEGER DEFAULT 0,
                last_incident_date TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS global_tier_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hero_name TEXT NOT NULL,
                role TEXT NOT NULL,
                tier TEXT NOT NULL,
                win_rate REAL,
                pick_rate REAL,
                source TEXT DEFAULT 'rivalstracker.com',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(hero_name, source)
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS user_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_uid TEXT NOT NULL,
                goal_id TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                current_value REAL,
                target_value REAL,
                is_pinned BOOLEAN DEFAULT 0,
                is_completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_uid, goal_id)
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
        cur.execute("CREATE INDEX IF NOT EXISTS idx_maps_uid ON player_maps(player_uid);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_synergy_uid ON player_synergy(player_uid);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_mastery_uid ON hero_mastery(player_uid);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tier_hero ON global_tier_lists(hero_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_user_goals_uid ON user_goals(player_uid);")
        conn.commit()
        conn.close()
    except Exception:
        pass

for db_name in ['rivals.db', 'rivals_tracker.db', 'stats.db']:
    migrate_sqlite_db_file(db_name)

def upsert_player_map(player_uid: str, map_name: str, game_mode: str, matches_played: int, wins: int, losses: int, win_rate: float, attack_win_rate: float = 0.0, defense_win_rate: float = 0.0, db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO player_maps (player_uid, map_name, game_mode, matches_played, wins, losses, win_rate, attack_win_rate, defense_win_rate, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(player_uid, map_name, game_mode) DO UPDATE SET
                matches_played=excluded.matches_played,
                wins=excluded.wins,
                losses=excluded.losses,
                win_rate=excluded.win_rate,
                attack_win_rate=excluded.attack_win_rate,
                defense_win_rate=excluded.defense_win_rate,
                updated_at=CURRENT_TIMESTAMP;
        """, (player_uid, map_name, game_mode, matches_played, wins, losses, win_rate, attack_win_rate, defense_win_rate))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_player_map failed for {player_uid} on {map_name}: {e}")

def upsert_player_synergy(player_uid: str, teammate_name: str, teammate_uid: Optional[str], matches_together: int, wins: int, losses: int, win_rate: float, avg_kda: float, db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO player_synergy (player_uid, teammate_name, teammate_uid, matches_together, wins, losses, win_rate, avg_kda, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(player_uid, teammate_name) DO UPDATE SET
                matches_together=excluded.matches_together,
                wins=excluded.wins,
                losses=excluded.losses,
                win_rate=excluded.win_rate,
                avg_kda=excluded.avg_kda,
                updated_at=CURRENT_TIMESTAMP;
        """, (player_uid, teammate_name, teammate_uid or "", matches_together, wins, losses, win_rate, avg_kda))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_player_synergy failed for {player_uid} with {teammate_name}: {e}")

def save_bug_report(title: str, description: str, player_uid: Optional[str] = None, app_version: Optional[str] = None, platform: Optional[str] = None, db_filename: str = "rivals_tracker.db") -> int:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bug_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            player_uid TEXT,
            app_version TEXT,
            platform TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        INSERT INTO bug_reports (title, description, player_uid, app_version, platform, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (title, description, player_uid, app_version, platform))
    report_id = cur.lastrowid
    conn.commit()
    conn.close()
    return report_id

def save_feature_suggestion(title: str, description: str, category: str = "General", player_uid: Optional[str] = None, app_version: Optional[str] = None, db_filename: str = "rivals_tracker.db") -> int:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS feature_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            player_uid TEXT,
            app_version TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("""
        INSERT INTO feature_suggestions (title, description, category, player_uid, app_version, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (title, description, category, player_uid, app_version))
    suggestion_id = cur.lastrowid
    conn.commit()
    conn.close()
    return suggestion_id

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

def upsert_hero_mastery(player_uid: str, hero_name: str, mastery_level: int = 1, current_xp: int = 0, next_level_xp: int = 1000, badge_url: Optional[str] = None, db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO hero_mastery (player_uid, hero_name, mastery_level, current_xp, next_level_xp, badge_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(player_uid, hero_name) DO UPDATE SET
                mastery_level=excluded.mastery_level,
                current_xp=excluded.current_xp,
                next_level_xp=excluded.next_level_xp,
                badge_url=excluded.badge_url,
                updated_at=CURRENT_TIMESTAMP;
        """, (player_uid, hero_name, mastery_level, current_xp, next_level_xp, badge_url or ""))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_hero_mastery failed for {player_uid} - {hero_name}: {e}")

def get_hero_mastery_from_db(player_uid: str, db_filename: str = "rivals_tracker.db") -> List[Dict[str, Any]]:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    results = []
    if not os.path.exists(db_path):
        return results
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT player_uid, hero_name, mastery_level, current_xp, next_level_xp, badge_url, updated_at
            FROM hero_mastery
            WHERE player_uid = ?
            ORDER BY mastery_level DESC, current_xp DESC;
        """, (player_uid,))
        rows = cur.fetchall()
        for r in rows:
            results.append(dict(r))
        conn.close()
    except Exception as e:
        print(f"[DB Error] get_hero_mastery_from_db failed for {player_uid}: {e}")
    return results

def upsert_account_conduct(player_uid: str, conduct_rating: int = 100, status_standing: str = "Good Standing", active_penalties_json: str = "[]", warning_count: int = 0, last_incident_date: Optional[str] = None, db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO account_conduct (player_uid, conduct_rating, status_standing, active_penalties_json, warning_count, last_incident_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(player_uid) DO UPDATE SET
                conduct_rating=excluded.conduct_rating,
                status_standing=excluded.status_standing,
                active_penalties_json=excluded.active_penalties_json,
                warning_count=excluded.warning_count,
                last_incident_date=excluded.last_incident_date,
                updated_at=CURRENT_TIMESTAMP;
        """, (player_uid, conduct_rating, status_standing, active_penalties_json, warning_count, last_incident_date or ""))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_account_conduct failed for {player_uid}: {e}")

def get_account_conduct_from_db(player_uid: str, db_filename: str = "rivals_tracker.db") -> Dict[str, Any]:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    default_record = {
        "player_uid": player_uid,
        "conduct_rating": 100,
        "status_standing": "Good Standing",
        "active_penalties": [],
        "warning_count": 0,
        "last_incident_date": None
    }
    if not os.path.exists(db_path):
        return default_record
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT player_uid, conduct_rating, status_standing, active_penalties_json, warning_count, last_incident_date, updated_at
            FROM account_conduct
            WHERE player_uid = ?;
        """, (player_uid,))
        row = cur.fetchone()
        conn.close()
        if row:
            data = dict(row)
            try:
                data["active_penalties"] = json.loads(data.get("active_penalties_json") or "[]")
            except Exception:
                data["active_penalties"] = []
            return data
    except Exception as e:
        print(f"[DB Error] get_account_conduct_from_db failed for {player_uid}: {e}")
    return default_record

def upsert_global_tier_list(hero_name: str, role: str, tier: str, win_rate: float, pick_rate: float, source: str = "rivalstracker.com", db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO global_tier_lists (hero_name, role, tier, win_rate, pick_rate, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(hero_name, source) DO UPDATE SET
                role=excluded.role,
                tier=excluded.tier,
                win_rate=excluded.win_rate,
                pick_rate=excluded.pick_rate,
                updated_at=CURRENT_TIMESTAMP;
        """, (hero_name, role, tier, win_rate, pick_rate, source))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_global_tier_list failed for {hero_name}: {e}")

def get_global_tier_lists_from_db(source: str = "rivalstracker.com", db_filename: str = "rivals_tracker.db") -> List[Dict[str, Any]]:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    results = []
    if not os.path.exists(db_path):
        return results
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT hero_name, role, tier, win_rate, pick_rate, source, updated_at
            FROM global_tier_lists
            WHERE source = ?
            ORDER BY 
              CASE tier 
                WHEN 'S+' THEN 1 
                WHEN 'S' THEN 2 
                WHEN 'A' THEN 3 
                WHEN 'B' THEN 4 
                WHEN 'C' THEN 5 
                ELSE 6 
              END, win_rate DESC;
        """, (source,))
        rows = cur.fetchall()
        for r in rows:
            results.append(dict(r))
        conn.close()
    except Exception as e:
        print(f"[DB Error] get_global_tier_lists_from_db failed for {source}: {e}")
    return results

def upsert_user_goal_pin(player_uid: str, goal_id: str, is_pinned: bool, title: str = "", category: str = "", current_value: float = 0.0, target_value: float = 0.0, db_filename: str = "rivals_tracker.db"):
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_goals (player_uid, goal_id, title, category, current_value, target_value, is_pinned, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(player_uid, goal_id) DO UPDATE SET
                is_pinned=excluded.is_pinned,
                title=CASE WHEN excluded.title != '' THEN excluded.title ELSE user_goals.title END,
                category=CASE WHEN excluded.category != '' THEN excluded.category ELSE user_goals.category END,
                current_value=excluded.current_value,
                target_value=excluded.target_value;
        """, (player_uid, goal_id, title, category, current_value, target_value, 1 if is_pinned else 0))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB Error] upsert_user_goal_pin failed for {player_uid} - {goal_id}: {e}")

def get_user_goals_state(player_uid: str, db_filename: str = "rivals_tracker.db") -> Dict[str, Dict[str, Any]]:
    import sqlite3
    db_path = os.path.join(BASE_DIR, db_filename)
    results = {}
    if not os.path.exists(db_path):
        return results
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("""
            SELECT goal_id, title, category, current_value, target_value, is_pinned, is_completed
            FROM user_goals
            WHERE player_uid = ?;
        """, (player_uid,))
        rows = cur.fetchall()
        for r in rows:
            d = dict(r)
            results[d["goal_id"]] = {
                "is_pinned": bool(d.get("is_pinned")),
                "is_completed": bool(d.get("is_completed"))
            }
        conn.close()
    except Exception as e:
        print(f"[DB Error] get_user_goals_state failed for {player_uid}: {e}")
    return results




