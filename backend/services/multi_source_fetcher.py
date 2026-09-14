import urllib.parse
import asyncio
import time
import re
import json
import logging
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger("multi_source_fetcher")

COOLDOWN_MAP: Dict[str, float] = {}
COOLDOWN_DURATION = 15 * 60  # 15 minutes in seconds

def is_on_cooldown(source: str) -> bool:
    return time.time() < COOLDOWN_MAP.get(source, 0)

def set_cooldown(source: str):
    COOLDOWN_MAP[source] = time.time() + COOLDOWN_DURATION

class MultiSourceTrackerFetcher:
    """
    Concurrent 4-Provider Ingestion Engine for Marvel Rivals telemetry.
    Ingests Tracker.gg, RivalsTracker, RivalsMeta, and RivalsData using
    lightweight async requests with circuit-breaking cooldowns.
    """
    def __init__(self, uid: str, ign: str = "", season: Optional[int] = None):
        self.uid = str(uid).strip()
        self.ign = str(ign).strip() if ign else self.uid
        self.season = season

    async def fetch_tracker_gg(self, session) -> Dict[str, Any]:
        if is_on_cooldown("tracker_gg"):
            return {"error": "Source tracker_gg is on 15-min cooldown (HTTP 403/429)"}

        encoded_ign = urllib.parse.quote(self.ign)
        url = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_ign}/overview",
            "Origin": "https://tracker.gg",
            "Accept": "application/json, text/plain, */*"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status in [403, 429]:
                set_cooldown("tracker_gg")
                return {"error": f"HTTP {status} - Circuit break activated for tracker_gg"}
            if status != 200:
                return {"error": f"HTTP {status}"}

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()
            data = json.loads(text) if isinstance(text, str) and text.startswith("{") else (resp.json() if hasattr(resp, "json") else {})
            return {"data": data, "status": 200}
        except Exception as e:
            logger.warning(f"[fetch_tracker_gg] Exception: {e}")
            return {"error": str(e)}

    async def fetch_rivals_tracker(self, session) -> Dict[str, Any]:
        if is_on_cooldown("rivals_tracker"):
            return {"error": "Source rivals_tracker is on 15-min cooldown (HTTP 403/429)"}

        encoded_uid = urllib.parse.quote(self.uid)
        url = f"https://rivalstracker.com/profile/{encoded_uid}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json, text/html, */*"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status in [403, 429]:
                set_cooldown("rivals_tracker")
                return {"error": f"HTTP {status} - Circuit break activated for rivals_tracker"}
            if status != 200:
                return {"error": f"HTTP {status}"}

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            if isinstance(text, str) and (text.strip().startswith("{") or text.strip().startswith("[")):
                return {"data": json.loads(text), "status": 200}

            # SSR Summary fallback parse
            soup = BeautifulSoup(text, "html.parser")
            summary = {}
            for card in soup.find_all(["div", "section"], class_=re.compile(r"stat|summary|card", re.I)):
                txt = card.get_text(strip=True)
                if txt:
                    summary[txt[:30]] = txt
            return {"data": {"summary": summary, "raw_html_len": len(text)}, "status": 200}
        except Exception as e:
            logger.warning(f"[fetch_rivals_tracker] Exception: {e}")
            return {"error": str(e)}

    async def fetch_rivals_meta(self, session) -> Dict[str, Any]:
        if is_on_cooldown("rivals_meta"):
            return {"error": "Source rivals_meta is on 15-min cooldown (HTTP 403/429)"}

        encoded_uid = urllib.parse.quote(self.uid)
        url = f"https://rivalsmeta.com/player/{encoded_uid}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status in [403, 429]:
                set_cooldown("rivals_meta")
                return {"error": f"HTTP {status} - Circuit break activated for rivals_meta"}
            if status != 200:
                return {"error": f"HTTP {status}"}

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            soup = BeautifulSoup(text, "html.parser")
            next_data = soup.find("script", id="__NEXT_DATA__")
            if next_data and next_data.string:
                try:
                    payload = json.loads(next_data.string)
                    props = payload.get("props", {}).get("pageProps", {})
                    return {"data": props, "status": 200}
                except Exception:
                    pass

            return {"data": {"raw_html_len": len(text)}, "status": 200}
        except Exception as e:
            logger.warning(f"[fetch_rivals_meta] Exception: {e}")
            return {"error": str(e)}

    async def fetch_rivals_data(self, session) -> Dict[str, Any]:
        if is_on_cooldown("rivals_data"):
            return {"error": "Source rivals_data is on 15-min cooldown (HTTP 403/429)"}

        encoded_uid = urllib.parse.quote(self.uid)
        url = f"https://rivalsdata.com/player/{encoded_uid}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status in [403, 429]:
                set_cooldown("rivals_data")
                return {"error": f"HTTP {status} - Circuit break activated for rivals_data"}
            if status != 200:
                return {"error": f"HTTP {status}"}

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            soup = BeautifulSoup(text, "html.parser")
            
            rank_tier = "Unranked"
            rank_score = "0 RS"
            win_rate = "0%"
            record = "0 W - 0 L"
            level = "1"
            clan_tag = ""

            rank_elem = soup.find(class_=re.compile(r"rank|tier", re.I))
            if rank_elem:
                rank_tier = rank_elem.get_text(strip=True)

            rs_elem = soup.find(string=re.compile(r"\d+\s*RS", re.I))
            if rs_elem:
                rank_score = str(rs_elem).strip()

            wr_elem = soup.find(string=re.compile(r"\d+%\s*WR", re.I))
            if wr_elem:
                win_rate = str(wr_elem).strip()

            rec_elem = soup.find(string=re.compile(r"\d+\s*W\s*-\s*\d+\s*L", re.I))
            if rec_elem:
                record = str(rec_elem).strip()

            return {
                "data": {
                    "rank_tier": rank_tier,
                    "rank_score": rank_score,
                    "win_rate": win_rate,
                    "record": record,
                    "level": level,
                    "clan_tag": clan_tag,
                    "raw_html_len": len(text)
                },
                "status": 200
            }
        except Exception as e:
            logger.warning(f"[fetch_rivals_data] Exception: {e}")
            return {"error": str(e)}

    async def fetch_all(self) -> Dict[str, Any]:
        results = {}
        try:
            from curl_cffi.requests import AsyncSession
            async with AsyncSession(impersonate="chrome124", timeout=3.0) as session:
                t_gg, r_tr, r_meta, r_data = await asyncio.gather(
                    self.fetch_tracker_gg(session),
                    self.fetch_rivals_tracker(session),
                    self.fetch_rivals_meta(session),
                    self.fetch_rivals_data(session),
                    return_exceptions=True
                )
                results["tracker_gg"] = t_gg if not isinstance(t_gg, Exception) else {"error": str(t_gg)}
                results["rivals_tracker"] = r_tr if not isinstance(r_tr, Exception) else {"error": str(r_tr)}
                results["rivals_meta"] = r_meta if not isinstance(r_meta, Exception) else {"error": str(r_meta)}
                results["rivals_data"] = r_data if not isinstance(r_data, Exception) else {"error": str(r_data)}
        except Exception as outer_e:
            logger.info(f"[fetch_all] Falling back to httpx: {outer_e}")
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                t_gg, r_tr, r_meta, r_data = await asyncio.gather(
                    self.fetch_tracker_gg(client),
                    self.fetch_rivals_tracker(client),
                    self.fetch_rivals_meta(client),
                    self.fetch_rivals_data(client),
                    return_exceptions=True
                )
                results["tracker_gg"] = t_gg if not isinstance(t_gg, Exception) else {"error": str(t_gg)}
                results["rivals_tracker"] = r_tr if not isinstance(r_tr, Exception) else {"error": str(r_tr)}
                results["rivals_meta"] = r_meta if not isinstance(r_meta, Exception) else {"error": str(r_meta)}
                results["rivals_data"] = r_data if not isinstance(r_data, Exception) else {"error": str(r_data)}

        return results
