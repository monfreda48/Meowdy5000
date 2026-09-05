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

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import httpx
from fastapi import FastAPI, Depends, Query, HTTPException, Response, Request, Body
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select


from backend.database import init_db, get_db, User, TrackedPlayer
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
async def check_update_alias(request: Request):
    return await get_latest_app_version(request)

@app.post("/api/report-error")
async def report_error(payload: dict = Body(None)):
    return {"status": "received"}

@app.get("/api/app/download/latest")
async def download_latest_apk():
    release_data = await fetch_github_release()
    if not release_data and not os.path.exists(LATEST_APK_PATH):
        raise HTTPException(status_code=404, detail="No APK available")

    if release_data:
        assets = release_data.get("assets", [])
        apk_asset = next((a for a in assets if a["name"].endswith(".apk")), None)
        if not apk_asset:
            raise HTTPException(status_code=404, detail="No APK asset found in latest GitHub release")

        # Download APK from GitHub if not already cached
        asset_download_url = apk_asset.get("browser_download_url")
        headers = {"User-Agent": "FastAPI-Updater"}
        if GITHUB_TOKEN:
            # Private repo asset API endpoint requires octet-stream header
            asset_download_url = apk_asset.get("url")
            headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
            headers["Accept"] = "application/octet-stream"

        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            res = await client.get(asset_download_url, headers=headers)
            if res.status_code == 200:
                with open(LATEST_APK_PATH, "wb") as f:
                    f.write(res.content)

    if os.path.exists(LATEST_APK_PATH):
        return FileResponse(
            path=LATEST_APK_PATH,
            media_type="application/vnd.android.package-archive",
            filename="Meowdy5000_update.apk"
        )
    raise HTTPException(status_code=404, detail="APK failed to download from GitHub")

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

DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

if os.path.exists(DIST_DIR):
    assets_path = os.path.join(DIST_DIR, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Prevent intercepting /api calls that happen to 404
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        no_cache_headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        if full_path != "" and os.path.isfile(file_path):
            if file_path.endswith(".html"):
                return FileResponse(file_path, headers=no_cache_headers)
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"), headers=no_cache_headers)



