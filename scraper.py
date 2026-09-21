import asyncio
import json
import logging
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
import urllib.parse

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

SITES = [
    {
        "base_url": "https://marvelrivals.gg",
        "starting_urls": ["/heroes/", "/tier-list/", "/team-ups/", "/meta/", "/maps/", "/costumes/"],
        "is_allowed": lambda link, base: any(link.startswith(base + prefix) for prefix in ["/heroes/", "/tier-list/", "/team-ups/", "/meta/", "/maps/", "/costumes/"])
    },
    {
        "base_url": "https://rivalstracker.com",
        "starting_urls": ["/heroes", "/tier-list", "/team-comps", "/skins", "/heroes/team-ups"],
        "is_allowed": lambda link, base: any(link.startswith(base + prefix) for prefix in ["/heroes", "/tier-list", "/team-comps", "/skins"]) and "/leaderboard" not in link and "/profile" not in link
    },
    {
        "base_url": "https://rivalsmeta.com",
        "starting_urls": ["/characters", "/team-ups", "/tier-list", "/team-comps", "/skins", "/pve"],
        "is_allowed": lambda link, base: any(link.startswith(base + prefix) for prefix in ["/characters", "/team-ups", "/tier-list", "/team-comps", "/skins", "/pve"]) and len(link.split('/')) <= 5 # avoid deep subpages for characters
    }
]
# tracker.gg and rivalsdata.com block us with 403 on standard requests. In a real-world scenario we would use advanced stealth plugins or proxies.
# We'll skip them here since they require captchas/Cloudflare bypasses that are out of scope for a simple playwright script.

async def scrape_site(context, site_config):
    base_url = site_config["base_url"]
    starting_urls = site_config["starting_urls"]
    is_allowed = site_config["is_allowed"]

    scraped_data = []
    visited_urls = set()
    urls_to_visit = [base_url + u for u in starting_urls]

    domain = urllib.parse.urlparse(base_url).netloc

    page = await context.new_page()

    while urls_to_visit:
        url = urls_to_visit.pop(0)
        if url in visited_urls:
            continue

        visited_urls.add(url)
        logging.info(f"[{domain}] Navigating to {url}")

        try:
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)

            # If it's a Nuxt site (like rivalsmeta or rivalstracker), wait for data
            if "rivals" in domain:
                try:
                    await page.wait_for_selector('script#__NUXT_DATA__', state='attached', timeout=5000)
                except:
                    pass # Not all pages have it, or it might be a different framework

        except Exception as e:
            logging.error(f"[{domain}] Failed to navigate: {e}")
            continue

        content = await page.content()
        soup = BeautifulSoup(content, 'html.parser')

        visible_text = soup.get_text(separator='\n', strip=True)

        nuxt_data = None
        nuxt_tag = soup.find('script', id='__NUXT_DATA__')
        if nuxt_tag:
            try:
                nuxt_data = json.loads(nuxt_tag.string)
            except:
                pass

        # Extract next.js data if it exists (some trackers use it)
        next_data = None
        next_tag = soup.find('script', id='__NEXT_DATA__')
        if next_tag:
            try:
                next_data = json.loads(next_tag.string)
            except:
                pass

        scraped_data.append({
            "url": url,
            "text_dump": visible_text,
            "nuxt_data": nuxt_data,
            "next_data": next_data
        })

        links = [a.get('href') for a in soup.find_all('a', href=True) if a.get('href')]
        for link in links:
            if link.startswith('/'):
                link = base_url + link

            if link.startswith(base_url) and link not in visited_urls and link not in urls_to_visit:
                if is_allowed(link, base_url):
                    urls_to_visit.append(link)

        await asyncio.sleep(1)

    await page.close()

    filename = f"{domain.replace('.', '_')}_dump.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(scraped_data, f, indent=2)
    logging.info(f"[{domain}] Scraping complete. Dumped {len(scraped_data)} pages to {filename}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        for site in SITES:
            await scrape_site(context, site)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
