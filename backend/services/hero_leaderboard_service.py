import asyncio
import re
import logging
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup
from backend.services.platform_detector import get_platform_param

logger = logging.getLogger("hero_leaderboard_service")

class HeroLeaderboardRankService:
    """
    Crawls RivalsData, RivalsTracker, and RivalsMeta hero leaderboards
    to find player rank positions for their top hero.
    """
    def __init__(self, hero_slug: str, ign: str = "", player_uid: str = "", canonical_platform: str = "pc"):
        self.hero_slug = str(hero_slug).lower().strip().replace(" ", "-").replace("&", "and")
        self.ign = str(ign).strip()
        self.player_uid = str(player_uid).strip()
        self.canonical_platform = canonical_platform

    async def fetch_rivals_data_hero_rank(self, session) -> Optional[Dict[str, Any]]:
        plat_param = get_platform_param(self.canonical_platform, "rivals_data")
        url = f"https://rivalsdata.com/heroes/{self.hero_slug}/leaderboard?platform={plat_param}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status != 200:
                return None

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            soup = BeautifulSoup(text, "html.parser")
            rows = soup.find_all("tr")
            for idx, tr in enumerate(rows):
                txt = tr.get_text()
                link = tr.find("a", href=True)
                href = link["href"] if link else ""
                
                ign_match = self.ign and self.ign.lower() in txt.lower()
                uid_match = self.player_uid and self.player_uid in (href or txt)

                if ign_match or uid_match:
                    cells = tr.find_all(["td", "th"])
                    rank_val = None
                    if cells:
                        digits = re.sub(r"[^\d]", "", cells[0].get_text())
                        if digits:
                            rank_val = int(digits)
                    if not rank_val:
                        rank_val = idx

                    if rank_val and rank_val <= 500:
                        return {
                            "rank": rank_val,
                            "provider": "RivalsData",
                            "url": f"https://rivalsdata.com/heroes/{self.hero_slug}/leaderboard"
                        }
        except Exception as e:
            logger.warning(f"[fetch_rivals_data_hero_rank] Error: {e}")
        return None

    async def fetch_rivals_tracker_hero_rank(self, session) -> Optional[Dict[str, Any]]:
        plat_param = get_platform_param(self.canonical_platform, "rivals_tracker")
        url = f"https://rivalstracker.com/heroes/{self.hero_slug}?platform={plat_param}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status != 200:
                return None

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            soup = BeautifulSoup(text, "html.parser")
            rows = soup.select("#hero-leaderboard table tbody tr") or soup.find_all("tr")
            for idx, tr in enumerate(rows):
                name_elem = tr.select_one(".name") or tr
                txt = name_elem.get_text()
                link = tr.find("a", href=True)
                href = link["href"] if link else ""

                ign_match = self.ign and self.ign.lower() in txt.lower()
                uid_match = self.player_uid and self.player_uid in (href or txt)

                if ign_match or uid_match:
                    highlighted = tr.select_one(".highlighted") or (tr.find_all(["td", "th"])[0] if tr.find_all(["td", "th"]) else None)
                    rank_val = None
                    if highlighted:
                        digits = re.sub(r"[^\d]", "", highlighted.get_text())
                        if digits:
                            rank_val = int(digits)
                    if not rank_val:
                        rank_val = idx + 1

                    if rank_val and rank_val <= 500:
                        return {
                            "rank": rank_val,
                            "provider": "RivalsTracker",
                            "url": f"https://rivalstracker.com/heroes/{self.hero_slug}"
                        }
        except Exception as e:
            logger.warning(f"[fetch_rivals_tracker_hero_rank] Error: {e}")
        return None

    async def fetch_rivals_meta_hero_rank(self, session) -> Optional[Dict[str, Any]]:
        plat_param = get_platform_param(self.canonical_platform, "rivals_meta")
        url = f"https://rivalsmeta.com/characters/{self.hero_slug}/leaderboard?platform={plat_param}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
        try:
            resp = await session.get(url, headers=headers, timeout=3.0)
            status = getattr(resp, "status_code", 200)
            if status != 200:
                return None

            text = getattr(resp, "text", "")
            if callable(text):
                text = text()

            soup = BeautifulSoup(text, "html.parser")
            rows = soup.find_all("tr")
            for idx, tr in enumerate(rows):
                txt = tr.get_text()
                link = tr.find("a", href=True)
                href = link["href"] if link else ""

                ign_match = self.ign and self.ign.lower() in txt.lower()
                uid_match = self.player_uid and self.player_uid in (href or txt)

                if ign_match or uid_match:
                    cells = tr.find_all(["td", "th"])
                    rank_val = None
                    if cells:
                        digits = re.sub(r"[^\d]", "", cells[0].get_text())
                        if digits:
                            rank_val = int(digits)
                    if not rank_val:
                        rank_val = idx

                    if rank_val and rank_val <= 500:
                        return {
                            "rank": rank_val,
                            "provider": "RivalsMeta",
                            "url": f"https://rivalsmeta.com/characters/{self.hero_slug}/leaderboard"
                        }
        except Exception as e:
            logger.warning(f"[fetch_rivals_meta_hero_rank] Error: {e}")
        return None

    async def get_badges(self) -> List[Dict[str, Any]]:
        if not self.hero_slug or self.hero_slug in ["none", "unknown", "n/a"]:
            return []

        badges = []
        try:
            from curl_cffi.requests import AsyncSession
            async with AsyncSession(impersonate="chrome124", timeout=3.0) as session:
                r_data, r_tr, r_meta = await asyncio.gather(
                    self.fetch_rivals_data_hero_rank(session),
                    self.fetch_rivals_tracker_hero_rank(session),
                    self.fetch_rivals_meta_hero_rank(session),
                    return_exceptions=True
                )
                for res in [r_data, r_tr, r_meta]:
                    if res and isinstance(res, dict) and "rank" in res:
                        badges.append(res)
        except Exception as outer_e:
            logger.info(f"[get_badges] Falling back to httpx: {outer_e}")
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                r_data, r_tr, r_meta = await asyncio.gather(
                    self.fetch_rivals_data_hero_rank(client),
                    self.fetch_rivals_tracker_hero_rank(client),
                    self.fetch_rivals_meta_hero_rank(client),
                    return_exceptions=True
                )
                for res in [r_data, r_tr, r_meta]:
                    if res and isinstance(res, dict) and "rank" in res:
                        badges.append(res)

        return badges
