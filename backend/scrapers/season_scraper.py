import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from sqlalchemy.future import select
from backend.database import AsyncSessionLocal, SeasonCache

logger = logging.getLogger("season_scraper")

DEFAULT_FALLBACK_SEASON = {
    "season_number": "9.5",
    "season_title": "THE MYSTERY OF THEBES",
    "days_left": 6,
    "end_date": "Sep 11",
    "progress_percentage": 78,
    "new_hero_name": "The Hood",
    "new_hero_icon": "https://rivalstracker.com/images/heroes/the_hood.png",
    "updated_at": datetime.utcnow().isoformat()
}

async def get_season_info(force_refresh: bool = False) -> dict:
    """Fetch current season metadata from rivalstracker.com with a 6-hour SQLite cache."""
    async with AsyncSessionLocal() as session:
        # 1. Check cache first
        result = await session.execute(
            select(SeasonCache).order_by(SeasonCache.updated_at.desc())
        )
        cached_record = result.scalars().first()

        if cached_record and not force_refresh:
            now = datetime.utcnow()
            six_hours_ago = now - timedelta(hours=6)
            if cached_record.updated_at and cached_record.updated_at >= six_hours_ago:
                logger.info("Returning season info from 6-hour SQLite cache.")
                return {
                    "season_number": cached_record.season_number,
                    "season_title": cached_record.season_title,
                    "days_left": cached_record.days_left,
                    "end_date": cached_record.end_date,
                    "progress_percentage": cached_record.progress_percentage,
                    "new_hero_name": cached_record.new_hero_name,
                    "new_hero_icon": cached_record.new_hero_icon,
                    "updated_at": cached_record.updated_at.isoformat() if cached_record.updated_at else None
                }

        # 2. Scrape via Playwright
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

                # Wait for banner element
                try:
                    await page.wait_for_selector('text="SEASON IN PROGRESS"', timeout=8000)
                except Exception:
                    logger.warning("Banner containing 'SEASON IN PROGRESS' timed out or not found.")

                content = await page.content()

                # Extract Season number & Title
                s_num_match = re.search(r"SEASON\s+(\d+(?:\.\d+)?)", content, re.IGNORECASE)
                season_num = s_num_match.group(1) if s_num_match else "9.5"

                s_title_match = re.search(r"SEASON\s+\d+(?:\.\d+)?\s*:?\s*([A-Z\s]{3,30})", content)
                season_title = s_title_match.group(1).strip() if s_title_match else "THE MYSTERY OF THEBES"

                # Extract days left, end date, percentage
                days_match = re.search(r"(\d+)\s*DAYS?\s*LEFT", content, re.IGNORECASE)
                days_left = int(days_match.group(1)) if days_match else 6

                end_match = re.search(r"ENDS?\s+([A-Za-z]{3}\s+\d{1,2})", content, re.IGNORECASE)
                end_date = end_match.group(1) if end_match else "Sep 11"

                pct_match = re.search(r"(\d+)%", content)
                progress_percentage = int(pct_match.group(1)) if pct_match else 78

                # Extract New Hero info
                hero_name_match = re.search(r"NEW\s+HERO\s*:?\s*([A-Za-z\s]{3,20})", content, re.IGNORECASE)
                new_hero_name = hero_name_match.group(1).strip() if hero_name_match else "The Hood"

                # Avatar image url
                img_src = await page.evaluate('''() => {
                    const img = document.querySelector('img[alt*="Hero"], img[src*="hero"]');
                    return img ? img.src : null;
                }''')
                new_hero_icon = img_src or "https://rivalstracker.com/images/heroes/the_hood.png"

                await browser.close()

                scraped_data = {
                    "season_number": season_num,
                    "season_title": season_title,
                    "days_left": days_left,
                    "end_date": end_date,
                    "progress_percentage": progress_percentage,
                    "new_hero_name": new_hero_name,
                    "new_hero_icon": new_hero_icon,
                    "updated_at": datetime.utcnow()
                }
        except Exception as e:
            logger.error(f"Playwright navigation failed for rivalstracker.com: {e}")

        # 3. Save to database or return fallback
        if scraped_data:
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
            scraped_data["updated_at"] = scraped_data["updated_at"].isoformat()
            return scraped_data

        # Fallback to existing cached record if present
        if cached_record:
            logger.info("Fallback to last known SeasonCache database record.")
            return {
                "season_number": cached_record.season_number,
                "season_title": cached_record.season_title,
                "days_left": cached_record.days_left,
                "end_date": cached_record.end_date,
                "progress_percentage": cached_record.progress_percentage,
                "new_hero_name": cached_record.new_hero_name,
                "new_hero_icon": cached_record.new_hero_icon,
                "updated_at": cached_record.updated_at.isoformat() if cached_record.updated_at else None
            }

        # Ultimate default fallback
        return DEFAULT_FALLBACK_SEASON
