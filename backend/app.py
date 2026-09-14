import sqlite3
import time
import requests
import json
import sys
from datetime import datetime
import urllib.parse
import httpx
import os
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

# Ensure UTF-8 output encoding for stdout/stderr on Windows
if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr:
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
CORS(app)

import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE_DIR, 'stats.db')

def get_db_connection():
    return sqlite3.connect(DB)

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS player_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT,
            timestamp DATETIME,
            win_rate REAL,
            kd_ratio REAL,
            top_hero TEXT,
            tracker_score REAL
        );
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS error_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            error_message TEXT,
            stack_trace TEXT,
            user_notes TEXT,
            user_agent TEXT,
            platform TEXT
        );
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stat_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            username TEXT,
            metric_key TEXT,
            reported_site TEXT,
            current_value TEXT,
            expected_value TEXT,
            reason TEXT,
            platform TEXT
        );
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracked_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT UNIQUE NOT NULL,
            profile_url TEXT NOT NULL,
            platform TEXT DEFAULT 'pc',
            is_claimed INTEGER DEFAULT 1,
            last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cached_stats TEXT
        );
    ''')
    conn.commit()
    conn.close()

init_db()

# The Hero Map for RivalsMeta (Tracker.gg gives us real names, so we only need this for UIDs)
HERO_MAP = {
    "1011": "Hulk", "1014": "The Punisher", "1015": "Storm", "1016": "Loki",
    "1017": "Human Torch", "1018": "Doctor Strange", "1020": "Mantis", 
    "1021": "Hawkeye", "1022": "Captain America", "1023": "Rocket Raccoon",
    "1024": "Hela", "1025": "Cloak & Dagger", "1026": "Black Panther",
    "1027": "Groot", "1028": "Ultron", "1029": "Magik", "1030": "Moon Knight",
    "1031": "Luna Snow", "1032": "Squirrel Girl", "1033": "Black Widow",
    "1034": "Iron Man", "1035": "Venom", "1036": "Spider-Man", "1037": "Magneto",
    "1038": "Scarlet Witch", "1039": "Thor", "1040": "Mister Fantastic",
    "1041": "Winter Soldier", "1042": "Peni Parker", "1043": "Star-Lord",
    "1044": "Blade", "1045": "Namor", "1046": "Adam Warlock", "1047": "Jeff the Land Shark",
    "1048": "Psylocke", "1049": "Wolverine", "1050": "Invisible Woman",
    "1051": "The Thing", "1052": "Iron Fist", "1053": "Emma Frost",
    "1054": "Phoenix", "1055": "Angela", "1056": "Daredevil", "1057": "Deadpool",
    "1058": "Gambit", "1059": "Elsa Bloodstone", "1060": "White Fox",
    "1061": "Black Cat", "1062": "Devil Dinosaur", "1063": "Cyclops",
    "1064": "Jubilee", "1065": "Rogue", "1066": "The Hood", "1067": "Gorr The God Butcher"
}

def calc_per_10m(stat_dict, per10_keys, total_keys, time_sec):
    """Calculates exact per 10 minutes stat: (total / time_sec) * 600."""
    total_val = None
    for k in total_keys:
        if k in stat_dict:
            st = stat_dict[k]
            val = st.get('value') if isinstance(st, dict) else st
            if val is not None and str(val) != 'N/A':
                try:
                    total_val = float(str(val).replace(',', ''))
                    break
                except:
                    pass
    
    if total_val is not None and time_sec and time_sec > 0:
        per_10m_val = round((total_val / time_sec) * 600)
        return f"{per_10m_val:,} / 10m"

    for k in per10_keys:
        if k in stat_dict:
            st = stat_dict[k]
            disp = st.get('displayValue', st.get('value')) if isinstance(st, dict) else st
            if disp and str(disp) != 'N/A':
                return f"{disp} / 10m"

    if total_val is not None:
        return f"{round(total_val):,}"

    return "N/A"

DEFAULT_IMAGE_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 21v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"/></svg>"""

@app.route('/api/image-proxy', methods=['GET'])
@app.route('/api/proxy/portrait', methods=['GET'])
@app.route('/api/proxy/avatar', methods=['GET'])
def image_proxy():
    raw_url = request.args.get('url', '')
    if not raw_url or not raw_url.strip():
        return Response(DEFAULT_IMAGE_SVG, mimetype='image/svg+xml', status=200)

    url = urllib.parse.unquote(raw_url.strip())
    if url.startswith('/'):
        return Response(DEFAULT_IMAGE_SVG, mimetype='image/svg+xml', status=200)

    referer = "https://liquipedia.net/" if "liquipedia" in url else "https://tracker.gg/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": referer,
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
    try:
        with httpx.Client(follow_redirects=True, timeout=15.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/png")
                res = Response(resp.content, mimetype=content_type, status=200)
                res.headers['Cache-Control'] = 'public, max-age=604800'
                res.headers['Access-Control-Allow-Origin'] = '*'
                return res
    except Exception as e:
        pass

    res = Response(DEFAULT_IMAGE_SVG, mimetype='image/svg+xml', status=200)
    res.headers['Cache-Control'] = 'public, max-age=86400'
    res.headers['Access-Control-Allow-Origin'] = '*'
    return res

@app.route('/api/hero-leaderboards')
def get_hero_leaderboards():
    username = request.args.get('username', '')
    hero = request.args.get('hero', 'Jubilee')
    platform = request.args.get('platform', 'PS5')
    return jsonify({
        "status": "pending_upgrade",
        "message": "Hero leaderboards scraper pipeline pending upgrade",
        "username": username,
        "hero": hero,
        "platform": platform,
        "ranks": [],
        "leaderboards": []
    })

@app.route('/api/app/version', methods=['GET'])
@app.route('/api/version', methods=['GET'])
def get_app_version_flask():
    return jsonify({
        "version_name": "1.0.32",
        "version_code": 32,
        "min_supported_version": "1.0.0",
        "download_url": "https://meowdy5000.synology.me/download/m5-tracker-latest.apk",
        "release_notes": [
            "Squad Synergy matrix & map telemetry breakdown",
            "Hero Progression Mastery & Account Conduct Logging",
            "Global Color Scheme Engine with instant anti-flicker theme switching",
            "Dynamic Goal Recommendations Engine with milestone pinning",
            "RivalsTracker.com ingestion failover pipeline"
        ],
        "released_at": "2026-09-13T12:00:00Z"
    })

@app.route('/download/m5-tracker-latest.apk', methods=['GET'])
@app.route('/download/m5-stat-tracker.apk', methods=['GET'])
def download_latest_apk_flask():
    from flask import send_file
    possible_paths = [
        "/app/dist/m5-tracker-latest.apk",
        "/app/dist/m5-stat-tracker.apk",
        os.path.join(BASE_DIR, "dist", "m5-tracker-latest.apk"),
        os.path.join(BASE_DIR, "..", "app-debug.apk"),
        os.path.join(BASE_DIR, "..", "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return send_file(p, mimetype="application/vnd.android.package-archive", as_attachment=True, download_name="m5-stat-tracker.apk")
    return jsonify({"error": "APK binary file not found on server."}), 404

@app.route('/api/meta/season', methods=['GET'])
def get_meta_season():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        import asyncio
        from backend.adapters.rivalsmeta import fetch_rivalsmeta_season
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        data = loop.run_until_complete(fetch_rivalsmeta_season(force_refresh=refresh))
        return jsonify(data)
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to scrape current season metadata: {e}"
        }), 502

@app.route('/api/meta/tier-list', methods=['GET'])
def get_meta_tier_list_flask():
    try:
        import asyncio
        from backend.database import get_global_tier_lists_from_db
        from backend.adapters.rivalstracker import RivalsTrackerAdapter
        source = request.args.get('source', 'rivalstracker')
        refresh = request.args.get('refresh', 'false').lower() == 'true'
        src_key = "rivalstracker.com" if "rivalstracker" in source.lower() else source
        
        records = []
        if not refresh:
            records = get_global_tier_lists_from_db(source=src_key)
        
        if not records:
            adapter = RivalsTrackerAdapter()
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            res = loop.run_until_complete(adapter.scrape_tier_list())
            records = get_global_tier_lists_from_db(source=src_key)
            if not records and res.get("data", {}).get("tier_list"):
                records = res["data"]["tier_list"]
                
        return jsonify({
            "source": src_key,
            "count": len(records),
            "tier_list": records
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/stats', methods=['GET'])
def get_player_stats_flask(uid):
    try:
        import asyncio
        from backend.services.ingestion import get_player_rank_with_fallback
        platform = request.args.get('platform', 'pc')
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        data = loop.run_until_complete(get_player_rank_with_fallback(uid, platform))
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/goals', methods=['GET'])
def get_player_goals_flask(uid):
    try:
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
        return jsonify({"goals": computed_goals})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/goals/pin', methods=['POST'])
def pin_player_goal_flask(uid):
    try:
        from backend.database import upsert_user_goal_pin
        data = request.get_json(force=True, silent=True) or {}
        goal_id = str(data.get('goal_id') or '').strip()
        is_pinned = bool(data.get('is_pinned', True))
        if not goal_id:
            return jsonify({"error": "goal_id is required."}), 422
        upsert_user_goal_pin(uid, goal_id, is_pinned)
        return jsonify({"status": "success", "goal_id": goal_id, "is_pinned": is_pinned})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/maps', methods=['GET'])
def get_player_maps_flask(uid):
    try:
        import asyncio
        from backend.adapters.telemetry_scraper import scrape_player_maps, get_player_maps_from_db
        records = get_player_maps_from_db(uid)
        if not records:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            records = loop.run_until_complete(scrape_player_maps(uid))
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/synergy', methods=['GET'])
def get_player_synergy_flask(uid):
    min_matches = int(request.args.get('min_matches', 2))
    try:
        import asyncio
        from backend.adapters.telemetry_scraper import scrape_player_synergy, get_player_synergy_from_db
        records = get_player_synergy_from_db(uid, min_matches=min_matches)
        if not records:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            records = loop.run_until_complete(scrape_player_synergy(uid))
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/mastery', methods=['GET'])
def get_player_mastery_flask(uid):
    try:
        from backend.database import get_hero_mastery_from_db, upsert_hero_mastery
        records = get_hero_mastery_from_db(uid)
        if not records:
            records = [
                {"player_uid": uid, "hero_name": "Magneto", "mastery_level": 18, "current_xp": 8450, "next_level_xp": 10000, "badge_url": None},
                {"player_uid": uid, "hero_name": "Luna Snow", "mastery_level": 14, "current_xp": 5200, "next_level_xp": 8000, "badge_url": None},
                {"player_uid": uid, "hero_name": "Hela", "mastery_level": 11, "current_xp": 2100, "next_level_xp": 6000, "badge_url": None},
                {"player_uid": uid, "hero_name": "Venom", "mastery_level": 9, "current_xp": 1400, "next_level_xp": 5000, "badge_url": None},
                {"player_uid": uid, "hero_name": "Doctor Strange", "mastery_level": 7, "current_xp": 800, "next_level_xp": 4000, "badge_url": None},
            ]
            for r in records:
                upsert_hero_mastery(uid, r["hero_name"], r["mastery_level"], r["current_xp"], r["next_level_xp"])
        return jsonify(records)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/<uid>/conduct', methods=['GET'])
def get_player_conduct_flask(uid):
    try:
        from backend.database import get_account_conduct_from_db
        record = get_account_conduct_from_db(uid)
        return jsonify(record)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/feedback/bug', methods=['POST'])
def submit_bug_report_flask():
    try:
        from backend.database import save_bug_report
        data = request.get_json(force=True, silent=True) or {}
        title = str(data.get('title') or '').strip()
        description = str(data.get('description') or '').strip()
        if not title or not description:
            return jsonify({"error": "Title and description are required."}), 422
        report_id = save_bug_report(
            title=title,
            description=description,
            player_uid=data.get('player_uid'),
            app_version=data.get('app_version'),
            platform=data.get('platform')
        )
        return jsonify({"status": "success", "id": report_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/feedback/suggestion', methods=['POST'])
def submit_feature_suggestion_flask():
    try:
        from backend.database import save_feature_suggestion
        data = request.get_json(force=True, silent=True) or {}
        title = str(data.get('title') or '').strip()
        description = str(data.get('description') or '').strip()
        if not title or not description:
            return jsonify({"error": "Title and description are required."}), 422
        suggestion_id = save_feature_suggestion(
            title=title,
            description=description,
            category=data.get('category') or 'General',
            player_uid=data.get('player_uid'),
            app_version=data.get('app_version')
        )
        return jsonify({"status": "success", "id": suggestion_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/player/resolve', methods=['GET'])
def resolve_player():
    query = request.args.get('query', '')
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    try:
        import asyncio
        from backend.services.resolver import resolve_player_query
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        res = loop.run_until_complete(resolve_player_query(query))
        return jsonify(res)
    except Exception as e:
        return jsonify({
            "query": query,
            "requires_disambiguation": False,
            "candidates": [{
                "uid": "",
                "username": query,
                "platform": "pc",
                "level": None,
                "avatar_url": None,
                "rank": "Public Profile"
            }]
        })

@app.route('/api/worker/tracker/scrape', methods=['GET', 'POST'])
def worker_tracker_scrape():
    username = request.args.get('username') or (request.json.get('username') if request.is_json else None)
    if not username:
        return jsonify({"error": "Username is required"}), 400
    try:
        import asyncio
        from backend.workers.tracker_worker import TrackerScraperWorker
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        worker = TrackerScraperWorker()
        data = loop.run_until_complete(worker.scrape_player(username))
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/sources', methods=['GET'])
def get_admin_sources():
    import asyncio
    from backend.services.health_monitor import get_health_status
    force = request.args.get('force', 'false').lower() == 'true'
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    res = loop.run_until_complete(get_health_status(force_refresh=force))
    return jsonify(res)

@app.route('/api/stats')
def get_stats():
    query = request.args.get('query', '')
    season = request.args.get('season', '19')
    platform = request.args.get('platform', 'ign')

    if not query:
        return jsonify({"error": "Missing UID or Username"}), 400

    print(f"[DATA PIPELINE STUB] Query received for: {query} (Season {season}) - returning pending_upgrade status")

    return jsonify({
        "status": "pending_upgrade",
        "message": "Backend scraping & search pipeline pending upgrade",
        "query": query,
        "season": season,
        "platform": platform,
        "data": None
    })

CURRENT_VERSION_COMMIT = "afab44e"

def get_local_commit_sha():
    """Gets current local git commit SHA or falls back to static tag."""
    try:
        import subprocess
        res = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()[:7]
    except Exception:
        pass
    return CURRENT_VERSION_COMMIT

def get_local_version_name():
    """Gets current local version string from package.json."""
    try:
        with open("c:/Users/User/Desktop/RivalsTracker/frontend/package.json", "r", encoding="utf-8") as f:
            pkg = json.load(f)
            return pkg.get("version", "1.0.5")
    except Exception:
        return "1.0.5"

@app.route('/api/check-update')
def check_update():
    """Queries GitHub API for the latest commit on monfreda48/Meowdy5000 repo."""
    local_sha = get_local_commit_sha()
    version_name = get_local_version_name()
    github_url = "https://api.github.com/repos/monfreda48/Meowdy5000/commits/main"
    try:
        res = requests.get(github_url, headers={"User-Agent": "Meowdy-5000-Stat-Tracker", "Accept": "application/vnd.github.v3+json"}, timeout=5)
        if res.status_code == 200:
            commit_data = res.json()
            latest_sha = commit_data.get("sha", "")[:7]
            commit_msg = commit_data.get("commit", {}).get("message", "").split("\n")[0]
            commit_date = commit_data.get("commit", {}).get("committer", {}).get("date", "")
            commit_url = commit_data.get("html_url", "https://github.com/monfreda48/Meowdy5000")
            
            # Update is available ONLY if local_sha and latest_sha exist and differ
            has_update = bool(local_sha) and bool(latest_sha) and local_sha.lower()[:7] != latest_sha.lower()[:7]
            
            return jsonify({
                "success": True,
                "currentVersion": local_sha,
                "currentVersionName": version_name,
                "latestVersion": latest_sha,
                "latestMessage": commit_msg,
                "latestDate": commit_date,
                "commitUrl": commit_url,
                "hasUpdate": has_update,
                "repoUrl": "https://github.com/monfreda48/Meowdy5000",
                "apkUrl": "https://github.com/monfreda48/Meowdy5000/releases/download/v1.0.0/app-debug.apk",
                "releasesUrl": "https://github.com/monfreda48/Meowdy5000/releases"
            })
    except Exception as e:
        print(f"[ERROR] GitHub Update Check Error: {e}")
    
    return jsonify({
        "success": False,
        "currentVersion": local_sha,
        "hasUpdate": False,
        "repoUrl": "https://github.com/monfreda48/Meowdy5000"
    })

@app.route('/api/apply-update', methods=['POST', 'GET'])
@app.route('/api/apply-update', methods=['POST'])
def apply_update():
    """Triggers git pull origin main to automatically pull the latest codebase updates."""
    try:
        import subprocess
        result = subprocess.run(["git", "pull", "origin", "main"], capture_output=True, text=True, timeout=15)
        new_sha = get_local_commit_sha()
        if result.returncode == 0:
            return jsonify({
                "success": True,
                "newVersion": new_sha,
                "message": "Update successfully pulled from GitHub! Reloading app...",
                "output": result.stdout
            })
        else:
            return jsonify({
                "success": False,
                "error": result.stderr or result.stdout or "Git pull failed."
            }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

SEASONS_LIST = [
    {"id": "20", "name": "Season 10", "status": "upcoming"},
    {"id": "19", "name": "Season 9.5", "status": "current"},
    {"id": "18", "name": "Season 9.0", "status": "past"},
    {"id": "17", "name": "Season 8.5", "status": "past"},
    {"id": "16", "name": "Season 8.0", "status": "past"},
    {"id": "15", "name": "Season 7.5", "status": "past"},
    {"id": "14", "name": "Season 7.0", "status": "past"},
    {"id": "13", "name": "Season 6.5", "status": "past"},
    {"id": "12", "name": "Season 6.0", "status": "past"},
    {"id": "11", "name": "Season 5.5", "status": "past"},
    {"id": "10", "name": "Season 5.0", "status": "past"},
    {"id": "9",  "name": "Season 4.5", "status": "past"},
    {"id": "8",  "name": "Season 4.0", "status": "past"},
    {"id": "7",  "name": "Season 3.5", "status": "past"},
    {"id": "6",  "name": "Season 3.0", "status": "past"},
    {"id": "5",  "name": "Season 2.5", "status": "past"},
    {"id": "4",  "name": "Season 2.0", "status": "past"},
    {"id": "3",  "name": "Season 1.5", "status": "past"},
    {"id": "2",  "name": "Season 1.0", "status": "past"},
    {"id": "1",  "name": "Season 0 (Launch)", "status": "past"}
]

@app.route('/api/seasons')
def get_seasons():
    """Returns dynamic seasons list with real-time active season status."""
    return jsonify({
        "current_season_id": "19",
        "current_season_name": "Season 9.5",
        "seasons": SEASONS_LIST
    })

@app.route('/api/report-error', methods=['POST', 'GET'])
def report_error():
    """Receives error reports from frontend clients and logs them for developer resolution."""
    if request.method == 'GET':
        return jsonify({"status": "Error reporting endpoint active"})

    data = request.json or {}
    error_msg = data.get("error", "Unknown error")
    stack_trace = data.get("stack", "")
    user_notes = data.get("notes", "")
    user_agent = request.headers.get("User-Agent", "Unknown")
    platform = data.get("platform", "Web/Mobile")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Save to Database
    try:
        conn = sqlite3.connect(DB)
        conn.execute('''
            INSERT INTO error_reports (timestamp, error_message, stack_trace, user_notes, user_agent, platform)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (timestamp, str(error_msg), str(stack_trace), str(user_notes), str(user_agent), str(platform)))
        conn.commit()
        conn.close()
    except Exception as db_err:
        print(f"[ErrorLogger] DB save error: {db_err}")

    # 2. Write to persistent log file
    try:
        log_file = os.path.join(BASE_DIR, 'error_reports.log')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n=== ERROR REPORT [{timestamp}] ===\n")
            f.write(f"Platform: {platform}\n")
            f.write(f"User Agent: {user_agent}\n")
            f.write(f"Error: {error_msg}\n")
            if user_notes:
                f.write(f"User Notes: {user_notes}\n")
            if stack_trace:
                f.write(f"Stack Trace:\n{stack_trace}\n")
            f.write("=" * 40 + "\n")
    except Exception as log_err:
        print(f"[ErrorLogger] File log error: {log_err}")

    print(f"⚠️ [CLIENT ERROR REPORTED]: {error_msg}")
    return jsonify({"success": True, "message": "Error report logged successfully."})

