import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import sqlite3
import time
import requests
import json
from datetime import datetime
import urllib.parse
import httpx
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr:
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
CORS(app)

DB = os.path.join(BASE_DIR, 'stats.db')

def get_db_connection():
    return sqlite3.connect(DB)

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS player_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT,
            timestamp DATETIME,
            win_rate REAL,
            kd_ratio REAL,
            top_hero TEXT,
            tracker_score REAL
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS error_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            error_message TEXT,
            stack_trace TEXT,
            user_notes TEXT,
            user_agent TEXT,
            platform TEXT
        );
    """)
    cursor.execute("""
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
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracked_players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_name TEXT UNIQUE NOT NULL,
            profile_url TEXT NOT NULL,
            platform TEXT DEFAULT 'pc',
            is_claimed INTEGER DEFAULT 1,
            last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cached_stats TEXT
        );
    """)
    conn.commit()
    conn.close()

init_db()

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
    except Exception:
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
        "download_url": "https://meowdy5000.synology.me/download/m5-tracker-latest.apk"
    })

@app.route('/download/m5-tracker-latest.apk', methods=['GET'])
@app.route('/download/m5-stat-tracker.apk', methods=['GET'])
def download_latest_apk_flask():
    from flask import send_file
    possible_paths = [
        "/app/dist/m5-tracker-latest.apk",
        "/app/dist/m5-stat-tracker.apk",
        os.path.join(BASE_DIR, "dist", "m5-tracker-latest.apk"),
        os.path.join(BASE_DIR, "..", "app-debug.apk")
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return send_file(p, mimetype="application/vnd.android.package-archive", as_attachment=True, download_name="m5-stat-tracker.apk")
    return jsonify({"error": "APK binary file not found on server."}), 404

@app.route('/api/meta/season', methods=['GET'])
def get_meta_season():
    return jsonify({"season_name": "Season 10", "season_id": "19"})

from backend.services.pipeline import fetch_and_normalize

@app.route('/api/player/<uid>/stats', methods=['GET'])
def get_player_stats_flask(uid):
    platform = request.args.get('platform', 'ps5')
    return jsonify(fetch_and_normalize(uid, platform))

@app.route('/api/stats')
def get_stats():
    query = request.args.get('query', '').strip()
    uid = request.args.get('uid', '').strip()
    target = uid if uid else query
    if not target:
        return jsonify({"error": "Missing UID or Username"}), 400
    platform = request.args.get('platform', 'ps5')
    return jsonify(fetch_and_normalize(target, platform))

@app.route('/api/seasons')
def get_seasons():
    return jsonify({"current_season_id": "19", "current_season_name": "Season 10", "seasons": []})

@app.route('/api/heroes', methods=['GET'])
def get_hero_roster():
    return jsonify({"success": True, "heroes": HERO_MAP, "total": len(HERO_MAP)})

@app.route('/api/report-error', methods=['POST', 'GET'])
def report_error():
    return jsonify({"success": True})

@app.route('/api/report-stat', methods=['POST'])
def report_stat():
    return jsonify({"success": True})

@app.route('/api/player/<uid>/goals', methods=['GET'])
def get_player_goals_flask(uid):
    return jsonify({"goals": []})

@app.route('/api/player/<uid>/maps', methods=['GET'])
def get_player_maps_flask(uid):
    return jsonify([])

@app.route('/api/player/<uid>/synergy', methods=['GET'])
def get_player_synergy_flask(uid):
    return jsonify([])

@app.route('/api/player/<uid>/mastery', methods=['GET'])
def get_player_mastery_flask(uid):
    return jsonify([])

@app.route('/api/player/<uid>/conduct', methods=['GET'])
def get_player_conduct_flask(uid):
    return jsonify({})

@app.route('/api/player/resolve', methods=['GET'])
def resolve_player():
    query = request.args.get('query', '')
    return jsonify({"query": query, "requires_disambiguation": False, "candidates": []})

@app.route('/api/check-update')
def check_update():
    return jsonify({"success": True, "hasUpdate": False})

@app.route('/app-debug.apk', methods=['GET', 'HEAD'])
def download_app_debug_apk():
    return jsonify({"error": "APK not found"}), 404

@app.route("/", defaults={"path": ""}, methods=['GET', 'HEAD'])
@app.route("/<path:path>", methods=['GET', 'HEAD'])
def serve_spa(path):
    if path != "" and app.static_folder and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    if app.static_folder and os.path.exists(os.path.join(app.static_folder, "index.html")):
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({"status": "M5 Backend Running"}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
