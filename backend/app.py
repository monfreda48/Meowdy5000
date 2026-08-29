import sqlite3
import time
import requests
import json
import sys
from datetime import datetime
import urllib.parse
from flask import Flask, request, jsonify
from flask_cors import CORS

# Ensure UTF-8 output encoding for stdout/stderr on Windows
if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr:
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# Selenium Imports for bypassing Cloudflare
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

app = Flask(__name__)
CORS(app)

import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE_DIR, 'stats.db')

def init_db():
    conn = sqlite3.connect(DB)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS player_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query TEXT,
            timestamp DATETIME,
            win_rate REAL,
            kd_ratio REAL,
            top_hero TEXT,
            tracker_score REAL
        )
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

def scrape_tracker_gg_api(username, season=None):
    """Uses Selenium to fetch Tracker.gg's protected API."""
    season_str = f" for season {season}" if season else ""
    print(f"[INFO] Launching Headless Chrome to fetch Tracker.gg API for {username}{season_str}...")
    
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    safe_name = username.replace(" ", "%20")
    season_param = f"?season={season}" if season else ""
    
    # Pointing the browser DIRECTLY at API JSON data!
    api_url = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{safe_name}{season_param}"
    profile_url = f"https://tracker.gg/marvel-rivals/profile/ign/{safe_name}/overview{season_param}"
    
    try:
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        driver.get(api_url)
        time.sleep(5) # Wait for Cloudflare to verify the browser
        
        try:
            # The browser automatically wraps raw JSON in a <pre> tag, so we pull it out!
            json_text = driver.find_element(By.TAG_NAME, "pre").text
            data = json.loads(json_text)
            
            print("[SUCCESS] Tracker.gg API Bypassed Successfully!")
            
            # Drill into Tracker's standard API layout
            segments = data.get('data', {}).get('segments', [])
            if not segments:
                return {"success": False, "tracker_url": profile_url}

            # The first segment is overall player stats
            stats = segments[0].get('stats', {})
            
            win_stat = stats.get('matchesWinPct', {})
            win_rate = win_stat.get('value', 0.0) if isinstance(win_stat, dict) else float(win_stat or 0.0)
            
            kda_stat = stats.get('kdaRatio', stats.get('kdRatio', {}))
            kd_ratio = kda_stat.get('value', 0.0) if isinstance(kda_stat, dict) else float(kda_stat or 0.0)

            time_sec_raw = stats.get('timePlayed', {}).get('value', 0) if isinstance(stats.get('timePlayed'), dict) else 0
            try: time_sec = float(time_sec_raw or 0)
            except: time_sec = 0

            hero_dmg_per_10 = calc_per_10m(stats, ['heroDamagePer10', 'totalHeroDamagePer10'], ['totalHeroDamage', 'heroDamage'], time_sec)
            healing_per_10 = calc_per_10m(stats, ['healingPer10', 'totalHeroHealPerMinute'], ['totalHeroHeal', 'totalHealing', 'healing'], time_sec)
            blocked_per_10 = calc_per_10m(stats, ['damageBlockedPer10', 'totalDamageTakenPerMinute'], ['totalDamageTaken', 'totalDamageBlocked', 'damageMitigated'], time_sec)
            
            # Calculate accuracy percentage from mainAttackHits / mainAttacks
            accuracy_val = "N/A"
            m_attacks = stats.get('mainAttacks', {}).get('value', 0) if isinstance(stats.get('mainAttacks'), dict) else 0
            m_hits = stats.get('mainAttackHits', {}).get('value', 0) if isinstance(stats.get('mainAttackHits'), dict) else 0
            if m_attacks and m_attacks > 0 and m_hits:
                try:
                    acc_pct = round((float(m_hits) / float(m_attacks)) * 100, 1)
                    accuracy_val = f"{acc_pct}%"
                except:
                    pass
            
            hero_list = []
            for seg in segments:
                if seg.get('type') == 'hero':
                    name = seg.get('metadata', {}).get('name', 'Unknown')
                    st = seg.get('stats', {})
                    matches = st.get('matchesPlayed', {}).get('value', 0)
                    h_win_rate = st.get('matchesWinPct', {}).get('value', 0)
                    h_kda = st.get('kdaRatio', {}).get('value', 0)
                    if not h_kda: h_kda = st.get('kdRatio', {}).get('value', 0)
                    time_played = st.get('timePlayed', {}).get('displayValue', '0s')
                    
                    hero_list.append({
                        "name": name, 
                        "matches": int(matches if matches else 0),
                        "winRate": round(float(h_win_rate if h_win_rate else 0.0), 1),
                        "kda": round(float(h_kda if h_kda else 0.0), 2),
                        "timePlayed": time_played
                    })
            
            # Sort descending by matches and format into detailed list
            hero_list = sorted(hero_list, key=lambda x: x['matches'], reverse=True)
            top_3_detailed = hero_list[:3]
            top_3_names = [h['name'] for h in top_3_detailed]
            top_hero_str = ", ".join(top_3_names) if top_3_names else "Unknown"

            # MVP & SVP Extraction
            mvp_val = stats.get('totalMvp', {}).get('value', 0) if isinstance(stats.get('totalMvp'), dict) else (stats.get('totalMvp') or 0)
            mvp_pct = stats.get('totalMvpPct', {}).get('value', 0) if isinstance(stats.get('totalMvpPct'), dict) else (stats.get('totalMvpPct') or 0)
            
            svp_val = stats.get('totalSvp', {}).get('value', 0) if isinstance(stats.get('totalSvp'), dict) else (stats.get('totalSvp') or 0)
            svp_pct = stats.get('totalSvpPct', {}).get('value', 0) if isinstance(stats.get('totalSvpPct'), dict) else (stats.get('totalSvpPct') or 0)
            
            mvp_str = f"{int(mvp_val)} ({round(float(mvp_pct), 1)}%)" if mvp_val else "0"
            svp_str = f"{int(svp_val)} ({round(float(svp_pct), 1)}%)" if svp_val else "0"

            raw_avatar_url = data.get('data', {}).get('platformInfo', {}).get('avatarUrl', '')
            if raw_avatar_url:
                encoded_avatar = urllib.parse.quote(raw_avatar_url, safe='')
                avatar_url = f"https://imgsvc.trackercdn.com/url/size(128),fit(cover)/{encoded_avatar}/image.jpg"
            else:
                avatar_url = ""

            return {
                "success": True,
                "avatarUrl": avatar_url,
                "winRate": str(round(win_rate, 1)),
                "kdRatio": str(round(kd_ratio, 2)),
                "topHero": top_hero_str,
                "topHeroesDetailed": top_3_detailed,
                "matchesPlayed": int(stats.get('matchesPlayed', {}).get('value', 0) if isinstance(stats.get('matchesPlayed'), dict) else (stats.get('matchesPlayed') or 0)),
                "matchesWon": int(stats.get('matchesWon', {}).get('value', 0) if isinstance(stats.get('matchesWon'), dict) else (stats.get('matchesWon') or 0)),
                "kills": int(stats.get('kills', {}).get('value', 0) if isinstance(stats.get('kills'), dict) else (stats.get('kills') or 0)),
                "deaths": int(stats.get('deaths', {}).get('value', 0) if isinstance(stats.get('deaths'), dict) else (stats.get('deaths') or 0)),
                "assists": int(stats.get('assists', {}).get('value', 0) if isinstance(stats.get('assists'), dict) else (stats.get('assists') or 0)),
                "heroDamage": hero_dmg_per_10,
                "healing": healing_per_10,
                "damageBlocked": blocked_per_10,
                "accuracy": accuracy_val,
                "mvp": mvp_str,
                "svp": svp_str,
                "totalHeroDamageRaw": int(stats.get('totalHeroDamage', {}).get('value', 0) if isinstance(stats.get('totalHeroDamage'), dict) else (stats.get('totalHeroDamage') or 0)),
                "totalHeroHealRaw": int(stats.get('totalHeroHeal', {}).get('value', 0) if isinstance(stats.get('totalHeroHeal'), dict) else (stats.get('totalHeroHeal') or 0)),
                "totalDamageTakenRaw": int(stats.get('totalDamageTaken', {}).get('value', 0) if isinstance(stats.get('totalDamageTaken'), dict) else (stats.get('totalDamageTaken') or 0)),
                "mainAttacks": int(m_attacks),
                "mainAttackHits": int(m_hits),
                "timePlayed": str(stats.get('timePlayed', {}).get('displayValue', 'N/A') if isinstance(stats.get('timePlayed'), dict) else (stats.get('timePlayed') or 'N/A')),
                "tracker_url": profile_url
            }
            
        except Exception as e:
            print(f"[ERROR] JSON Parse Error (Maybe blocked?): {e}")
            return {"success": False, "tracker_url": profile_url}
            
    except Exception as e:
        print(f"[ERROR] Selenium Error: {e}")
        return {"success": False, "tracker_url": profile_url}
    finally:
        driver.quit()

