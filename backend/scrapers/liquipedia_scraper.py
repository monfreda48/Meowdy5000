import asyncio
import json
import os
import re
import urllib.parse
import httpx
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

CACHE_FILE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "liquipedia_heroes.json"))

async def fetch_liquipedia_via_api() -> dict:
    """Fallback fetcher using Liquipedia's MediaWiki API endpoint."""
    api_url = "https://liquipedia.net/marvelrivals/api.php?action=parse&page=Portal:Heroes&format=json"
    headers = {
        "User-Agent": "MeowdyRivalsTracker/1.0 (https://github.com/monfreda48/Meowdy5000) gzip",
        "Accept-Encoding": "gzip"
    }
    hero_icon_map = {}
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(api_url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            html_content = data.get("parse", {}).get("text", {}).get("*", "")
            soup = BeautifulSoup(html_content, "html.parser")
            
            for img in soup.find_all("img"):
                alt = (img.get("alt") or "").strip()
                title = (img.get("title") or "").strip()
                src = (img.get("src") or "").strip()

                candidate_name = alt or title
                if not candidate_name or not src:
                    continue

                clean_name = candidate_name.split("\n")[0].split("(")[0].strip().lower()
                if len(clean_name) < 3 or clean_name in ["expand", "collapse", "role", "vanguard", "duelist", "strategist", "multi-role"]:
                    continue

                if src.startswith("//"):
                    full_img_url = f"https:{src}"
                elif src.startswith("/"):
                    full_img_url = f"https://liquipedia.net{src}"
                else:
                    full_img_url = src

                if "/thumb/" in full_img_url:
                    parts = full_img_url.split("/thumb/")
                    if len(parts) == 2:
                        subparts = parts[1].rsplit("/", 1)
                        if len(subparts) == 2 and subparts[0]:
                            full_img_url = f"{parts[0]}/{subparts[0]}"

                if clean_name not in hero_icon_map:
                    hero_icon_map[clean_name] = full_img_url

    return hero_icon_map


async def sync_liquipedia_heroes(force: bool = False) -> dict:
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    
    # Return local cache if available and not forcing refresh
    if os.path.exists(CACHE_FILE) and not force:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if data:
                    return data
            except Exception:
                pass

    hero_icon_map = {}
    target_url = "https://liquipedia.net/marvelrivals/Portal:Heroes"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                extra_http_headers={"Accept-Language": "en-US,en;q=0.9"}
            )
            page = await context.new_page()

            print(f"[*] Fetching Liquipedia heroes from {target_url}...")
            response = await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)

            if response and response.status == 200:
                await asyncio.sleep(2)

                # 1. Click "Show all" / Expand buttons if collapsed
                try:
                    show_all_locators = [
                        page.locator("button, a, span", has_text=re.compile(r"^show all$", re.IGNORECASE)),
                        page.locator(".mw-collapsible-toggle"),
                        page.locator("span.collapseButton")
                    ]

                    for loc in show_all_locators:
                        count = await loc.count()
                        for i in range(count):
                            try:
                                if await loc.nth(i).is_visible():
                                    await loc.nth(i).click(timeout=1500)
                                    await asyncio.sleep(0.3)
                            except Exception:
                                pass
                except Exception as e:
                    print(f"[!] Warning while expanding toggles: {e}")

                # 2. Extract hero cards, links, and portrait images
                elements = await page.query_selector_all(".portal-box, .wiki-hero-box, .heroes-gallery div, .gallerybox, div[style*='display'], .mw-content-ltr div")
                
                for el in elements:
                    img = await el.query_selector("img")
                    if not img:
                        continue

                    alt = (await img.get_attribute("alt") or "").strip()
                    title = (await img.get_attribute("title") or "").strip()
                    text = (await el.inner_text() or "").strip()
                    src = (await img.get_attribute("src") or "").strip()

                    candidate_name = alt or title or text
                    if not candidate_name or not src:
                        continue

                    clean_name = candidate_name.split("\n")[0].split("(")[0].strip().lower()
                    if len(clean_name) < 3 or clean_name in ["expand", "collapse", "role", "vanguard", "duelist", "strategist", "multi-role"]:
                        continue

                    if src.startswith("//"):
                        full_img_url = f"https:{src}"
                    elif src.startswith("/"):
                        full_img_url = f"https://liquipedia.net{src}"
                    else:
                        full_img_url = src

                    if "/thumb/" in full_img_url:
                        parts = full_img_url.split("/thumb/")
                        if len(parts) == 2:
                            subparts = parts[1].rsplit("/", 1)
                            if len(subparts) == 2 and subparts[0]:
                                full_img_url = f"{parts[0]}/{subparts[0]}"

                    if clean_name not in hero_icon_map:
                        hero_icon_map[clean_name] = full_img_url

            await browser.close()
    except Exception as e:
        print(f"[!] Playwright scrape fallback: {e}")

    # Fallback to MediaWiki API if Playwright returned 0 items
    if not hero_icon_map:
        print("[*] Playwright yielded 0 heroes. Requesting via Liquipedia MediaWiki API...")
        hero_icon_map = await fetch_liquipedia_via_api()

    print(f"[+] Successfully harvested {len(hero_icon_map)} heroes from Liquipedia.")

    # Save to disk
    if hero_icon_map:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(hero_icon_map, f, indent=2)

    return hero_icon_map

if __name__ == "__main__":
    asyncio.run(sync_liquipedia_heroes(force=True))
