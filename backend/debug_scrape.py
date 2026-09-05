import asyncio
from playwright.async_api import async_playwright

async def debug_test():
    async with async_playwright() as p:
        # Launch with visible head so we can capture what Cloudflare does
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        # Listen to console and responses
        page.on("response", lambda res: print(f"[HTTP {res.status}] {res.url[:85]}"))

        target_url = "https://tracker.gg/marvel-rivals/profile/ign/Necros/overview"
        print(f"Navigating to: {target_url}")

        response = await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
        print(f"Initial Page Status: {response.status if response else 'None'}")

        # Wait 5 seconds to observe Turnstile or redirects
        await asyncio.sleep(5)

        # Save screenshot and page title
        title = await page.title()
        print(f"Page Title: {title}")
        await page.screenshot(path="debug_cloudflare.png", full_page=True)
        
        # Check if challenge text exists
        body_text = await page.inner_text("body")
        if "Just a moment..." in body_text or "Verify you are human" in body_text:
            print("VERDICT: Cloudflare Turnstile bot challenge detected.")
        elif "Player Not Found" in body_text:
            print("VERDICT: Page loaded cleanly, but player was not found.")
        else:
            print(f"VERDICT: Page rendered with {len(body_text)} characters of text.")

        await browser.close()

asyncio.run(debug_test())
