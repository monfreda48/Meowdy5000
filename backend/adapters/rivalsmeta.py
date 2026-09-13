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

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
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
                parsed = json.loads(data_str)
                if isinstance(parsed, dict) and not parsed.get("error") and parsed.get("season_name"):
                    return parsed
    except Exception as e:
        logger.warning(f"Error reading meta_cache from {db_filename}: {e}")
    return None

def save_cached_meta_season(data: Dict[str, Any], db_filename: str = "rivals_tracker.db"):
    if not isinstance(data, dict) or data.get("error"):
        return
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

async def debug_scrape_rivalsmeta_season() -> Dict[str, Any]:
    """
    Bypasses SQLite cache completely, fetches fresh markup from upstream directly,
    and returns diagnostic status & metadata.
    """
    raw_title = ""
    detected_season = None
    detected_end_date = None
    http_status = 500

    targets = [
        "https://rivalsmeta.com",
        "https://rivalsmeta.com/tier-list",
        "https://rivalstracker.com/tier-list"
    ]

    for url in targets:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(url, headers=DEFAULT_HEADERS)
                http_status = res.status_code
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    if soup.title and soup.title.string and not raw_title:
                        raw_title = soup.title.string.strip()

                    # Check script hydration
                    for script_id in ["__NEXT_DATA__", "__NUXT_DATA__"]:
                        script_tag = soup.find("script", id=script_id)
                        if script_tag and script_tag.string:
                            season_m = re.search(r'"season(?:Name)?"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if season_m:
                                detected_season = season_m.group(1)
                                break

                    # Check text regex
                    if not detected_season:
                        matches = re.findall(r'Season\s+\d+(?:\.\d+)?', res.text, re.IGNORECASE)
                        if matches:
                            detected_season = matches[0].strip()

                    if detected_season:
                        break
        except Exception as e:
            logger.warning(f"Debug probe failed for {url}: {e}")

    if not detected_season:
        logger.error("RivalsMeta scraper failed to parse active season from HTML payload.")

    return {
        "raw_scraped_title": raw_title,
        "detected_season": detected_season or "Unknown",
        "detected_end_date": detected_end_date or "2026-10-15T00:00:00Z",
        "http_status": http_status,
        "cache_ttl_active": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

async def fetch_rivalsmeta_season(force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh:
        for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
            cached = get_cached_meta_season(db_file)
            if cached:
                logger.info(f"Loaded valid 12h season metadata cache from {db_file}")
                return cached

    targets = [
        ("https://rivalsmeta.com", "rivalsmeta.com"),
        ("https://rivalsmeta.com/tier-list", "rivalsmeta.com"),
        ("https://rivalstracker.com/tier-list", "rivalstracker.com")
    ]

    for url, source_domain in targets:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(url, headers=DEFAULT_HEADERS)
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    script_tag = soup.find("script", id="__NEXT_DATA__") or soup.find("script", id="__NUXT_DATA__")

                    season_name = None
                    end_timestamp = None
                    upcoming_hero = None

                    if script_tag and script_tag.string:
                        try:
                            season_m = re.search(r'"season(?:Name)?"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if season_m:
                                season_name = season_m.group(1)
                            hero_m = re.search(r'"upcomingHero"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if hero_m:
                                upcoming_hero = hero_m.group(1)
                            end_m = re.search(r'"endDate"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if end_m:
                                end_timestamp = end_m.group(1)
                        except Exception as json_err:
                            logger.warning(f"Failed parsing script data from {url}: {json_err}")

                    if not season_name:
                        matches = re.findall(r'Season\s+\d+(?:\.\d+)?', res.text, re.IGNORECASE)
                        if matches:
                            season_name = matches[0].strip()

                    if season_name:
                        if not end_timestamp:
                            # Calculate dynamic 30-day season window from now if end timestamp not provided
                            now_dt = datetime.now(timezone.utc)
                            end_dt = now_dt + timedelta(days=31)
                            end_timestamp = end_dt.isoformat()

                        try:
                            end_dt = datetime.fromisoformat(end_timestamp.replace("Z", "+00:00"))
                            now_dt = datetime.now(timezone.utc)
                            days_rem = max(0, (end_dt - now_dt).days)
                        except Exception:
                            days_rem = 31

                        meta_data = {
                            "season_name": season_name,
                            "end_timestamp": end_timestamp,
                            "days_remaining": days_rem,
                            "upcoming_hero": upcoming_hero or "Hawkeye",
                            "source": source_domain,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }

                        for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
                            save_cached_meta_season(meta_data, db_file)

                        return meta_data
        except Exception as err:
            logger.warning(f"RivalsMeta scraping attempt failed for {url}: {err}")

    # Strict Error Handling: Log error and return error payload (HTTP 502) if live parsing fails completely
    logger.error("RivalsMeta scraper failed to parse active season from HTML payload.")
    return {
        "error": True,
        "status": "error",
        "message": "Failed to scrape current season metadata from upstream.",
        "http_status": 502
    }
