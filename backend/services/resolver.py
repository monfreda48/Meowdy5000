import os
import re
import urllib.parse
import sqlite3
import logging
from typing import Dict, Any, List, Optional
from backend.services.stealth_fetcher import fetch_profile_html
from backend.database import get_connection

logger = logging.getLogger("resolver")

UID_CACHE = {}

def get_cached_uid(identifier: str) -> Optional[str]:
    clean = identifier.strip().lower()
    if clean in UID_CACHE:
        return UID_CACHE[clean]
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("CREATE TABLE IF NOT EXISTS identity_cache (username TEXT PRIMARY KEY, uid TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
            row = cursor.execute("SELECT uid FROM identity_cache WHERE LOWER(username) = ?", (clean,)).fetchone()
            if row and row[0]:
                UID_CACHE[clean] = str(row[0])
                return str(row[0])
    except Exception as e:
        logger.debug(f"[resolver] Cache query error: {e}")
    return None

def save_cached_uid(identifier: str, uid: str):
    clean = identifier.strip().lower()
    if not clean or not uid:
        return
    UID_CACHE[clean] = str(uid).strip()
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS identity_cache (username TEXT PRIMARY KEY, uid TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            """)
            cursor.execute("""
                INSERT INTO identity_cache (username, uid) VALUES (?, ?)
                ON CONFLICT(username) DO UPDATE SET uid=excluded.uid, updated_at=CURRENT_TIMESTAMP;
            """, (clean, str(uid).strip()))
            conn.commit()
    except Exception as e:
        logger.debug(f"[resolver] Cache save error: {e}")

async def resolve_canonical_uid(identifier: str) -> str:
    clean_id = str(identifier).strip()
    if not clean_id:
        return clean_id

    if clean_id.isdigit():
        return clean_id

    # 1. Check local SQLite cache first
    cached = get_cached_uid(clean_id)
    if cached:
        print(f"[RESOLVER CACHE] Found cached UID {cached} for '{clean_id}'")
        return cached

    encoded_id = urllib.parse.quote(clean_id, safe="")
    target_url = f"https://rivalsdata.com/player/{encoded_id}"

    print(f"[RESOLVER] Fetching RivalsData via stealth fetcher for '{clean_id}'...")
    try:
        html = await fetch_profile_html(target_url)
        if html and len(html) > 500:
            # Extraction Strategy A: Canonical tag or og:url with /player/{digits}
            url_match = re.search(r'rivalsdata\.com/player/(\d{7,10})', html)
            if url_match:
                uid = url_match.group(1)
                save_cached_uid(clean_id, uid)
                print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {uid} via canonical metadata")
                return uid

            # Extraction Strategy B: Embedded JSON / state script
            body_match = re.search(r'["\'](?:player_id|uid|id)["\']:\s*["\']?(\d{7,10})["\']?', html)
            if body_match:
                uid = body_match.group(1)
                save_cached_uid(clean_id, uid)
                print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {uid} via embedded JSON")
                return uid

            # Extraction Strategy C: Profile links
            link_match = re.search(r'/player/(\d{7,10})', html)
            if link_match:
                uid = link_match.group(1)
                save_cached_uid(clean_id, uid)
                print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {uid} via internal link")
                return uid
        else:
            print(f"[RESOLVER WARNING] Stealth fetch returned empty/short HTML for {target_url}")
    except Exception as e:
        print(f"[RESOLVER ERROR] Stealth resolution failed for '{clean_id}': {e}")

    # 2. Fallback Strategy: Scrape RivalsTracker Search if RivalsData fails
    try:
        rt_search_url = f"https://rivalstracker.com/profile/{encoded_id}"
        print(f"[RESOLVER FALLBACK] Fetching RivalsTracker for '{clean_id}'...")
        rt_html = await fetch_profile_html(rt_search_url)
        if rt_html and len(rt_html) > 500:
            match = re.search(r'rivalstracker\.com/profile/(\d{7,10})', rt_html) or re.search(r'/profile/(\d{7,10})', rt_html)
            if match:
                uid = match.group(1)
                save_cached_uid(clean_id, uid)
                print(f"[RESOLVER SUCCESS] Resolved '{clean_id}' -> UID {uid} via RivalsTracker fallback")
                return uid
    except Exception as err:
        print(f"[RESOLVER FALLBACK ERROR] RivalsTracker fallback failed for '{clean_id}': {err}")

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
