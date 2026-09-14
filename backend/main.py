import os
import re
import sys
import json
import logging
import asyncio
import requests
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any
import urllib.parse

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import httpx
from fastapi import FastAPI, Depends, Query, HTTPException, Response, Request, Body, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

class ScrapeWorkerRequest(BaseModel):
    username: str
    platform: Optional[str] = "pc"
    force_refresh: Optional[bool] = False

class PinGoalPayload(BaseModel):
    goal_id: str
    is_pinned: bool = True


from backend.database import (
    init_db, get_db, User, TrackedPlayer, save_bug_report, save_feature_suggestion,
    get_hero_mastery_from_db, get_account_conduct_from_db, upsert_hero_mastery, upsert_account_conduct
)
from backend.scrapers.season_scraper import get_season_info
from backend.scrapers.profile_scraper import scrape_player_profile
from backend.services.resolver import resolve_player_query

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("rivals_tracker_main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SQLite database tables via init_db()...")
    await init_db()
    try:
        from backend.services.hero_roster_service import sync_hero_roster
        asyncio.create_task(sync_hero_roster())
    except Exception as e:
        logger.warning(f"Failed to schedule initial hero roster sync: {e}")
    yield
    logger.info("Shutting down backend server.")

app = FastAPI(
    title="Meowdy 5000 Rivals Tracker API",
    version="2.0.0",
    lifespan=lifespan
)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_anti_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

DEFAULT_IMAGE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"/></svg>"""

