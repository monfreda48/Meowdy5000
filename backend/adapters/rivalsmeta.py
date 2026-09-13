import os
import re
import json
import time
import sqlite3
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger("rivalsmeta_adapter")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_TTL_SECONDS = 12 * 60 * 60  # 12-hour TTL

DEFAULT_SEASON_FALLBACK = {
    "season_name": "Season 1",
    "end_timestamp": "2026-10-15T00:00:00Z",
    "days_remaining": 32,
    "upcoming_hero": "Hawkeye",
    "source": "rivalsmeta.com",
    "updated_at": datetime.now(timezone.utc).isoformat()
}

def get_cached_meta_season(db_filename: str = "rivals_tracker.db") -> Optional[Dict[str, Any]]:
    db_path = os.path.join(BASE_DIR, db_filename)
    if not os.path.exists(db_path):
        return None
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meta_cache (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at INTEGER NOT NULL
            );
        """)
        cur.execute("SELECT data, cached_at FROM meta_cache WHERE key = 'season_meta';")
        row = cur.fetchone()
        conn.close()
        if row:
            data_str, cached_at = row
            if (time.time() - cached_at) < CACHE_TTL_SECONDS:
                return json.loads(data_str)
    except Exception as e:
        logger.warning(f"Error reading meta_cache from {db_filename}: {e}")
    return None

def save_cached_meta_season(data: Dict[str, Any], db_filename: str = "rivals_tracker.db"):
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meta_cache (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at INTEGER NOT NULL
            );
        """)
        cur.execute("""
            INSERT INTO meta_cache (key, data, cached_at)
            VALUES ('season_meta', ?, ?)
            ON CONFLICT(key) DO UPDATE SET data=excluded.data, cached_at=excluded.cached_at;
        """, (json.dumps(data), int(time.time())))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Error saving meta_cache to {db_filename}: {e}")

async def fetch_rivalsmeta_season(force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh:
        for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
            cached = get_cached_meta_season(db_file)
            if cached:
                logger.info(f"Loaded valid 12h season metadata cache from {db_file}")
                return cached

    url = "https://rivalsmeta.com"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                html = res.text
                soup = BeautifulSoup(html, "html.parser")
                script_tag = soup.find("script", id="__NEXT_DATA__")

                season_name = "Season 1"
                end_timestamp = "2026-10-15T00:00:00Z"
                upcoming_hero = "Hawkeye"

                if script_tag and script_tag.string:
                    try:
                        next_data = json.loads(script_tag.string)
                        props = next_data.get("props", {}).get("pageProps", {})
                        season_name = props.get("season", {}).get("name") or props.get("seasonName") or season_name
                        end_timestamp = props.get("season", {}).get("endDate") or props.get("seasonEnd") or end_timestamp
                        upcoming_hero = props.get("season", {}).get("upcomingHero") or props.get("nextHero") or upcoming_hero
                    except Exception as json_err:
                        logger.warning(f"Failed parsing __NEXT_DATA__ from rivalsmeta: {json_err}")

                # Calculate days remaining
                try:
                    end_dt = datetime.fromisoformat(end_timestamp.replace("Z", "+00:00"))
                    now_dt = datetime.now(timezone.utc)
                    days_rem = max(0, (end_dt - now_dt).days)
                except Exception:
                    days_rem = 32

                meta_data = {
                    "season_name": season_name,
                    "end_timestamp": end_timestamp,
                    "days_remaining": days_rem,
                    "upcoming_hero": upcoming_hero,
                    "source": "rivalsmeta.com",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }

                for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
                    save_cached_meta_season(meta_data, db_file)

                return meta_data
    except Exception as err:
        logger.warning(f"RivalsMeta scraping error: {err}")

    # Return default fallback if scraping hits exception
    return DEFAULT_SEASON_FALLBACK
