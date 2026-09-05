import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import dateutil.parser

from sqlalchemy.future import select
from backend.database import AsyncSessionLocal, SeasonCache

logger = logging.getLogger("season_scraper")

DEFAULT_START_DATE = "2026-08-15T00:00:00Z"
DEFAULT_END_DATE = "2026-09-11T23:59:59Z"

DEFAULT_FALLBACK_SEASON = {
    "season_number": "9.5",
    "season_title": "THE MYSTERY OF THEBES",
    "days_left": 6,
    "start_date": DEFAULT_START_DATE,
    "end_date": DEFAULT_END_DATE,
    "progress_percentage": 78,
    "new_hero_name": "The Hood",
    "new_hero_icon": "https://rivalstracker.com/images/heroes/the_hood.png",
    "updated_at": datetime.now(timezone.utc).isoformat()
}

def compute_live_season_progress(start_date_str: str, end_date_str: str):
    """
    Computes real-time days remaining and exact completion percentage
    based on the current UTC time.
    """
    now = datetime.now(timezone.utc)
    try:
        start = dateutil.parser.parse(start_date_str)
        end = dateutil.parser.parse(end_date_str)
        
        # Ensure timezone-aware
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        total_seconds = (end - start).total_seconds()
        elapsed_seconds = (now - start).total_seconds()
        remaining_seconds = (end - now).total_seconds()

        days_left = max(0, int(remaining_seconds // 86400))
        progress_pct = max(0, min(100, int((elapsed_seconds / total_seconds) * 100)))

        return days_left, progress_pct
    except Exception as e:
        logger.warning(f"[!] Date calculation fallback: {e}")
        return None, None

async def get_season_info(force_refresh: bool = False) -> dict:
    """Fetch current season metadata from rivalstracker.com with live date calculation."""
    res_payload = None

    async with AsyncSessionLocal() as session:
        # 1. Check cache first
        try:
            result = await session.execute(
                select(SeasonCache).order_by(SeasonCache.updated_at.desc())
            )
            cached_record = result.scalars().first()
        except Exception as db_ex:
            logger.warning(f"SeasonCache query warning: {db_ex}")
            cached_record = None

        if cached_record and not force_refresh:
            now = datetime.now(timezone.utc)
            six_hours_ago = now - timedelta(hours=6)
            cached_time = cached_record.updated_at
            if cached_time and cached_time.tzinfo is None:
                cached_time = cached_time.replace(tzinfo=timezone.utc)

            if cached_time and cached_time >= six_hours_ago:
                logger.info("Returning season info from 6-hour SQLite cache.")
                res_payload = {
                    "season_number": cached_record.season_number,
                    "season_title": cached_record.season_title,
                    "days_left": cached_record.days_left,
                    "start_date": getattr(cached_record, "start_date", None) or DEFAULT_START_DATE,
                    "end_date": cached_record.end_date or DEFAULT_END_DATE,
                    "progress_percentage": cached_record.progress_percentage,
                    "new_hero_name": cached_record.new_hero_name,
                    "new_hero_icon": cached_record.new_hero_icon,
                    "updated_at": cached_time.isoformat() if cached_time else None
                }

        # 2. Scrape via Playwright
        if not res_payload:
            scraped_data = None
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(
                        headless=True,
                        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
                    )
                    context = await browser.new_context(
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                    )
                    page = await context.new_page()
                    logger.info("Navigating to https://rivalstracker.com...")
                    await page.goto("https://rivalstracker.com", wait_until="domcontentloaded", timeout=15000)

                    content = await page.content()

                    s_num_match = re.search(r"SEASON\s+(\d+(?:\.\d+)?)", content, re.IGNORECASE)
                    season_num = s_num_match.group(1) if s_num_match else "9.5"

                    s_title_match = re.search(r"SEASON\s+\d+(?:\.\d+)?\s*:?\s*([A-Z\s]{3,30})", content)
                    season_title = s_title_match.group(1).strip() if s_title_match else "THE MYSTERY OF THEBES"

                    end_match = re.search(r"ENDS?\s+([A-Za-z]{3}\s+\d{1,2})", content, re.IGNORECASE)
                    end_date = end_match.group(1) if end_match else "Sep 11, 2026"

                    hero_name_match = re.search(r"NEW\s+HERO\s*:?\s*([A-Za-z\s]{3,20})", content, re.IGNORECASE)
                    new_hero_name = hero_name_match.group(1).strip() if hero_name_match else "The Hood"

                    img_src = await page.evaluate('''() => {
                        const img = document.querySelector('img[alt*="Hero"], img[src*="hero"]');
                        return img ? img.src : null;
                    }''')
                    new_hero_icon = img_src or "https://rivalstracker.com/images/heroes/the_hood.png"

                    await browser.close()

                    scraped_data = {
                        "season_number": season_num,
                        "season_title": season_title,
                        "days_left": 6,
                        "start_date": DEFAULT_START_DATE,
                        "end_date": DEFAULT_END_DATE,
                        "progress_percentage": 78,
                        "new_hero_name": new_hero_name,
                        "new_hero_icon": new_hero_icon,
                        "updated_at": datetime.now(timezone.utc)
                    }
            except Exception as e:
                logger.error(f"Playwright navigation failed for rivalstracker.com: {e}")

            if scraped_data:
                try:
                    new_record = SeasonCache(
                        season_number=scraped_data["season_number"],
                        season_title=scraped_data["season_title"],
                        days_left=scraped_data["days_left"],
                        end_date=scraped_data["end_date"],
                        progress_percentage=scraped_data["progress_percentage"],
                        new_hero_name=scraped_data["new_hero_name"],
                        new_hero_icon=scraped_data["new_hero_icon"],
                        updated_at=scraped_data["updated_at"]
                    )
                    session.add(new_record)
                    await session.commit()
                except Exception as db_err:
                    logger.warning(f"Database save warning: {db_err}")
                
                scraped_data["updated_at"] = scraped_data["updated_at"].isoformat()
                res_payload = scraped_data

            if not res_payload and cached_record:
                cached_time = cached_record.updated_at
                if cached_time and cached_time.tzinfo is None:
                    cached_time = cached_time.replace(tzinfo=timezone.utc)
                res_payload = {
                    "season_number": cached_record.season_number,
                    "season_title": cached_record.season_title,
                    "days_left": cached_record.days_left,
                    "start_date": getattr(cached_record, "start_date", None) or DEFAULT_START_DATE,
                    "end_date": cached_record.end_date or DEFAULT_END_DATE,
                    "progress_percentage": cached_record.progress_percentage,
                    "new_hero_name": cached_record.new_hero_name,
                    "new_hero_icon": cached_record.new_hero_icon,
                    "updated_at": cached_time.isoformat() if cached_time else None
                }

    if not res_payload:
        res_payload = dict(DEFAULT_FALLBACK_SEASON)

    # 3. Always re-compute live days_left & progress_percentage against UTC now
    start_str = res_payload.get("start_date") or DEFAULT_START_DATE
    end_str = res_payload.get("end_date") or DEFAULT_END_DATE
    computed_days, computed_pct = compute_live_season_progress(start_str, end_str)
    if computed_days is not None and computed_pct is not None:
        res_payload["days_left"] = computed_days
        res_payload["progress_percentage"] = computed_pct

    return res_payload
