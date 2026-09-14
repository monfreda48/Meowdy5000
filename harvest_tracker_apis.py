import argparse
import asyncio
import json
import os
import urllib.parse
from playwright.async_api import async_playwright

OUTPUT_DIR = "tracker_recon"
os.makedirs(f"{OUTPUT_DIR}/payloads", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/requests", exist_ok=True)

def build_target_urls(uid: str, ign: str, season: int = None) -> dict:
    encoded_ign = urllib.parse.quote(ign.strip())
    clean_uid = uid.strip()
    
    tracker_gg_url = f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_ign}/overview"
    if season:
        tracker_gg_url += f"?season={season}"

    return {
        "tracker_gg": tracker_gg_url,
        "rivals_data": f"https://rivalsdata.com/player/{clean_uid}",
        "rivals_tracker": f"https://rivalstracker.com/profile/{clean_uid}",
        "rivals_meta": f"https://rivalsmeta.com/player/{clean_uid}",
    }

async def harvest_site(browser, site: str, url: str):
    print(f"[*] Probing {site} -> {url}")
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    )
    page = await context.new_page()
    idx = 0

    async def intercept_response(res):
        nonlocal idx
        content_type = res.headers.get("content-type", "").lower()
        if "application/json" in content_type:
            if not any(k in res.url for k in ["analytics", "sentry", "datadog", "gtm", "clarity", "doubleclick"]):
                try:
                    data = await res.json()
                    with open(f"{OUTPUT_DIR}/payloads/{site}_{idx}.json", "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2)
                    with open(f"{OUTPUT_DIR}/requests/{site}_{idx}_meta.json", "w", encoding="utf-8") as f:
                        json.dump({
                            "url": res.url,
                            "method": res.request.method,
                            "headers": dict(res.request.headers)
                        }, f, indent=2)
                    idx += 1
                    print(f"  [JSON] Intercepted {res.url[:90]}")
                except Exception:
                    pass

    page.on("response", intercept_response)
    try:
        await page.goto(url, wait_until="networkidle", timeout=40000)
    except Exception as e:
        print(f"  [!] Note on {site}: {e}")
    finally:
        await context.close()

async def main():
    parser = argparse.ArgumentParser(description="Harvest API JSON endpoints.")
    parser.add_argument("--uid", required=True)
    parser.add_argument("--ign", required=True)
    parser.add_argument("--season", type=int, default=None)
    args = parser.parse_args()

    targets = build_target_urls(args.uid, args.ign, args.season)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for site, url in targets.items():
            await harvest_site(browser, site, url)
        await browser.close()

    print(f"\n[+] Reconnaissance complete. Files saved in {OUTPUT_DIR}/payloads")

if __name__ == "__main__":
    asyncio.run(main())
