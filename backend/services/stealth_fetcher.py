import httpx
import logging

logger = logging.getLogger("stealth_fetcher")

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
}

async def fetch_profile_html(url: str) -> str:
    try:
        try:
            from curl_cffi import requests as curl_requests
            res = curl_requests.get(url, impersonate="chrome120", timeout=10)
            if res.status_code == 200:
                return res.text
        except Exception:
            pass

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=DEFAULT_HEADERS)
            if resp.status_code == 200:
                return resp.text
    except Exception as e:
        logger.warning(f"[stealth_fetcher] Error fetching {url}: {e}")
    return ""
