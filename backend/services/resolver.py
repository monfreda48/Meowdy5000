import os
import re
import json
import urllib.parse
import httpx
import sqlite3
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("resolver")

UID_CACHE = {}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def get_cached_uid(identifier: str, db_filename: str = "rivals_tracker.db") -> Optional[str]:
    clean_id = identifier.strip().lower()
    if clean_id in UID_CACHE:
        return UID_CACHE[clean_id]
    db_path = os.path.join(BASE_DIR, db_filename) if not os.path.isabs(db_filename) else db_filename
    if not os.path.exists(db_path):
        return None
    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT uid FROM players WHERE LOWER(username) = ? AND uid IS NOT NULL AND uid != '' LIMIT 1",
                (clean_id,)
            )
            row = cursor.fetchone()
            if row and row[0]:
                UID_CACHE[clean_id] = str(row[0])
                return str(row[0])
    except Exception as e:
        logger.debug(f"[resolver] Cache query error: {e}")
    return None

def cache_resolved_identity(username: str, uid: str, db_filename: str = "rivals_tracker.db"):
    clean_user = username.strip()
    if not clean_user or not uid:
        return
    UID_CACHE[clean_user.lower()] = str(uid)
    db_path = os.path.join(BASE_DIR, db_filename) if not os.path.isabs(db_filename) else db_filename
    try:
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO players (uid, username, last_scraped_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(uid) DO UPDATE SET username = excluded.username;
                """,
                (str(uid), clean_user)
            )
            conn.commit()
    except Exception as e:
        logger.debug(f"[resolver] Cache save error: {e}")

async def resolve_canonical_uid(identifier: str) -> str:
    clean_id = str(identifier).strip()
    if not clean_id:
        return clean_id

    # 1. If already a numeric UID, return immediately
    if clean_id.isdigit():
        return clean_id

    lower_id = clean_id.lower()
    if lower_id in UID_CACHE:
        return UID_CACHE[lower_id]

    # Check local database cache
    cached = get_cached_uid(clean_id)
    if cached:
        return cached

    # URL-encode the username so spaces do not crash httpx
    encoded_id = urllib.parse.quote(clean_id, safe="")
    target_url = f"https://rivalsdata.com/player/{encoded_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=headers)
            if resp.status_code == 200:
                # 1. Check redirected URL pattern: /player/(\d+)
                url_match = re.search(r"/player/(\d+)", str(resp.url))
                if url_match:
                    resolved_uid = url_match.group(1)
                    UID_CACHE[lower_id] = resolved_uid
                    cache_resolved_identity(clean_id, resolved_uid)
                    print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {resolved_uid} via URL redirect")
                    return resolved_uid

                # 2. Check JSON/HTML body metadata
                body_match = re.search(r'["\'](?:player_id|uid)["\']:\s*["\']?(\d{7,10})["\']?', resp.text)
                if body_match:
                    resolved_uid = body_match.group(1)
                    UID_CACHE[lower_id] = resolved_uid
                    cache_resolved_identity(clean_id, resolved_uid)
                    print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {resolved_uid} via body metadata")
                    return resolved_uid
            else:
                print(f"[RESOLVER WARNING] RivalsData returned HTTP {resp.status_code} for {target_url}")
    except Exception as e:
        print(f"[RESOLVER ERROR] Failed to resolve '{clean_id}': {e}")

    return clean_id

async def resolve_player_query(query: str) -> Dict[str, Any]:
    clean_query = query.strip()
    if not clean_query:
        return {
            "query": "",
            "requires_disambiguation": False,
            "candidates": []
        }
    
    uid = await resolve_canonical_uid(clean_query)
    candidates = [{"uid": uid, "username": clean_query, "platform": "ps5"}]
    return {
        "query": clean_query,
        "requires_disambiguation": False,
        "candidates": candidates
    }