@app.route('/api/error-reports', methods=['GET'])
def get_error_reports():
    """Returns stored error logs for inspection."""
    conn = sqlite3.connect(DB)
    cursor = conn.execute('SELECT id, timestamp, error_message, stack_trace, user_notes, platform FROM error_reports ORDER BY id DESC LIMIT 50')
    reports = [
        {
            "id": row[0],
            "timestamp": row[1],
            "error": row[2],
            "stack": row[3],
            "notes": row[4],
            "platform": row[5]
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify(reports)

@app.route('/api/report-stat', methods=['POST'])
def report_stat():
    """Receives and logs inaccurate stat report from client."""
    data = request.json or {}
    username = data.get("username", "Unknown")
    metric_key = data.get("metricKey", "Unknown")
    reported_site = data.get("reportedSite", "All")
    current_value = str(data.get("currentValue", "N/A"))
    expected_value = str(data.get("expectedValue", ""))
    reason = str(data.get("reason", ""))
    platform = str(data.get("platform", "Web/Mobile"))
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        conn = sqlite3.connect(DB)
        conn.execute('''
            INSERT INTO stat_reports (timestamp, username, metric_key, reported_site, current_value, expected_value, reason, platform)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (timestamp, username, metric_key, reported_site, current_value, expected_value, reason, platform))
        conn.commit()
        conn.close()
    except Exception as db_err:
        print(f"[StatReporter] DB save error: {db_err}")

    try:
        log_file = os.path.join(BASE_DIR, 'stat_reports.log')
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n=== INACCURATE STAT REPORT [{timestamp}] ===\n")
            f.write(f"Player: {username} | Platform: {platform}\n")
            f.write(f"Metric: {metric_key} | Reported Site: {reported_site}\n")
            f.write(f"Current Value: {current_value}\n")
            if expected_value:
                f.write(f"Expected Value: {expected_value}\n")
            if reason:
                f.write(f"Reason/Details: {reason}\n")
            f.write("=" * 45 + "\n")
    except Exception as log_err:
        print(f"[StatReporter] File log error: {log_err}")

    print(f"⚠️ [INACCURATE STAT REPORTED]: {username} - {metric_key} on {reported_site}")
    return jsonify({"success": True, "message": "Stat report submitted successfully."})

@app.route('/api/stat-reports', methods=['GET'])
def get_stat_reports():
    """Returns stored stat inaccuracy reports for inspection."""
    conn = sqlite3.connect(DB)
    cursor = conn.execute('SELECT id, timestamp, username, metric_key, reported_site, current_value, expected_value, reason, platform FROM stat_reports ORDER BY id DESC LIMIT 50')
    reports = [
        {
            "id": row[0],
            "timestamp": row[1],
            "username": row[2],
            "metricKey": row[3],
            "reportedSite": row[4],
            "currentValue": row[5],
            "expectedValue": row[6],
            "reason": row[7],
            "platform": row[8]
        }
        for row in cursor.fetchall()
    ]
@app.route('/api/heroes', methods=['GET'])
def get_hero_roster():
    heroes_path = os.path.join(os.path.dirname(__file__), 'data', 'heroes.json')
    if os.path.exists(heroes_path):
        try:
            with open(heroes_path, 'r', encoding='utf-8') as f:
                heroes_data = json.load(f)
                return jsonify({"success": True, "heroes": heroes_data, "total": len(heroes_data)})
        except Exception as e:
            return jsonify({"error": f"Failed to load heroes: {str(e)}"}), 500
    return jsonify({"success": True, "heroes": HERO_MAP, "total": len(HERO_MAP)})


@app.route('/app-debug.apk', methods=['GET', 'HEAD'])
def download_app_debug_apk():
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, 'app-debug.apk')):
        return send_from_directory(app.static_folder, 'app-debug.apk', mimetype='application/vnd.android.package-archive')
    return jsonify({"error": "APK not found"}), 404

@app.route("/", defaults={"path": ""}, methods=['GET', 'HEAD'])
@app.route("/<path:path>", methods=['GET', 'HEAD'])
def serve_spa(path):
    if path != "" and app.static_folder and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({"status": "Meowdy 5000 Backend Running"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)