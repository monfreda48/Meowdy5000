import sys
import os
import asyncio

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.scrapers.season_scraper import get_season_info

async def test_live():
    print("[*] Forcing live scrape from rivalstracker.com...")
    data = await get_season_info(force_refresh=True)
    print("\n--- LIVE SCRAPED DATA ---")
    for k, v in data.items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    asyncio.run(test_live())