@app.route('/api/stats')
def get_stats():
    query = request.args.get('query')
    season = request.args.get('season', '19')
    platform = request.args.get('platform', 'ign')

    if not query:
        return jsonify({"error": "Missing UID or Username"}), 400

    # Default fallback data
    final_data = {
        "username": query,
        "avatarUrl": "",
        "rank": "Unranked",
        "winRate": "0.0",
        "kdRatio": "0.0",
        "topHero": "Unknown",
        "trackerScore": "0.0",
        "trackerUrl": "",
        "matchesPlayed": 0,
        "matchesWon": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "heroDamage": "N/A",
        "healing": "N/A",
        "damageBlocked": "N/A",
        "accuracy": "N/A",
        "mvp": "0",
        "svp": "0",
        "timePlayed": "N/A"
    }

    # ROUTE 1: Numeric UID -> RivalsMeta
    if query.isdigit():
        print(f"[SEARCH] UID Detected. Hitting RivalsMeta API for {query}...")
        rm_url = f"https://rivalsmeta.com/api/player/{query}?season={season}"
        try:
            res = requests.get(rm_url, headers={"User-Agent": "Mozilla/5.0"})
            if res.status_code == 200:
                data = res.json()
                final_data["username"] = data.get('name', query)
                final_data["rank"] = str(data.get('rank', 'Unranked'))
                
                stats = data.get('stats', {})
                matches = int(stats.get('total_matches', 0))
                wins = int(stats.get('total_wins', 0))
                kills = int(stats.get('total_kills', 0))
                deaths = int(stats.get('total_deaths', 0))
                assists = int(stats.get('total_assists', 0))

                final_data["matchesPlayed"] = matches
                final_data["matchesWon"] = wins
                final_data["kills"] = kills
                final_data["deaths"] = deaths
                final_data["assists"] = assists

                if matches > 0:
                    final_data["winRate"] = str(round((wins / matches) * 100, 1))
                
                if deaths > 0:
                    final_data["kdRatio"] = str(round((kills + assists) / deaths, 2))
                
                # FIX: Sort RivalsMeta heroes by total matches and grab top 3
                if 'heroes_ranked' in data and data['heroes_ranked']:
                    sorted_heroes = sorted(data['heroes_ranked'].items(), key=lambda x: int(x[1].get('total_matches', 0)), reverse=True)
                    top_3_ids = [str(x[0]) for x in sorted_heroes[:3]]
                    top_3_names = [HERO_MAP.get(h_id, f"Hero #{h_id}") for h_id in top_3_ids]
                    final_data["topHero"] = ", ".join(top_3_names)

        except Exception as e:
            print(f"[ERROR] RivalsMeta Error: {e}")

    # ROUTE 2: Tracker.gg API via Selenium
    tracker_data = scrape_tracker_gg_api(final_data["username"], season=season)
    final_data["trackerUrl"] = tracker_data.get("tracker_url", "")
    final_data["avatarUrl"] = tracker_data.get("avatarUrl", "")
    final_data["topHeroesDetailed"] = tracker_data.get("topHeroesDetailed", [])

    if tracker_data.get("success"):
        if tracker_data.get("matchesPlayed"): final_data["matchesPlayed"] = tracker_data["matchesPlayed"]
        if tracker_data.get("matchesWon"): final_data["matchesWon"] = tracker_data["matchesWon"]
        if tracker_data.get("kills"): final_data["kills"] = tracker_data["kills"]
        if tracker_data.get("deaths"): final_data["deaths"] = tracker_data["deaths"]
        if tracker_data.get("assists"): final_data["assists"] = tracker_data["assists"]
        if tracker_data.get("heroDamage"): final_data["heroDamage"] = tracker_data["heroDamage"]
        if tracker_data.get("healing"): final_data["healing"] = tracker_data["healing"]
        if tracker_data.get("damageBlocked"): final_data["damageBlocked"] = tracker_data["damageBlocked"]
        if tracker_data.get("accuracy"): final_data["accuracy"] = tracker_data["accuracy"]
        if tracker_data.get("mvp"): final_data["mvp"] = tracker_data["mvp"]
        if tracker_data.get("svp"): final_data["svp"] = tracker_data["svp"]
        if tracker_data.get("totalHeroDamageRaw"): final_data["totalHeroDamageRaw"] = tracker_data["totalHeroDamageRaw"]
        if tracker_data.get("totalHeroHealRaw"): final_data["totalHeroHealRaw"] = tracker_data["totalHeroHealRaw"]
        if tracker_data.get("totalDamageTakenRaw"): final_data["totalDamageTakenRaw"] = tracker_data["totalDamageTakenRaw"]
        if tracker_data.get("mainAttacks"): final_data["mainAttacks"] = tracker_data["mainAttacks"]
        if tracker_data.get("mainAttackHits"): final_data["mainAttackHits"] = tracker_data["mainAttackHits"]
        if tracker_data.get("timePlayed"): final_data["timePlayed"] = tracker_data["timePlayed"]
    
    # If the user typed a name, they skipped Route 1. We MUST fill their stats using Tracker.gg!
    if not query.isdigit() and tracker_data.get("success"):
        final_data["winRate"] = tracker_data.get("winRate", "0.0")
        final_data["kdRatio"] = tracker_data.get("kdRatio", "0.0")
        final_data["topHero"] = tracker_data.get("topHero", "Unknown")
        final_data["rank"] = "Tracker.gg Verified"

    # Save to Database
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB)
    conn.execute('''
        INSERT INTO player_history (query, timestamp, win_rate, kd_ratio, top_hero, tracker_score)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (query, now, float(final_data["winRate"]), float(final_data["kdRatio"]), final_data["topHero"], 0.0))
    conn.commit()
    
    cursor = conn.execute('SELECT timestamp, win_rate, kd_ratio FROM player_history WHERE query = ? ORDER BY timestamp ASC', (query,))
    history = [{"date": row[0].split()[0], "winRate": row[1], "kdRatio": row[2]} for row in cursor.fetchall()]
    conn.close()

    return jsonify({"current": final_data, "history": history})

CURRENT_VERSION_COMMIT = "0f7a284"

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

@app.route('/api/check-update')
def check_update():
    """Queries GitHub API for the latest commit on monfreda48/Meowdy5000 repo."""
    local_sha = get_local_commit_sha()
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
                "latestVersion": latest_sha,
                "latestMessage": commit_msg,
                "latestDate": commit_date,
                "commitUrl": commit_url,
                "hasUpdate": has_update,
                "repoUrl": "https://github.com/monfreda48/Meowdy5000",
                "apkUrl": "https://github.com/monfreda48/Meowdy5000/releases/download/latest/app-debug.apk",
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)