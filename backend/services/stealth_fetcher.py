import httpx
import asyncio
import logging
from typing import Optional

logger = logging.getLogger("stealth_fetcher")

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Dnt": "1",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
}

async def fetch_profile_html(url: str, timeout: float = 15.0) -> Optional[str]:
    try:
        try:
            from curl_cffi import requests as curl_requests
            res = curl_requests.get(url, impersonate="chrome120", headers=BROWSER_HEADERS, timeout=int(timeout))
            if res.status_code == 200 and len(res.text) > 500:
                return res.text
        except Exception:
            pass

        async with httpx.AsyncClient(
            headers=BROWSER_HEADERS,
            follow_redirects=True,
            timeout=timeout,
            verify=True
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and len(resp.text) > 500:
                return resp.text
            print(f"[FETCH WARNING] {url} returned HTTP {resp.status_code} (length: {len(resp.text)})")
    except Exception as e:
        print(f"[FETCH ERROR] Failed to fetch {url}: {e}")
    return None
