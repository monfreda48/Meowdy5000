import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    from curl_cffi import requests as curl_requests
    CURL_CFFI_AVAILABLE = True
except ImportError:
    CURL_CFFI_AVAILABLE = False

import httpx

logger = logging.getLogger("health_monitor")

CACHE_TTL_SECONDS = 60
_health_cache: Optional[Dict[str, Any]] = None
_last_check_time: float = 0.0

PROBE_CONFIGS = {
    "tracker_gg": {
        "url": "https://tracker.gg/marvel-rivals",
        "name": "Tracker.gg"
    },
    "rivals_data": {
        "url": "https://rivalsdata.com",
        "name": "RivalsData.com"
    },
    "rivals_tracker": {
        "url": "https://rivalstracker.com/tier-list",
        "name": "RivalsTracker.com"
    },
    "rivals_meta": {
        "url": "https://rivalsmeta.com",
        "name": "RivalsMeta.com"
    }
}

async def _probe_source(source_key: str, config: Dict[str, str]) -> Dict[str, Any]:
    url = config["url"]
    start_time = time.time()
    last_success_iso = datetime.now(timezone.utc).isoformat()
    
    try:
        if source_key == "tracker_gg" and CURL_CFFI_AVAILABLE:
            loop = asyncio.get_running_loop()
            def sync_fetch():
                return curl_requests.get(
                    url,
                    impersonate="chrome110",
                    timeout=5,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
            resp = await loop.run_in_executor(None, sync_fetch)
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            if resp.status_code == 403:
                return {
                    "status": "degraded",
                    "latency_ms": elapsed_ms,
                    "last_success": None,
                    "error": "Cloudflare / Turnstile 403 Blocked"
                }
            elif resp.status_code >= 500:
                return {
                    "status": "offline",
                    "latency_ms": elapsed_ms,
                    "last_success": None,
                    "error": f"Server Error (HTTP {resp.status_code})"
                }
            else:
                return {
                    "status": "online",
                    "latency_ms": elapsed_ms,
                    "last_success": last_success_iso,
                    "error": None
                }
        else:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                resp = await client.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                )
                elapsed_ms = int((time.time() - start_time) * 1000)
                if resp.status_code in [403, 429]:
                    return {
                        "status": "degraded",
                        "latency_ms": elapsed_ms,
                        "last_success": None,
                        "error": f"Rate Limited / Blocked (HTTP {resp.status_code})"
                    }
                elif resp.status_code >= 500:
                    return {
                        "status": "offline",
                        "latency_ms": elapsed_ms,
                        "last_success": None,
                        "error": f"Server Error (HTTP {resp.status_code})"
                    }
                else:
                    return {
                        "status": "online",
                        "latency_ms": elapsed_ms,
                        "last_success": last_success_iso,
                        "error": None
                    }
    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.warning(f"[HealthMonitor] Probe check failed for {source_key}: {e}")
        return {
            "status": "offline",
            "latency_ms": elapsed_ms,
            "last_success": None,
            "error": str(e)
        }

async def get_health_status(force_refresh: bool = False) -> Dict[str, Any]:
    global _health_cache, _last_check_time
    now = time.time()

    if not force_refresh and _health_cache and (now - _last_check_time < CACHE_TTL_SECONDS):
        return _health_cache

    tasks = [
        _probe_source(source_key, config)
        for source_key, config in PROBE_CONFIGS.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    sources_dict = {}
    online_count = 0
    degraded_count = 0
    offline_count = 0

    for idx, (source_key, _) in enumerate(PROBE_CONFIGS.items()):
        res = results[idx]
        if isinstance(res, Exception):
            sources_dict[source_key] = {
                "status": "offline",
                "latency_ms": 0,
                "last_success": None,
                "error": str(res)
            }
            offline_count += 1
        else:
            sources_dict[source_key] = res
            status = res.get("status")
            if status == "online":
                online_count += 1
            elif status == "degraded":
                degraded_count += 1
            else:
                offline_count += 1

    if offline_count >= 3:
        overall_status = "critical"
    elif degraded_count >= 1 or offline_count >= 1:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    health_response = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": overall_status,
        "sources": sources_dict
    }

    _health_cache = health_response
    _last_check_time = now
    return health_response
