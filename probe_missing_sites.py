import asyncio
import json
import os
import urllib.parse
from playwright.async_api import async_playwright

UID = "70463344"
IGN = "Meowdy 5000"
SEASON = 20

TARGETS = {
    "tracker_gg": f"https://tracker.gg/marvel-rivals/profile/ign/{urllib.parse.quote(IGN)}/overview?season={SEASON}",
    "rivals_data": f"https://rivalsdata.com/player/{UID}"
}

os.makedirs("tracker_recon/probes", exist_ok=True)

async def probe_site(browser, name, url):
    print(f"\n[+] Testing: {name} -> {url}")
    # Use realistic desktop context
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        locale="en-US"
    )
    page = await context.new_page()

    all_api_calls = []

    async def log_request(res):
        ct = res.headers.get("content-type", "").lower()
        if "json" in ct or "text/plain" in ct or "graphql" in res.url:
            all_api_calls.append({"url": res.url, "status": res.status, "content_type": ct})

    page.on("response", log_request)

    try:
        resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(5000) # allow hydration scripts to settle

        title = await page.title()
        status = resp.status if resp else "No Response"
        print(f"    Page Title : {title}")
        print(f"    HTTP Status: {status}")

        # Check for Cloudflare challenge
        content = await page.content()
        if "Just a moment..." in title or "challenge-platform" in content:
            print("    [!] Warning: Hit Cloudflare bot protection screen.")

        # Check for Next.js __NEXT_DATA__
        next_data = await page.evaluate('''() => {
            const el = document.getElementById('__NEXT_DATA__');
            return el ? el.textContent : null;
        }''')

        if next_data:
            parsed = json.loads(next_data)
            out_path = f"tracker_recon/probes/{name}_next_data.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(parsed, f, indent=2)
            print(f"    [SUCCESS] Extracted __NEXT_DATA__ ({os.path.getsize(out_path)/1024:.1f} KB) -> {out_path}")
        else:
            print("    [-] No __NEXT_DATA__ script found.")

        # Save any background endpoints discovered
        if all_api_calls:
            print(f"    Captured {len(all_api_calls)} potential data endpoints:")
            for c in all_api_calls[:5]:
                print(f"      - [{c['status']}] {c['url'][:95]}")

    except Exception as e:
        print(f"    [!] Error loading {name}: {e}")
    finally:
        await context.close()

async def main():
    async with async_playwright() as p:
        # launch with stealth flags to avoid basic headless detection
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"]
        )
        for name, url in TARGETS.items():
            await probe_site(browser, name, url)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
