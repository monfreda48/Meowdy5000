import re
import os
import sqlite3
import urllib.parse
import httpx
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("player_resolver")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def normalize_platform(platform_input: Optional[str]) -> str:
    if not platform_input:
        return 'pc'
    p = str(platform_input).strip().lower()
    if p in ['steam', 'windows', 'pc', 'battlenet', 'epic', 'desktop']:
        return 'pc'
    if p in ['playstation', 'ps5', 'ps4', 'psn', 'ps']:
        return 'psn'
    if p in ['xbox', 'xbl', 'seriesx', 'seriess', 'xb', 'xboxone']:
        return 'xbox'
    return 'pc'

async def resolve_player_query(query: str) -> Dict[str, Any]:
    clean_query = query.strip()
    if not clean_query:
        return {
            "query": "",
            "requires_disambiguation": False,
            "candidates": []
        }

    # 1. Direct Numeric UID Detection
    if re.match(r'^\d{8,12}$', clean_query):
        return {
            "query": clean_query,
            "requires_disambiguation": False,
            "candidates": [{
                "uid": clean_query,
                "username": f"Player {clean_query}",
                "platform": "pc",
                "level": None,
                "avatar_url": None,
                "rank": "Unranked",
                "source": "direct_uid"
            }]
        }

    candidates: List[Dict[str, Any]] = []

    # 2. Local Database Lookup (SQLite)
    for db_name in ['rivals_tracker.db', 'stats.db', 'rivals.db']:
        db_path = os.path.join(BASE_DIR, db_name)
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                # Check players table
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='players';")
                if cur.fetchone():
                    cur.execute("SELECT username, uid, platform, avatar_url, level FROM players WHERE LOWER(username) LIKE LOWER(?) OR uid = ?", (f"%{clean_query}%", clean_query))
                    for row in cur.fetchall():
                        candidates.append({
                            "uid": row[1] or "",
                            "username": row[0],
                            "platform": normalize_platform(row[2]),
                            "avatar_url": row[3] or "",
                            "level": row[4],
                            "rank": "Tracked",
                            "source": "local_db"
                        })
                # Check tracked_players table
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tracked_players';")
                if cur.fetchone():
                    cur.execute("SELECT player_name, uid, platform, avatar_url, level FROM tracked_players WHERE LOWER(player_name) LIKE LOWER(?) OR uid = ?", (f"%{clean_query}%", clean_query))
                    for row in cur.fetchall():
                        candidates.append({
                            "uid": row[1] or "",
                            "username": row[0],
                            "platform": normalize_platform(row[2]),
                            "avatar_url": row[3] or "",
                            "level": row[4],
                            "rank": "Tracked",
                            "source": "local_db"
                        })
                conn.close()
            except Exception as db_err:
                logger.warning(f"Local DB candidate search error in {db_name}: {db_err}")

    # 3. External API Search Interception (Tracker.gg / RivalsData)
    try:
        search_url = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/search?q={urllib.parse.quote(clean_query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            res = await client.get(search_url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                results = data.get("data", [])
                for item in results:
                    candidates.append({
                        "uid": str(item.get("platformUserId") or item.get("platformUserIdentifier") or ""),
                        "username": item.get("platformUserHandle") or item.get("platformUserIdentifier") or clean_query,
                        "platform": normalize_platform(item.get("platformSlug") or item.get("platform")),
                        "avatar_url": item.get("avatarUrl") or "",
                        "level": item.get("level"),
                        "rank": item.get("status") or "Public Profile",
                        "source": "tracker_api"
                    })
    except Exception as api_err:
        logger.warning(f"Tracker API search error: {api_err}")

    # 4. Deduplicate Candidates by (username, platform, uid)
    seen = set()
    unique_candidates = []
    for c in candidates:
        u_name = c.get("username", "").strip().lower()
        plat = c.get("platform", "pc")
        uid_val = c.get("uid", "").strip()
        key = (u_name, plat, uid_val)
        if key not in seen:
            seen.add(key)
            unique_candidates.append(c)

    # 5. Multi-platform Synthetic Candidates Fallback
    # If single search returned without distinct platforms, synthesize candidate choices if input looks like multi-platform handle
    if not unique_candidates:
        unique_candidates = [{
            "uid": "",
            "username": clean_query,
            "platform": "pc",
            "level": None,
            "avatar_url": None,
            "rank": "Public Profile",
            "source": "fallback"
        }]

    # Determine Disambiguation Requirement
    # Disambiguation is required if there are multiple candidates across different platforms or UIDs
    distinct_platforms = {c["platform"] for c in unique_candidates}
    distinct_uids = {c["uid"] for c in unique_candidates if c.get("uid")}
    requires_disambiguation = len(unique_candidates) > 1 or len(distinct_platforms) > 1 or len(distinct_uids) > 1

    return {
        "query": clean_query,
        "requires_disambiguation": requires_disambiguation,
        "candidates": unique_candidates
    }
