import asyncio
import json
import urllib.parse
from playwright.async_api import async_playwright

async def harvest_full_profile(username: str = "Meowdy 5000"):
    clean_username = username.strip()
    encoded_ign = urllib.parse.quote(clean_username, safe='')
    api_url = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}"

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
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

        print(f"[*] Navigating to establish session for: {clean_username}...")
        await page.goto("https://tracker.gg/marvel-rivals", wait_until="domcontentloaded", timeout=15000)

        # Harvest raw JSON from the internal API
        raw_payload = await page.evaluate(f"""
            async () => {{
                try {{
                    const res = await fetch('{api_url}', {{
                        headers: {{ 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }}
                    }});
                    if (!res.ok) return {{ error: 'HTTP_' + res.status }};
                    return await res.json();
                }} catch (e) {{
                    return {{ error: e.message }};
                }}
            }}
        """)
        await browser.close()

    if "error" in raw_payload or "data" not in raw_payload:
        print(f"[!] Harvest failed: {raw_payload}")
        return

    data = raw_payload["data"]

    # 1. Save absolute raw API dump
    with open("raw_profile_dump.json", "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)
    print("[+] Complete raw JSON saved to raw_profile_dump.json")

    # 2. Automatically generate a Categorized Master Schema Template
    segments = data.get("segments", [])
    catalog = {
        "player_info": {
            "platform_user_id": data.get("platformInfo", {}).get("platformUserId"),
            "platform_handle": data.get("platformInfo", {}).get("platformUserHandle"),
            "avatar_url": data.get("platformInfo", {}).get("avatarUrl")
        },
        "available_segment_types": list(set(s.get("type") for s in segments)),
        "available_playlists": list(set(s.get("attributes", {}).get("playlist") for s in segments if s.get("attributes", {}).get("playlist"))),
        "categorized_stats": {}
    }

    for segment in segments:
        seg_type = segment.get("type", "unknown")
        seg_name = segment.get("metadata", {}).get("name") or segment.get("attributes", {}).get("playlist") or seg_type
        stats_dict = segment.get("stats", {})

        if seg_type not in catalog["categorized_stats"]:
            catalog["categorized_stats"][seg_type] = {}

        catalog["categorized_stats"][seg_type][seg_name] = {
            key: {
                "displayName": val.get("displayName"),
                "displayCategory": val.get("displayCategory"),
                "sampleValue": val.get("value"),
                "sampleDisplayValue": val.get("displayValue")
            }
            for key, val in stats_dict.items()
        }

    with open("stat_catalog_template.json", "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)
    print("[+] Clean categorized schema template generated: stat_catalog_template.json")

if __name__ == "__main__":
    asyncio.run(harvest_full_profile())
