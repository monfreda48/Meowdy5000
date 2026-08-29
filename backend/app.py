import sqlite3
import time
import requests
import json
import sys
from datetime import datetime
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

DB = 'stats.db'

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
    # Pointing the browser DIRECTLY at their hidden JSON data!
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

            # The first segment is usually overall stats
            stats = segments[0].get('stats', {})
            print(f"=== TRACKER.GG AVAILABLE STATS: {list(stats.keys())[:10]} ===")
            
            # Extract standard Tracker stats
            win_stat = stats.get('matchesWinPct', {})
            win_rate = win_stat.get('value', 0.0) if isinstance(win_stat, dict) else float(win_stat or 0.0)
            
            kda_stat = stats.get('kdaRatio', stats.get('kdRatio', {}))
            kd_ratio = kda_stat.get('value', 0.0) if isinstance(kda_stat, dict) else float(kda_stat or 0.0)
            
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

            return {
                "success": True,
                "winRate": str(round(win_rate, 1)),
                "kdRatio": str(round(kd_ratio, 2)),
                "topHero": top_hero_str,
                "topHeroesDetailed": top_3_detailed,
                "matchesPlayed": int(stats.get('matchesPlayed', {}).get('value', 0) if isinstance(stats.get('matchesPlayed'), dict) else (stats.get('matchesPlayed') or 0)),
                "matchesWon": int(stats.get('matchesWon', {}).get('value', 0) if isinstance(stats.get('matchesWon'), dict) else (stats.get('matchesWon') or 0)),
                "kills": int(stats.get('kills', {}).get('value', 0) if isinstance(stats.get('kills'), dict) else (stats.get('kills') or 0)),
                "deaths": int(stats.get('deaths', {}).get('value', 0) if isinstance(stats.get('deaths'), dict) else (stats.get('deaths') or 0)),
                "assists": int(stats.get('assists', {}).get('value', 0) if isinstance(stats.get('assists'), dict) else (stats.get('assists') or 0)),
                "heroDamage": str(stats.get('totalHeroDamage', {}).get('displayValue', stats.get('totalHeroDamage', {}).get('value', 'N/A')) if isinstance(stats.get('totalHeroDamage'), dict) else (stats.get('totalHeroDamage') or 'N/A')),
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

    if not query:
        return jsonify({"error": "Missing UID or Username"}), 400

    # Default fallback data
    final_data = {
        "username": query,
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
    final_data["topHeroesDetailed"] = tracker_data.get("topHeroesDetailed", [])

    if tracker_data.get("success"):
        if tracker_data.get("matchesPlayed"): final_data["matchesPlayed"] = tracker_data["matchesPlayed"]
        if tracker_data.get("matchesWon"): final_data["matchesWon"] = tracker_data["matchesWon"]
        if tracker_data.get("kills"): final_data["kills"] = tracker_data["kills"]
        if tracker_data.get("deaths"): final_data["deaths"] = tracker_data["deaths"]
        if tracker_data.get("assists"): final_data["assists"] = tracker_data["assists"]
        if tracker_data.get("heroDamage"): final_data["heroDamage"] = tracker_data["heroDamage"]
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)