import asyncio
import json
import logging
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BASE_URL = "https://rivalsmeta.com"
STARTING_URLS = [
    "/characters",
    "/team-ups",
    "/tier-list",
    "/team-comps",
    "/skins",
    "/pve"
]

# We want to skip dynamic leaderboard/stats inside characters as per user request to ignore dynamic things.
# "characters/psylocke/leaderboard", "characters/psylocke/matchups", etc.
# We will just scrape the main character page.

def is_allowed(link):
    # Check if the link starts with one of our prefixes
    if not any(link.startswith(BASE_URL + prefix) for prefix in STARTING_URLS):
        return False
    # If it's a character link, only allow the main character page (e.g. /characters/iron-man)
    # but not sub-pages of characters (e.g. /characters/iron-man/leaderboard)
    path = link[len(BASE_URL):]
    if path.startswith("/characters/"):
        parts = path.split('/')
        # parts will be ['', 'characters', 'iron-man', 'leaderboard']
        if len(parts) > 3 and parts[3] != "":
            return False
    return True

async def scrape_page(page, url):
    """Scrapes a single page and returns text, nuxt data, and found links."""
    logging.info(f"Navigating to {url}")
    try:
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_selector('script#__NUXT_DATA__', state='attached', timeout=10000)
    except Exception as e:
        logging.error(f"Failed to navigate to {url}: {e}")
        return None, None, []

    content = await page.content()
    soup = BeautifulSoup(content, 'html.parser')

    # Extract visible text
    visible_text = soup.get_text(separator='\n', strip=True)

    # Extract NUXT data
    nuxt_data = None
    nuxt_tag = soup.find('script', id='__NUXT_DATA__')
    if nuxt_tag:
        try:
            nuxt_data = json.loads(nuxt_tag.string)
        except json.JSONDecodeError:
            logging.error(f"Failed to parse NUXT data on {url}")

    # Extract sub-links
    links = [a.get('href') for a in soup.find_all('a', href=True) if a.get('href')]

    valid_links = []
    for link in links:
        if link.startswith('/'):
            valid_links.append(BASE_URL + link)
        elif link.startswith(BASE_URL):
            valid_links.append(link)

    return visible_text, nuxt_data, list(set(valid_links))

async def main():
    scraped_data = []
    visited_urls = set()
    urls_to_visit = [BASE_URL + u for u in STARTING_URLS]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        while urls_to_visit:
            current_url = urls_to_visit.pop(0)
            if current_url in visited_urls:
                continue

            visited_urls.add(current_url)
            text, nuxt, new_links = await scrape_page(page, current_url)

            if text or nuxt:
                scraped_data.append({
                    "url": current_url,
                    "text_dump": text,
                    "nuxt_data": nuxt
                })

            for link in new_links:
                if link not in visited_urls and link not in urls_to_visit:
                    if is_allowed(link) and link != BASE_URL + "/" and len(link) > len(BASE_URL):
                        urls_to_visit.append(link)

            await asyncio.sleep(1)

        await browser.close()

    with open("rivalsmeta_dump.json", "w", encoding="utf-8") as f:
        json.dump(scraped_data, f, indent=2)
    logging.info(f"Scraping complete. Dumped {len(scraped_data)} pages to rivalsmeta_dump.json")

if __name__ == "__main__":
    asyncio.run(main())
