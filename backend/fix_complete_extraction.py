import asyncio
import json
import urllib.parse
from playwright.async_api import async_playwright

async def inspect_and_intercept(username="Meowdy 5000"):
    clean_username = username.strip()
    encoded_ign = urllib.parse.quote(clean_username, safe='')
    
    captured_payloads = {}

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

        async def handle_response(response):
            if "api.tracker.gg/api/v2/marvel-rivals" in response.url and response.status == 200:
                try:
                    data = await response.json()
                    captured_payloads[response.url] = data
                except Exception:
                    pass

        page.on("response", handle_response)

        await page.goto("https://tracker.gg/marvel-rivals", wait_until="domcontentloaded", timeout=15000)

        api_profile = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}"
        api_matches = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/matches/ign/{encoded_ign}"

        results = await page.evaluate(f"""
            async () => {{
                const fetchJson = async (url) => {{
                    try {{
                        const res = await fetch(url, {{ headers: {{ 'Accept': 'application/json' }} }});
                        return res.ok ? await res.json() : null;
                    }} catch (e) {{ return null; }}
                }};
                return {{
                    profile: await fetchJson('{api_profile}'),
                    matches: await fetchJson('{api_matches}')
                }};
            }}
        """)
        await browser.close()

    full_profile = results.get("profile") or {}
    full_matches = results.get("matches") or {}

    with open("full_profile_captured.json", "w", encoding="utf-8") as f:
        json.dump({"profile": full_profile, "matches": full_matches, "intercepted": captured_payloads}, f, indent=2)

    print("[+] Saved full multi-endpoint payload to full_profile_captured.json")

if __name__ == "__main__":
    asyncio.run(inspect_and_intercept())
