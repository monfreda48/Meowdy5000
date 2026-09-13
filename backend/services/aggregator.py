import os
import re
import json
import sqlite3
import httpx
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from backend.adapters.rivalsdata import (
    fetch_rivalsdata_profile, resolve_player_identity, normalize_platform_code,
    PlayerNotFoundError, ProfilePrivateError
)

logger = logging.getLogger("ingestion_aggregator")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_cached_player_profile(uid: str) -> Optional[Dict[str, Any]]:
    target_uid = str(uid).strip()
    if not target_uid:
        return None

    for db_name in ['rivals.db', 'rivals_tracker.db', 'stats.db']:
        db_path = os.path.join(BASE_DIR, db_name)
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("""
                    SELECT uid, username, platform, avatar_url, level, rank, rank_points,
                           win_rate, kda, total_matches, elims, deaths, assists, time_played,
                           heroes_json, raw_payload_json, last_scraped_at
                    FROM players
                    WHERE uid = ? OR username = ?;
                """, (target_uid, target_uid))
                row = cur.fetchone()
                conn.close()
                if row:
                    data = dict(row)
                    raw_payload = data.get("raw_payload_json")
                    if raw_payload:
                        try:
                            parsed_payload = json.loads(raw_payload)
                            return parsed_payload
                        except Exception:
                            pass
                    return {
                        "current": {
                            "uid": data.get("uid"),
                            "username": data.get("username"),
                            "platform": normalize_platform_code(data.get("platform")),
                            "avatarUrl": data.get("avatar_url"),
                            "level": data.get("level") or 1,
                            "rank": data.get("rank") or "Unranked",
                            "win_rate": str(data.get("win_rate") or "0.0%"),
                            "kda": str(data.get("kda") or "0.00"),
                            "total_matches": data.get("total_matches") or 0,
                            "time_played": data.get("time_played") or "0h",
                            "scraped_at": data.get("last_scraped_at")
                        },
                        "stats": {
                            "winRate": str(data.get("win_rate") or "0.0%"),
                            "kda": str(data.get("kda") or "0.00"),
                            "matches": data.get("total_matches") or 0,
                            "timePlayed": data.get("time_played") or "0h"
                        },
                        "heroes": json.loads(data.get("heroes_json") or "[]"),
                        "source": "database_cache",
                        "scraped_at": data.get("last_scraped_at")
                    }
            except Exception as e:
                logger.debug(f"[aggregator] DB cache read error in {db_name}: {e}")
    return None

def upsert_player_profile(data: Dict[str, Any]) -> None:
    current = data.get("current") or {}
    target_uid = str(current.get("uid") or "").strip()
    username = current.get("username") or f"Player {target_uid}"
    platform = normalize_platform_code(current.get("platform"))
    avatar_url = current.get("avatarUrl") or current.get("avatar_url")
    level = current.get("level") or 1
    rank = current.get("rank") or "Unranked"
    win_rate = current.get("win_rate") or current.get("winRate") or "0.0%"
    kda = current.get("kda") or current.get("kda_ratio") or "0.00"
    total_matches = current.get("total_matches") or current.get("matchesPlayed") or 0
    time_played = current.get("time_played") or current.get("timePlayed") or "0h"
    heroes_json = json.dumps(data.get("heroes") or [])
    raw_payload_json = json.dumps(data)
    now_iso = datetime.now(timezone.utc).isoformat()

    if not target_uid:
        return

    for db_name in ['rivals.db', 'rivals_tracker.db', 'stats.db']:
        db_path = os.path.join(BASE_DIR, db_name)
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    uid TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    avatar_url TEXT,
                    level INTEGER DEFAULT 1,
                    rank TEXT DEFAULT 'Unranked',
                    rank_points INTEGER DEFAULT 0,
                    win_rate REAL DEFAULT 0.0,
                    kda REAL DEFAULT 0.0,
                    total_matches INTEGER DEFAULT 0,
                    elims INTEGER DEFAULT 0,
                    deaths INTEGER DEFAULT 0,
                    assists INTEGER DEFAULT 0,
                    time_played TEXT DEFAULT '0h',
                    heroes_json TEXT DEFAULT '[]',
                    raw_payload_json TEXT DEFAULT '{}',
                    last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("""
                INSERT INTO players (uid, username, platform, avatar_url, level, rank, win_rate, kda, total_matches, time_played, heroes_json, raw_payload_json, last_scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uid) DO UPDATE SET
                    username=excluded.username,
                    platform=excluded.platform,
                    avatar_url=excluded.avatar_url,
                    level=excluded.level,
                    rank=excluded.rank,
                    win_rate=excluded.win_rate,
                    kda=excluded.kda,
                    total_matches=excluded.total_matches,
                    time_played=excluded.time_played,
                    heroes_json=excluded.heroes_json,
                    raw_payload_json=excluded.raw_payload_json,
                    last_scraped_at=excluded.last_scraped_at;
            """, (
                target_uid,
                username,
                platform,
                avatar_url,
                level,
                rank,
                float(re.sub(r'[^0-9.]', '', str(win_rate)) or 0),
                float(re.sub(r'[^0-9.]', '', str(kda)) or 0),
                int(total_matches),
                time_played,
                heroes_json,
                raw_payload_json,
                now_iso
            ))
            conn.commit()
            conn.close()
        except Exception as err:
            logger.debug(f"[aggregator] SQLite upsert error in {db_name}: {err}")

async def get_player_profile(identifier: str, force_refresh: bool = False) -> Dict[str, Any]:
    ident = str(identifier).strip()
    if not ident:
        return {"success": False, "error": "Empty player identifier"}

    # 1. Resolve UID if non-numeric
    resolved_uid = ident
    if not re.match(r'^\d{8,12}$', ident):
        candidates = await resolve_player_identity(ident)
        if candidates and candidates[0].get("uid"):
            resolved_uid = candidates[0]["uid"]

    # 2. Check local database cache
    if not force_refresh:
        cached = get_cached_player_profile(resolved_uid)
        if cached and cached.get("current", {}).get("scraped_at"):
            return {
                "success": True,
                "data": cached,
                "source_attribution": "database_cache",
                "is_fallback": True,
                "is_stale": False,
                "scraped_at": cached.get("current", {}).get("scraped_at")
            }

    # 3. Live telemetry scrape from RivalsData
    try:
        data = await fetch_rivalsdata_profile(resolved_uid)
        upsert_player_profile(data)
        return {
            "success": True,
            "data": data,
            "source_attribution": "rivalsdata",
            "is_fallback": False,
            "is_stale": False,
            "scraped_at": data.get("scraped_at")
        }
    except PlayerNotFoundError as pnf:
        return {"success": False, "error": str(pnf), "error_code": "NOT_FOUND"}
    except ProfilePrivateError as ppe:
        return {"success": False, "error": str(ppe), "error_code": "PROFILE_PRIVATE"}
    except Exception as err:
        logger.error(f"[aggregator] Scrape error for UID '{resolved_uid}': {err}")
        cached = get_cached_player_profile(resolved_uid)
        if cached:
            return {
                "success": True,
                "data": cached,
                "source_attribution": "database_cache",
                "is_fallback": True,
                "is_stale": True
            }
        return {"success": False, "error": f"Failed to fetch profile: {err}"}
