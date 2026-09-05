import os
import sys
import json
import logging
import asyncio
import requests
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import httpx
from fastapi import FastAPI, Depends, Query, HTTPException, Response, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


from backend.database import init_db, get_db, User
from backend.scrapers.season_scraper import get_season_info
from backend.scrapers.profile_scraper import scrape_player_profile

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("rivals_tracker_main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SQLite database tables via init_db()...")
    await init_db()
    yield
    logger.info("Shutting down backend server.")

app = FastAPI(
    title="Meowdy 5000 Rivals Tracker API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Image Proxy Endpoint
@app.api_route("/api/image-proxy", methods=["GET", "HEAD"])
async def proxy_image(url: str = Query(...)):
    referer = "https://liquipedia.net/" if "liquipedia" in url else "https://tracker.gg/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
        try:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/png")
                return Response(content=resp.content, media_type=content_type)
            return Response(status_code=resp.status_code)
        except Exception as e:
            return Response(status_code=500, content=str(e).encode('utf-8'))

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

class ErrorReportRequest(BaseModel):
    error: str
    stack: Optional[str] = None
    client_info: Optional[str] = None

RELEASES_DIR = os.path.join(os.path.dirname(__file__), "releases")
os.makedirs(RELEASES_DIR, exist_ok=True)

# App Self-Update Endpoints
@app.get("/api/app/version/latest", response_model=AppVersionInfo)
async def get_latest_app_version(request: Request):
    """Reads current app update distribution metadata with dynamic host resolution."""
    version_meta_path = os.path.join(RELEASES_DIR, "version.json")
    
    # Dynamically build base URL from the incoming request (preserves tunnel, LAN, or cellular domains)
    base_url = str(request.base_url).rstrip("/")
    dynamic_download_url = f"{base_url}/api/app/download/latest"

    if not os.path.exists(version_meta_path):
        return {
            "version_code": 999,
            "version_name": "1.0.1",
            "download_url": dynamic_download_url,
            "changelog": "Dynamic network failover & live telemetry enhancements."
        }

    with open(version_meta_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        # Override hardcoded download_url if it targets loopback 10.0.2.2 or 127.0.0.1
        if "10.0.2.2" in data.get("download_url", "") or "127.0.0.1" in data.get("download_url", ""):
            data["download_url"] = dynamic_download_url
        return data

@app.get("/api/app/download/latest")
async def download_latest_apk():
    """Serves the latest APK binary distribution."""
    apk_candidates = [
        os.path.join(RELEASES_DIR, "app-latest.apk"),
        os.path.join(os.path.dirname(__file__), "..", "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
        os.path.join(os.path.dirname(__file__), "..", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    ]
    for path in apk_candidates:
        if os.path.exists(path):
            return FileResponse(
                path=path,
                filename="rivals_tracker_update.apk",
                media_type="application/vnd.android.package-archive"
            )
    raise HTTPException(status_code=404, detail="No APK build available for distribution.")

# API Endpoints

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Meowdy 5000 Rivals Tracker API", "version": "2.0.0"}

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