# Image Proxy Endpoints (supports /api/image-proxy, /api/proxy/portrait, and /api/proxy/avatar)
@app.api_route("/api/image-proxy", methods=["GET", "HEAD"])
@app.api_route("/api/proxy/portrait", methods=["GET", "HEAD"])
@app.api_route("/api/proxy/avatar", methods=["GET", "HEAD"])
async def proxy_image(url: Optional[str] = Query(None)):
    if not url or not url.strip():
        return Response(content=DEFAULT_IMAGE_SVG, media_type="image/svg+xml")

    target_url = urllib.parse.unquote(url.strip())
    if target_url.startswith("/"):
        return Response(content=DEFAULT_IMAGE_SVG, media_type="image/svg+xml")

    referer = "https://liquipedia.net/" if "liquipedia" in target_url else "https://tracker.gg/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
            resp = await client.get(target_url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/png")
                return Response(
                    content=resp.content,
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=604800",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
    except Exception as e:
        logger.warning(f"Image proxy fetch error for {target_url}: {e}")

    return Response(
        content=DEFAULT_IMAGE_SVG,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*"}
    )

@app.post("/api/heroes/sync-icons")
async def refresh_hero_icons():
    from backend.scrapers.liquipedia_scraper import sync_liquipedia_heroes
    data = await sync_liquipedia_heroes(force=True)
    return {"status": "success", "heroes_count": len(data)}



# Pydantic Schemas
class AppVersionInfo(BaseModel):
    version_code: int
    version_name: str
    download_url: str
    changelog: str

class SearchRequest(BaseModel):
    username: str

class ClaimRequest(BaseModel):
    username: str
    profile_url: str

class ProfileClaimRequest(BaseModel):
    player_name: str
    profile_url: str
    platform: Optional[str] = "pc"
    stats: Optional[Dict[str, Any]] = None

class RefreshRequest(BaseModel):
    player_name: Optional[str] = None

class ErrorReportRequest(BaseModel):
    error: str
    stack: Optional[str] = None
    client_info: Optional[str] = None

GITHUB_REPO = "monfreda48/Meowdy5000"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "") # Optional, needed if repo is private
RELEASES_DIR = os.path.join(os.path.dirname(__file__), "releases")
os.makedirs(RELEASES_DIR, exist_ok=True)
LATEST_APK_PATH = os.path.join(RELEASES_DIR, "app-latest.apk")
VERSION_CACHE_PATH = os.path.join(RELEASES_DIR, "version.json")

async def fetch_github_release():
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "FastAPI-Updater"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        res = await client.get(f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest", headers=headers)
        if res.status_code != 200:
            return None
        return res.json()

# App Self-Update Endpoints
@app.get("/api/app/version/latest")
async def get_latest_app_version(request: Request):
    base_url = str(request.base_url).rstrip("/")
    release_data = await fetch_github_release()

    if release_data:
        tag = release_data.get("tag_name", "v1.0.0")
        # Extract version code (e.g., 'v1.0.23' -> 23)
        match = re.search(r'\d+$', tag)
        version_code = int(match.group()) if match else 1

        meta = {
            "version_code": version_code,
            "version_name": tag.lstrip("v"),
            "download_url": f"{base_url}/api/app/download/latest",
            "changelog": release_data.get("body") or "Bug fixes and improvements.",
            "release_notes": release_data.get("body") or "Bug fixes and improvements.",
            "github_tag": tag
        }
        with open(VERSION_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
        return meta

    if os.path.exists(VERSION_CACHE_PATH):
        with open(VERSION_CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)

    return {
        "version_code": 1,
        "version_name": "1.0.0",
        "download_url": f"{base_url}/api/app/download/latest",
        "changelog": "Initial release."
    }

@app.get("/api/check-update")
@app.get("/api/app/version")
@app.get("/api/version")
async def get_app_version_info(request: Request):
    """
    Exposes in-app update metadata: version_name, version_code, min_supported_version,
    download_url, release_notes, and release timestamp.
    """
    base_url = str(request.base_url).rstrip("/")
    download_url = f"{base_url}/download/m5-tracker-latest.apk"
    if "synology.me" in base_url or "localhost" in base_url:
        download_url = "https://meowdy5000.synology.me/download/m5-tracker-latest.apk"

    return {
        "version_name": "1.0.32",
        "version_code": 32,
        "min_supported_version": "1.0.0",
        "download_url": download_url,
        "release_notes": [
            "Squad Synergy matrix & map telemetry breakdown",
            "Hero Progression Mastery & Account Conduct Logging",
            "Global Color Scheme Engine with instant anti-flicker theme switching",
            "Dynamic Goal Recommendations Engine with milestone pinning",
            "RivalsTracker.com ingestion failover pipeline"
        ],
        "released_at": "2026-09-13T12:00:00Z"
    }

@app.get("/download/m5-tracker-latest.apk")
@app.get("/download/m5-stat-tracker.apk")
async def serve_latest_apk_binary():
    """
    Direct self-hosted APK downloader serving the latest compiled Android binary.
    """
    possible_paths = [
        "/app/dist/m5-tracker-latest.apk",
        "/app/dist/m5-stat-tracker.apk",
        os.path.join(os.path.dirname(__file__), "dist", "m5-tracker-latest.apk"),
        os.path.join(os.path.dirname(__file__), "..", "app-debug.apk"),
        os.path.join(os.path.dirname(__file__), "..", "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return FileResponse(
                path=p,
                filename="m5-stat-tracker.apk",
                media_type="application/vnd.android.package-archive",
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Content-Disposition": "attachment; filename=m5-stat-tracker.apk"
                }
            )
    raise HTTPException(status_code=404, detail="APK binary file not found on server.")

@app.get("/api/app/download/latest")
async def download_latest_apk():
    return await serve_latest_apk_binary()

# API Endpoints

@app.get("/api/meta/season")
async def get_rivalsmeta_season_endpoint(refresh: bool = Query(False)):
    """
    Returns current Marvel Rivals season metadata, end timestamp, days remaining,
    and upcoming hero teaser fetched & cached from rivalsmeta.com (12h TTL).
    """
    from backend.adapters.rivalsmeta import fetch_rivalsmeta_season
    res = await fetch_rivalsmeta_season(force_refresh=refresh)
    if isinstance(res, dict) and res.get("error"):
        raise HTTPException(
            status_code=res.get("http_status", 502),
            detail=res.get("message", "Failed to scrape current season metadata from upstream.")
        )
    return res

@app.get("/api/meta/season/debug")
async def get_season_meta_debug_endpoint():
    """
    Diagnostic debug endpoint bypassing SQLite cache completely to probe fresh upstream markup.
    """
    from backend.adapters.rivalsmeta import debug_scrape_rivalsmeta_season
    return await debug_scrape_rivalsmeta_season()

@app.get("/api/meta/tier-list")
async def get_meta_tier_list_endpoint(source: str = Query("rivalstracker", description="Source provider"), refresh: bool = Query(False)):
    """
    Returns JSON list of global hero tier lists grouped by tier with win rates and role tags.
    Enforces 24-hour cache TTL in SQLite to avoid continuous external requests.
    """
    from backend.database import get_global_tier_lists_from_db
    from backend.adapters.rivalstracker import RivalsTrackerAdapter
    
    src_key = "rivalstracker.com" if "rivalstracker" in source.lower() else source
    records = []
    if not refresh:
        records = get_global_tier_lists_from_db(source=src_key)
    
    if not records:
        adapter = RivalsTrackerAdapter()
        res = await adapter.scrape_tier_list()
        records = get_global_tier_lists_from_db(source=src_key)
        if not records and res.get("data", {}).get("tier_list"):
            records = res["data"]["tier_list"]
            
    return {
        "source": src_key,
        "count": len(records),
        "tier_list": records
    }

@app.get("/api/heroes")
@app.get("/api/meta/heroes")
async def get_heroes():
    from backend.services.hero_roster_service import load_heroes
    return load_heroes()

@app.post("/api/heroes/sync")
async def trigger_hero_sync():
    from backend.services.hero_roster_service import sync_hero_roster
    updated = await sync_hero_roster()
    return {"status": "success", "total_heroes": len(updated)}

@app.get("/api/player/{identifier}")
@app.get("/api/player/{identifier}/stats")
async def get_player_stats_endpoint(identifier: str, platform: Optional[str] = Query("pc"), force: bool = Query(False)):
    """
    Returns player profile payload using bidirectional IdentityManager & multi-source telemetry.
    """
    from backend.services.aggregator import get_player_profile
    profile = await get_player_profile(identifier, force_refresh=force)
    try:
        from backend.services.multi_source_fetcher import MultiSourceTrackerFetcher
        from backend.services.metric_brain import MetricBrain
        fetcher = MultiSourceTrackerFetcher(uid=identifier, ign=identifier)
        raw_telemetry = await fetcher.fetch_all()
        brain_data = MetricBrain.process(raw_telemetry, uid=identifier)
        if isinstance(profile, dict):
            profile["extended_metrics"] = brain_data.get("extended_metrics", {})
            profile["raw_telemetry"] = brain_data.get("raw_telemetry", {})
            profile["top_squadmates"] = brain_data.get("top_squadmates", [])
            profile["hero_matchups"] = brain_data.get("hero_matchups", [])
    except Exception as e:
        logger.warning(f"MetricBrain enrichment warning for {identifier}: {e}")
    return profile

@app.get("/api/player/{identifier}/multi-fetch")
@app.get("/api/player/{identifier}/raw-telemetry")
async def get_multi_source_telemetry(identifier: str):
    from backend.services.multi_source_fetcher import MultiSourceTrackerFetcher
    from backend.services.metric_brain import MetricBrain
    fetcher = MultiSourceTrackerFetcher(uid=identifier, ign=identifier)
    raw = await fetcher.fetch_all()
    brain_result = MetricBrain.process(raw, uid=identifier)
    return brain_result

@app.get("/api/player/{identifier}/debug-raw")
async def debug_raw_payloads(identifier: str):
    """Dumps raw scraper outputs directly to the browser for auditing."""
    from backend.services.identity import IdentityManager
    from backend.adapters.rivalsdata import fetch_rivalsdata_profile
    from backend.adapters.rivalstracker import fetch_rivalstracker_profile
    from backend.adapters.rivalsmeta import fetch_all_rivalsmeta_tabs
    from backend.adapters.trackergg import fetch_all_trackergg_tabs

    identity = await IdentityManager.resolve_identity(identifier)
    target_uid = identity["uid"]
    target_user = identity["username"]

    rd = await fetch_rivalsdata_profile(target_uid)
    rt = await fetch_rivalstracker_profile(target_uid)
    rm = await fetch_all_rivalsmeta_tabs(target_uid)
    tgg = await fetch_all_trackergg_tabs(target_user)

    return {
        "resolved_identity": identity,
        "adapters_status": {
            "RivalsData_keys": list(rd.keys()) if isinstance(rd, dict) else "FAILED",
            "RivalsTracker_keys": list(rt.keys()) if isinstance(rt, dict) else "FAILED",
            "RivalsMeta_tabs_present": [k for k, v in rm.items() if v] if isinstance(rm, dict) else "FAILED",
            "TrackerGG_tabs_present": [k for k, v in tgg.items() if v] if isinstance(tgg, dict) else "FAILED",
        },
        "raw_rivalstracker_summary": rt.get("summary", {}) if isinstance(rt, dict) else {},
        "raw_rivalsmeta_overview": rm.get("overview", {}) if isinstance(rm, dict) else {},
        "raw_trackergg_overview": tgg.get("overview", {}) if isinstance(tgg, dict) else {}
    }

@app.get("/api/player/{uid}/debug")
async def get_player_debug_endpoint(uid: str, platform: Optional[str] = Query("pc")):
    """
    Bypasses cache, calls RivalsData directly, returns raw parsed schema and status.
    """
    from backend.adapters.rivalsdata import fetch_rivalsdata_profile
    try:
        data = await fetch_rivalsdata_profile(uid, platform=platform)
        return {
            "status": "ok",
            "uid": uid,
            "platform": platform,
            "parsed_schema": data
        }
    except Exception as err:
        return {
            "status": "error",
            "uid": uid,
            "platform": platform,
            "error": str(err)
        }

@app.get("/api/player/{uid}/maps")
async def get_player_maps_endpoint(uid: str):
    """
    Returns array of map performance records for player UID, sorted by matches_played DESC.
    """
    from backend.adapters.telemetry_scraper import scrape_player_maps, get_player_maps_from_db
    records = get_player_maps_from_db(uid)
    if not records:
        records = await scrape_player_maps(uid)
    return records

@app.get("/api/player/{uid}/synergy")
async def get_player_synergy_endpoint(uid: str, min_matches: int = Query(2)):
    """
    Returns array of teammate synergy records for player UID with matches_together >= min_matches,
    sorted by matches_together DESC, then win_rate DESC.
    """
    from backend.adapters.telemetry_scraper import scrape_player_synergy, get_player_synergy_from_db
    records = get_player_synergy_from_db(uid, min_matches=min_matches)
    if not records:
        records = await scrape_player_synergy(uid)
    return records

class PlatformOverrideRequest(BaseModel):
    platform: str = "pc"

@app.post("/api/player/{uid}/platform")
async def update_player_platform_endpoint(uid: str, payload: PlatformOverrideRequest):
    """
    Accepts {"platform": "ps5" | "xbox" | "pc"} to manually update/persist platform.
    """
    from backend.services.aggregator import update_player_platform
    success = update_player_platform(uid, payload.platform)
    return {"success": success, "uid": uid, "platform": payload.platform}

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Meowdy 5000 Rivals Tracker API", "version": "2.0.0"}

@app.get("/api/admin/sources")
async def get_admin_sources_health(force: bool = Query(False)):
    from backend.services.health_monitor import get_health_status
    return await get_health_status(force_refresh=force)


@app.get("/api/player/resolve")
async def resolve_player(query: str = Query(..., description="Player display name or numeric UID")):
    """
    Automated Username-to-UID Resolution and Platform Normalization.
    Returns candidates and indicates if multi-platform disambiguation is required.
    """
    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Query parameter is required.")
    return await resolve_player_query(query.strip())

@app.api_route("/api/worker/tracker/scrape", methods=["GET", "POST"])
async def scrape_tracker_worker_endpoint(
    req: Optional[ScrapeWorkerRequest] = None,
    username: Optional[str] = Query(None),
    force_refresh: Optional[bool] = Query(False)
):
    """
    Internal worker endpoint for containerized Tracker.gg Cloudflare TLS-bypass scraping.
    """
    target_username = (req.username if req else None) or username
    target_force = (req.force_refresh if req else None) if req and req.force_refresh is not None else force_refresh

    if not target_username or not target_username.strip():
        raise HTTPException(status_code=400, detail="Username parameter is required.")
    try:
        from backend.workers.tracker_worker import TrackerScraperWorker
        worker = TrackerScraperWorker()
        data = await worker.scrape_player(target_username.strip(), force_refresh=bool(target_force))
        return data
    except Exception as e:
        logger.error(f"Tracker worker endpoint exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/season/current")
async def get_current_season(refresh: bool = Query(False)):
    """Returns the latest season metadata output from get_season_info()."""
    return await get_season_info(force_refresh=refresh)

@app.post("/api/search")
async def search_player(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    """
    Search for a player by username.
    Returns cached profile if claimed, otherwise scrapes preview data.
    """
    clean_username = req.username.strip().replace("\r", "").replace("\n", "")
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required.")

    result = await db.execute(select(User).where(User.username == clean_username))
    user = result.scalars().first()

    if user and user.claimed_url and user.cached_profile_json:
        try:
            cached_data = json.loads(user.cached_profile_json)
            if cached_data and not cached_data.get("is_fallback") and cached_data.get("overview", {}).get("win_rate") != "N/A":
                return {
                    "claimed": True,
                    "profile_url": user.claimed_url,
                    "data": cached_data
                }
        except Exception:
            pass

    preview_data = await scrape_player_profile(clean_username)
    resolved_url = preview_data.get("profile_url")

    now = datetime.utcnow()
    profile_json_str = json.dumps(preview_data)
    if user:
        user.last_scraped_at = now
        user.cached_profile_json = profile_json_str
    else:
        user = User(
            username=clean_username,
            claimed_url=resolved_url,
            last_scraped_at=now,
            cached_profile_json=profile_json_str
        )
        db.add(user)
    await db.commit()

    return {
        "claimed": user.claimed_url is not None if user else False,
        "profile_url": resolved_url,
        "data": preview_data
    }

@app.post("/api/claim")
async def claim_player_profile(req: ClaimRequest, db: AsyncSession = Depends(get_db)):
    """
    Claim a profile URL for a given username, store it in SQLite, and run a full profile scrape.
    """
    clean_username = req.username.strip()
    clean_url = req.profile_url.strip()

    if not clean_username or not clean_url:
        raise HTTPException(status_code=400, detail="Username and profile_url are required.")

    profile_data = await scrape_player_profile(clean_username, profile_url=clean_url)
    profile_json_str = json.dumps(profile_data)

    result = await db.execute(select(User).where(User.username == clean_username))
    user = result.scalars().first()

    now = datetime.utcnow()
    if user:
        user.claimed_url = clean_url
        user.last_scraped_at = now
        user.cached_profile_json = profile_json_str
    else:
        user = User(
            username=clean_username,
            claimed_url=clean_url,
            last_scraped_at=now,
            cached_profile_json=profile_json_str
        )
        db.add(user)

    await db.commit()
    return profile_data

@app.post("/api/profile/claim")
async def claim_profile_v2(req: ProfileClaimRequest, db: AsyncSession = Depends(get_db)):
    clean_name = req.player_name.strip()
    clean_url = req.profile_url.strip()
    if not clean_name or not clean_url:
        raise HTTPException(status_code=400, detail="player_name and profile_url are required.")
    
    result = await db.execute(select(TrackedPlayer).where(TrackedPlayer.player_name == clean_name))
    player = result.scalars().first()
    
    stats_str = json.dumps(req.stats) if req.stats else None
    now = datetime.utcnow()
    
    if player:
        player.profile_url = clean_url
        player.platform = req.platform or "pc"
        player.is_claimed = 1
        player.last_scraped_at = now
        if stats_str:
            player.cached_stats = stats_str
    else:
        player = TrackedPlayer(
            player_name=clean_name,
            profile_url=clean_url,
            platform=req.platform or "pc",
            is_claimed=1,
            last_scraped_at=now,
            cached_stats=stats_str
        )
        db.add(player)
    
    await db.commit()
    return {
        "status": "success",
        "message": f"Profile for {clean_name} claimed successfully.",
        "player_name": clean_name,
        "profile_url": clean_url,
        "is_claimed": 1
    }

@app.get("/api/profile/claimed")
async def get_claimed_profile_v2(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrackedPlayer).where(TrackedPlayer.is_claimed == 1).order_by(TrackedPlayer.last_scraped_at.desc()))
    player = result.scalars().first()
    
    if not player:
        return {"claimed": False, "player": None}
    
    cached_stats = None
    if player.cached_stats:
        try:
            cached_stats = json.loads(player.cached_stats)
        except Exception:
            pass
            
    return {
        "claimed": True,
        "player_name": player.player_name,
        "profile_url": player.profile_url,
        "platform": player.platform,
        "last_scraped_at": player.last_scraped_at.isoformat() if player.last_scraped_at else None,
        "cached_stats": cached_stats
    }

@app.post("/api/profile/refresh")
async def refresh_claimed_profile(req: Optional[RefreshRequest] = None, db: AsyncSession = Depends(get_db)):
    target_name = req.player_name.strip() if (req and req.player_name) else None
    
    if target_name:
        result = await db.execute(select(TrackedPlayer).where(TrackedPlayer.player_name == target_name))
        player = result.scalars().first()
    else:
        result = await db.execute(select(TrackedPlayer).where(TrackedPlayer.is_claimed == 1).order_by(TrackedPlayer.last_scraped_at.desc()))
        player = result.scalars().first()
        
    if not player:
        raise HTTPException(status_code=404, detail="No claimed player profile found to refresh.")
        
    fresh_data = await scrape_player_profile(player.player_name, profile_url=player.profile_url)
    now = datetime.utcnow()
    
    player.last_scraped_at = now
    player.cached_stats = json.dumps(fresh_data)
    await db.commit()
    
    return fresh_data

@app.get("/api/profile/{username}")
async def get_profile(username: str, refresh: bool = Query(False), db: AsyncSession = Depends(get_db)):
    """
    Retrieve player profile by username. Returns cached profile if valid, or triggers a fresh scrape if requested.
    """
    clean_username = username.strip()
    result = await db.execute(select(User).where(User.username == clean_username))
    user = result.scalars().first()

    if user and user.cached_profile_json and not refresh:
        return json.loads(user.cached_profile_json)

    claimed_url = user.claimed_url if user else None
    fresh_data = await scrape_player_profile(clean_username, profile_url=claimed_url)

    now = datetime.utcnow()
    profile_json_str = json.dumps(fresh_data)
    if user:
        user.last_scraped_at = now
        user.cached_profile_json = profile_json_str
    else:
        user = User(
            username=clean_username,
            claimed_url=claimed_url,
            last_scraped_at=now,
            cached_profile_json=profile_json_str
        )
        db.add(user)

    await db.commit()
    return fresh_data

@app.get("/api/seasons")
async def get_seasons_list():
    """Backward compatibility seasons list endpoint."""
    season_info = await get_season_info()
    return {
        "current_season": season_info.get("season_number", "19"),
        "current_season_name": season_info.get("season_title", "Season 9.5"),
        "seasons": [
            {"id": season_info.get("season_number", "19"), "name": f"Season {season_info.get('season_number', '9.5')} (Current)", "current": True},
            {"id": "18", "name": "Season 9.0", "current": False},
            {"id": "17", "name": "Season 8.5", "current": False},
            {"id": "all", "name": "All Time / Career", "current": False}
        ]
    }

@app.get("/api/stats")
async def get_stats_legacy(query: str = Query(...), season: str = Query("19")):
    """Backward compatibility stats lookup route."""
    return await scrape_player_profile(query)

class BugReportPayload(BaseModel):
    title: str
    description: str
    player_uid: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None

class FeatureSuggestionPayload(BaseModel):
    title: str
    description: str
    category: Optional[str] = "General"
    player_uid: Optional[str] = None
    app_version: Optional[str] = None

@app.post("/api/feedback/bug")
async def create_bug_report(payload: BugReportPayload):
    title = (payload.title or "").strip()
    description = (payload.description or "").strip()
    if not title or not description:
        raise HTTPException(status_code=422, detail="Title and description are required.")
    try:
        report_id = save_bug_report(
            title=title,
            description=description,
            player_uid=payload.player_uid,
            app_version=payload.app_version,
            platform=payload.platform
        )
        return {"status": "success", "id": report_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/feedback/suggestion")
async def create_feature_suggestion(payload: FeatureSuggestionPayload):
    title = (payload.title or "").strip()
    description = (payload.description or "").strip()
    if not title or not description:
        raise HTTPException(status_code=422, detail="Title and description are required.")
    try:
        suggestion_id = save_feature_suggestion(
            title=title,
            description=description,
            category=payload.category or "General",
            player_uid=payload.player_uid,
            app_version=payload.app_version
        )
        return {"status": "success", "id": suggestion_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.api_route("/api/report-error", methods=["GET", "POST"])
async def report_error_endpoint(request: Request):
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = {}
        title = body.get("title") or body.get("error") or "Client Error Report"
        desc = body.get("description") or body.get("stack") or json.dumps(body)
        try:
            report_id = save_bug_report(
                title=str(title)[:255],
                description=str(desc),
                player_uid=body.get("player_uid") or body.get("uid"),
                app_version=body.get("app_version"),
                platform=body.get("platform", "web")
            )
            return {"status": "success", "id": report_id, "message": "Error report saved"}
        except Exception as e:
            return {"status": "success", "message": f"Error logged: {e}"}
    return {"status": "ok", "message": "Error reporting endpoint active"}

@app.get("/api/player/{uid}/mastery")
async def get_player_mastery_endpoint(uid: str):
    records = get_hero_mastery_from_db(uid)
    return records or []

@app.get("/api/player/{uid}/conduct")
async def get_player_conduct_endpoint(uid: str):
    record = get_account_conduct_from_db(uid)
    return record

@app.get("/api/player/{uid}/goals")
async def get_player_goals_endpoint(uid: str):
    from backend.database import get_user_goals_state
    from backend.services.goals_engine import generate_goal_recommendations
    from backend.services.ingestion import get_cached_player
    
    cached = get_cached_player(uid) or {}
    stats_data = cached.get("stats") or cached
    computed_goals = generate_goal_recommendations(stats_data)
    
    pinned_state = get_user_goals_state(uid)
    for g in computed_goals:
        gid = g["id"]
        if gid in pinned_state:
            g["is_pinned"] = pinned_state[gid].get("is_pinned", False)
        else:
            g["is_pinned"] = False
            
    computed_goals.sort(key=lambda x: (not x["is_pinned"], x["id"]))
    return {"goals": computed_goals}

@app.post("/api/player/{uid}/goals/pin")
async def pin_player_goal_endpoint(uid: str, payload: PinGoalPayload):
    from backend.database import upsert_user_goal_pin
    upsert_user_goal_pin(uid, payload.goal_id, payload.is_pinned)
    return {"status": "success", "goal_id": payload.goal_id, "is_pinned": payload.is_pinned}

DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(DIST_DIR):
    assets_path = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_spa(full_path: str):
        # Prevent intercepting /api calls that happen to 404
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        file_path = os.path.join(DIST_DIR, full_path)
        
        no_cache_headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        if full_path != "" and os.path.isfile(file_path):
            if file_path.endswith(".apk"):
                return FileResponse(file_path, media_type="application/vnd.android.package-archive")
            if file_path.endswith(".html"):
                return FileResponse(file_path, headers=no_cache_headers)
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"), headers=no_cache_headers)



