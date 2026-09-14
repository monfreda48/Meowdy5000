import asyncio
import urllib.parse
from curl_cffi import requests
from playwright.async_api import async_playwright

UID = "70463344"
IGN = "Meowdy 5000"
SEASON = 20

print("=" * 70)
print("[1] TESTING RIVALSDATA WITH CURL_CFFI (TLS IMPERSONATION)")
print("=" * 70)

rivals_data_url = f"https://rivalsdata.com/player/{UID}"
try:
    s = requests.Session(impersonate="chrome124")
    resp = s.get(
        rivals_data_url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
        timeout=10
    )
    print(f"RivalsData Status: {resp.status_code}")
    print(f"Content Length   : {len(resp.text)} bytes")
    if resp.status_code == 200:
        print("[SUCCESS] Cloudflare bypassed on RivalsData via curl_cffi!")
        # Save a sample to check structure
        with open("tracker_recon/probes/rivals_data_dump.html", "w", encoding="utf-8") as f:
            f.write(resp.text[:50000])
        print("Saved preview to tracker_recon/probes/rivals_data_dump.html")
    else:
        print(f"Blocked with status {resp.status_code}")
except Exception as e:
    print(f"Error on RivalsData curl_cffi: {e}")

print("\n" + "=" * 70)
print("[2] SEARCHING TRACKER.GG BACKGROUND DATA CALLS")
print("=" * 70)

async def check_tracker_gg():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        captured_data_urls = []
        
        async def on_response(res):
            url = res.url
            # Filter out ads, tracking, and static media
            if not any(k in url for k in ["rum?", "bugsnag", "google", "doubleclick", "clarity", ".png", ".jpg", ".svg", ".css", ".woff"]):
                captured_data_urls.append(f"[{res.status}] {url}")
                if "application/json" in res.headers.get("content-type", "").lower():
                    try:
                        body = await res.json()
                        with open("tracker_recon/probes/tracker_gg_api_intercept.json", "w", encoding="utf-8") as f:
                            import json
                            json.dump(body, f, indent=2)
                        print(f"--> Intercepted JSON API: {url[:100]}")
                    except Exception:
                        pass
        
        page.on("response", on_response)
        target_url = f"https://tracker.gg/marvel-rivals/profile/ign/{urllib.parse.quote(IGN)}/overview?season={SEASON}"
        await page.goto(target_url, wait_until="networkidle", timeout=35000)
        
        print(f"Filtered Network Requests ({len(captured_data_urls)} found):")
        for u in captured_data_urls:
            print("  *", u[:110])
            
        await browser.close()

asyncio.run(check_tracker_gg())
