import re
import urllib.parse
import sqlite3
from typing import Optional, Dict, Tuple
from backend.database import get_connection
from backend.services.stealth_fetcher import fetch_profile_html

class IdentityManager:
    @staticmethod
    def init_db():
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS identity_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL COLLATE NOCASE,
                    uid TEXT NOT NULL,
                    platform TEXT DEFAULT 'psn',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(username),
                    UNIQUE(uid)
                );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ident_user ON identity_cache(username COLLATE NOCASE);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ident_uid ON identity_cache(uid);")
            
            # Seed default identity link
            cursor.execute("""
                INSERT INTO identity_cache (username, uid, platform)
                VALUES ('Meowdy 5000', '70463344', 'psn')
                ON CONFLICT(username) DO UPDATE SET uid='70463344', updated_at=CURRENT_TIMESTAMP;
            """)
            conn.commit()

    @classmethod
    def get_by_username(cls, username: str) -> Optional[Tuple[str, str]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute(
                "SELECT username, uid FROM identity_cache WHERE LOWER(username) = ?",
                (username.strip().lower(),)
            ).fetchone()
            return (row[0], row[1]) if row else None

    @classmethod
    def get_by_uid(cls, uid: str) -> Optional[Tuple[str, str]]:
        with get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute(
                "SELECT username, uid FROM identity_cache WHERE uid = ?",
                (str(uid).strip(),)
            ).fetchone()
            return (row[0], row[1]) if row else None

    @classmethod
    def link_identity(cls, username: str, uid: str, platform: str = "psn"):
        u_clean = username.strip()
        uid_clean = str(uid).strip()
        if not u_clean or not uid_clean:
            return

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO identity_cache (username, uid, platform)
                VALUES (?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET 
                    uid=excluded.uid,
                    platform=excluded.platform,
                    updated_at=CURRENT_TIMESTAMP;
            """, (u_clean, uid_clean, platform))
            conn.commit()
            print(f"[IDENTITY] Successfully linked '{u_clean}' <===> UID '{uid_clean}'")

    @classmethod
    async def resolve_identity(cls, identifier: str) -> Dict[str, str]:
        cls.init_db()
        raw_input = str(identifier).strip()
        is_numeric = raw_input.isdigit()

        # PATH A: Input is a numeric UID -> Resolve Username
        if is_numeric:
            cached = cls.get_by_uid(raw_input)
            if cached:
                return {"uid": raw_input, "username": cached[0]}

            print(f"[IDENTITY] Resolving username for UID {raw_input} via RivalsMeta...")
            try:
                url = f"https://rivalsmeta.com/player/{raw_input}"
                html = await fetch_profile_html(url)
                if html:
                    title_match = re.search(r'<title>([^<]+?)\s*(?:Profile|–|-)\s*Marvel Rivals', html, re.IGNORECASE)
                    name_match = re.search(r'<h1[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)</h1>', html, re.IGNORECASE)
                    
                    resolved_name = None
                    if name_match:
                        resolved_name = name_match.group(1).strip()
                    elif title_match:
                        resolved_name = title_match.group(1).strip()

                    if resolved_name and "rivals" not in resolved_name.lower():
                        cls.link_identity(resolved_name, raw_input)
                        return {"uid": raw_input, "username": resolved_name}
            except Exception as e:
                print(f"[IDENTITY ERROR] RivalsMeta reverse lookup failed: {e}")

            # Fallback: Check RivalsTracker
            try:
                rt_url = f"https://rivalstracker.com/profile/{raw_input}"
                rt_html = await fetch_profile_html(rt_url)
                if rt_html:
                    m = re.search(r'<div[^>]*class="informations"[^>]*><h1[^>]*>([^<]+)', rt_html)
                    if m:
                        resolved_name = m.group(1).strip()
                        cls.link_identity(resolved_name, raw_input)
                        return {"uid": raw_input, "username": resolved_name}
            except Exception:
                pass

            return {"uid": raw_input, "username": raw_input}

        # PATH B: Input is a Username -> Resolve UID via RivalsMeta
        cached = cls.get_by_username(raw_input)
        if cached:
            return {"uid": cached[1], "username": cached[0]}

        print(f"[IDENTITY] Resolving UID for username '{raw_input}' via RivalsMeta...")
        encoded = urllib.parse.quote(raw_input, safe="")

        try:
            probe_urls = [
                f"https://rivalsmeta.com/player/{encoded}",
                f"https://rivalsmeta.com/search?q={encoded}"
            ]
            for url in probe_urls:
                html = await fetch_profile_html(url)
                if not html or len(html) < 200:
                    continue

                # Strategy 1: Canonical or profile URL link (/player/12345678)
                url_match = re.search(r'rivalsmeta\.com/player/(\d{7,10})', html) or re.search(r'/player/(\d{7,10})', html)
                if url_match:
                    found_uid = url_match.group(1)
                    cls.link_identity(raw_input, found_uid)
                    return {"uid": found_uid, "username": raw_input}

                # Strategy 2: Embedded state / JSON
                json_match = re.search(r'["\'](?:player_id|uid|playerId|id)["\']:\s*["\']?(\d{7,10})["\']?', html)
                if json_match:
                    found_uid = json_match.group(1)
                    cls.link_identity(raw_input, found_uid)
                    return {"uid": found_uid, "username": raw_input}
        except Exception as e:
            print(f"[IDENTITY ERROR] RivalsMeta forward lookup failed: {e}")

        # Fallback: RivalsTracker
        try:
            rt_url = f"https://rivalstracker.com/profile/{encoded}"
            rt_html = await fetch_profile_html(rt_url)
            if rt_html:
                m = re.search(r'/profile/(\d{7,10})', rt_html)
                if m:
                    found_uid = m.group(1)
                    cls.link_identity(raw_input, found_uid)
                    return {"uid": found_uid, "username": raw_input}
        except Exception:
            pass

        return {"uid": raw_input, "username": raw_input}
