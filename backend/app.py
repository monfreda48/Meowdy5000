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
        CREATE TABLE IF NOT EXISTS claimed_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            platform TEXT,
            saved_url TEXT,
            tracker_gg_url TEXT,
            rivals_meta_url TEXT,
            rivals_tracker_url TEXT,
            claimed_at DATETIME,
            cached_stats TEXT
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
    "1064": "Jubilee", "1065": "Rogue", "1066": "The Hood"
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

@app.route('/api/image-proxy', methods=['GET'])
def image_proxy():
    url = request.args.get('url', '')
    if not url:
        return jsonify({"error": "Missing URL parameter"}), 400
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
                return Response(resp.content, mimetype=content_type, status=200)
            return Response(status=resp.status_code)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    conn.close()
    return jsonify(reports)

@app.route('/api/claim-profile', methods=['GET', 'POST', 'DELETE'])
def handle_claim_profile():
    """
    Handles claiming profiles and saving user-specific 3-site direct profile URLs:
    - POST: Saves claimed profile with direct URLs for Tracker.gg, RivalsMeta, and RivalsTracker for instant retrieval.
    - GET: Retrieves saved profile & 3 direct site URLs by username query.
    - DELETE: Unclaims profile.
    """
    if request.method == 'POST':
        data = request.json or {}
        username = (data.get('username') or '').strip()
        platform = data.get('platform', 'PC')
        saved_url = data.get('savedUrl') or data.get('saved_url') or ''
        tracker_gg_url = data.get('trackerGgUrl') or data.get('siteUrls', {}).get('trackerGg') or ''
        rivals_meta_url = data.get('rivalsMetaUrl') or data.get('siteUrls', {}).get('rivalsMeta') or ''
        rivals_tracker_url = data.get('rivalsTrackerUrl') or data.get('siteUrls', {}).get('rivalsTracker') or ''
        cached_stats = json.dumps(data.get('cachedStats') or {})
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if not username:
            return jsonify({"error": "Username is required to claim a profile"}), 400

        try:
            conn = sqlite3.connect(DB)
            conn.execute('''
                INSERT INTO claimed_profiles (username, platform, saved_url, tracker_gg_url, rivals_meta_url, rivals_tracker_url, claimed_at, cached_stats)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    platform = excluded.platform,
                    saved_url = excluded.saved_url,
                    tracker_gg_url = excluded.tracker_gg_url,
                    rivals_meta_url = excluded.rivals_meta_url,
                    rivals_tracker_url = excluded.rivals_tracker_url,
                    claimed_at = excluded.claimed_at,
                    cached_stats = excluded.cached_stats
            ''', (username, platform, saved_url, tracker_gg_url, rivals_meta_url, rivals_tracker_url, timestamp, cached_stats))
            conn.commit()
            conn.close()
            return jsonify({
                "success": True,
                "message": f"Profile '{username}' claimed successfully with 3-site direct links!",
                "savedUrl": saved_url,
                "trackerGgUrl": tracker_gg_url,
                "rivalsMetaUrl": rivals_meta_url,
                "rivalsTrackerUrl": rivals_tracker_url,
                "claimedAt": timestamp
            })
        except Exception as e:
            return jsonify({"error": f"Failed to claim profile: {str(e)}"}), 500

    elif request.method == 'DELETE':
        data = request.json or {}
        username = (data.get('username') or request.args.get('username') or '').strip()
        if not username:
            return jsonify({"error": "Username is required"}), 400
        try:
            conn = sqlite3.connect(DB)
            conn.execute('DELETE FROM claimed_profiles WHERE LOWER(username) = LOWER(?)', (username,))
            conn.commit()
            conn.close()
            return jsonify({"success": True, "message": f"Profile '{username}' unclaimed."})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    else:
        username = (request.args.get('username') or '').strip()
        conn = sqlite3.connect(DB)
        if username:
            cursor = conn.execute('SELECT username, platform, saved_url, tracker_gg_url, rivals_meta_url, rivals_tracker_url, claimed_at, cached_stats FROM claimed_profiles WHERE LOWER(username) = LOWER(?)', (username,))
            row = cursor.fetchone()
            conn.close()
            if row:
                cached = {}
                try: cached = json.loads(row[7]) if row[7] else {}
                except: pass
                return jsonify({
                    "claimed": True,
                    "username": row[0],
                    "platform": row[1],
                    "savedUrl": row[2],
                    "trackerGgUrl": row[3],
                    "rivalsMetaUrl": row[4],
                    "rivalsTrackerUrl": row[5],
                    "siteUrls": {
                        "trackerGg": row[3],
                        "rivalsMeta": row[4],
                        "rivalsTracker": row[5]
                    },
                    "claimedAt": row[6],
                    "cachedStats": cached
                })
            return jsonify({"claimed": False})
        else:
            cursor = conn.execute('SELECT username, platform, saved_url, tracker_gg_url, rivals_meta_url, rivals_tracker_url, claimed_at FROM claimed_profiles ORDER BY id DESC LIMIT 20')
            rows = cursor.fetchall()
            conn.close()
            return jsonify([
                {
                    "username": r[0],
                    "platform": r[1],
                    "savedUrl": r[2],
                    "trackerGgUrl": r[3],
                    "rivalsMetaUrl": r[4],
                    "rivalsTrackerUrl": r[5],
                    "claimedAt": r[6]
                }
                for r in rows
            ])

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path != "" and app.static_folder and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({"status": "Meowdy 5000 Backend Running"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)