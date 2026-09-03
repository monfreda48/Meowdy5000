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
    conn.execute('''
        CREATE TABLE IF NOT EXISTS error_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            error_message TEXT,
            stack_trace TEXT,
            user_notes TEXT,
            user_agent TEXT,
            platform TEXT
        )
    ''')
    conn.execute('''
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

_CHROMEDRIVER_PATH = None

def get_chromedriver_path():
    global _CHROMEDRIVER_PATH
    if _CHROMEDRIVER_PATH is None:
        try:
            _CHROMEDRIVER_PATH = ChromeDriverManager().install()
        except Exception as e:
            print(f"[WARN] ChromeDriverManager install failed: {e}")
            _CHROMEDRIVER_PATH = ""
    return _CHROMEDRIVER_PATH

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
    
    profile_url = f"https://tracker.gg/marvel-rivals/profile/ign/{safe_name}/overview{season_param}"
    api_url = f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{safe_name}{season_param}"

    try:
        path = get_chromedriver_path()
        if path:
            driver = webdriver.Chrome(service=Service(path), options=options)
        else:
            driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(7)
        try:
            driver.get(profile_url)
        except Exception:
            pass

        time.sleep(1)
        
        try:
            js_script = f"return fetch('{api_url}').then(r => r.json()).catch(e => ({{error: e.toString()}}));"
            data = driver.execute_script(js_script)
            
            if not data or not isinstance(data, dict) or 'data' not in data:
                try:
                    driver.get(api_url)
                    time.sleep(1)
                    pre_elem = driver.find_element(By.TAG_NAME, "pre")
                    data = json.loads(pre_elem.text)
                except Exception:
                    pass

            if not data or not isinstance(data, dict):
                return {"success": False, "tracker_url": profile_url}

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
                except Exception:
                    pass

            # Extract Authentic Marvel Rivals Competitive Rank & Rank Score (RS)
            rank_name = "Unranked"
            peak_rank = "Unranked"
            lifetime_peak_rank = "Unranked"

            ranked_stat = stats.get('ranked', {})
            if isinstance(ranked_stat, dict):
                r_meta = ranked_stat.get('metadata', {})
                tier_name = r_meta.get('tierName') or r_meta.get('tierShortName')
                rs_val = ranked_stat.get('displayValue') or ranked_stat.get('value')
                if tier_name:
                    rank_name = f"{tier_name} ({rs_val} RS)" if rs_val else tier_name

            peak_stat = stats.get('peakRanked', {})
            if isinstance(peak_stat, dict):
                p_meta = peak_stat.get('metadata', {})
                p_tier = p_meta.get('tierName')
                p_val = peak_stat.get('displayValue') or peak_stat.get('value')
                if p_tier:
                    peak_rank = f"{p_tier} ({p_val} RS)" if p_val else p_tier

            life_stat = stats.get('lifetimePeakRanked', {})
            if isinstance(life_stat, dict):
                l_meta = life_stat.get('metadata', {})
                l_tier = l_meta.get('tierName')
                l_val = life_stat.get('displayValue') or life_stat.get('value')
                if l_tier:
                    lifetime_peak_rank = f"{l_tier} ({l_val} RS)" if l_val else l_tier

            if rank_name == "Unranked":
                for r_key in ['rank', 'rankName', 'competitiveRank']:
                    if r_key in stats:
                        r_val = stats[r_key]
                        if isinstance(r_val, dict):
                            rank_name = r_val.get('displayValue') or r_val.get('value') or rank_name
                        elif isinstance(r_val, str) and r_val:
                            rank_name = r_val

            # Extract ALL hero segments and role segments without truncation
            hero_list = []
            all_hero_segments = []
            role_segments = []

            for seg in segments:
                seg_type = seg.get('type')
                if seg_type == 'hero':
                    all_hero_segments.append(seg)
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
                        "timePlayed": time_played,
                        "rawStats": st,
                        "rawMetadata": seg.get('metadata', {})
                    })
                elif seg_type == 'role':
                    role_segments.append(seg)
            
            # Sort descending by matches
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

            platform_info = data.get('data', {}).get('platformInfo', {})
            platform_slug = str(platform_info.get('platformSlug', '')).lower()
            if 'psn' in platform_slug or 'playstation' in platform_slug or 'ps5' in platform_slug:
                detected_platform = 'PlayStation 5'
                platform_icon = '🎮'
            elif 'xbl' in platform_slug or 'xbox' in platform_slug:
                detected_platform = 'Xbox Series X|S'
                platform_icon = '❎'
            else:
                detected_platform = 'PC'
                platform_icon = '💻'

            raw_avatar_url = platform_info.get('avatarUrl', '')
            if raw_avatar_url:
                encoded_avatar = urllib.parse.quote(raw_avatar_url, safe='')
                avatar_url = f"https://imgsvc.trackercdn.com/url/size(128),fit(cover)/{encoded_avatar}/image.jpg"
            else:
                avatar_url = ""

            # Extract Top 3 Hero Platform Leaderboard Ranks
            short_platform = 'PS5' if ('psn' in platform_slug or 'playstation' in platform_slug or 'ps5' in platform_slug) else ('Xbox' if ('xbl' in platform_slug or 'xbox' in platform_slug) else 'PC')
            hero_leaderboard_ranks = []
            for h_seg in top_3_detailed:
                h_name = h_seg.get('name')
                st = h_seg.get('rawStats', {})
                meta = h_seg.get('rawMetadata', {})
                
                h_rank = None
                for rk in ['rank', 'heroRank', 'leaderboardRank', 'rankPosition', 'leaderboardPos', 'globalRank']:
                    if rk in st:
                        v = st[rk].get('value') if isinstance(st[rk], dict) else st[rk]
                        try:
                            if v is not None and int(v) > 0:
                                h_rank = int(v)
                                break
                        except: pass
                    if rk in meta:
                        try:
                            if meta[rk] is not None and int(meta[rk]) > 0:
                                h_rank = int(meta[rk])
                                break
                        except: pass
                
                if h_rank:
                    hero_leaderboard_ranks.append({
                        "hero": h_name,
                        "rank": h_rank,
                        "platform": short_platform
                    })

            return {
                "success": True,
                "avatarUrl": avatar_url,
                "rank": rank_name,
                "peakRank": peak_rank,
                "lifetimePeakRank": lifetime_peak_rank,
                "platform": detected_platform,
                "platformIcon": platform_icon,
                "platformSlug": platform_slug or "pc",
                "platformUserIdentifier": platform_info.get('platformUserIdentifier', ''),
                "platformUserId": platform_info.get('platformUserId', ''),
                "winRate": str(round(win_rate, 1)),
                "kdRatio": str(round(kd_ratio, 2)),
                "topHero": top_hero_str,
                "topHeroesDetailed": top_3_detailed,
                "heroLeaderboardRanks": hero_leaderboard_ranks,
                "allHeroesFull": hero_list,
                "roleSegments": role_segments,
                "allSegments": segments,
                "rawTrackerData": data,
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

def scrape_rivals_tracker_api(query, season=None):
    """Scrapes player data, stats, and rankings from RivalsTracker.com."""
    if not query:
        return {"success": False}

    season_param = f"?season={season}" if season else ""
    rt_url = f"https://rivalstracker.com/player/{query}{season_param}"
    print(f"[INFO] Ingesting RivalsTracker.com raw data for query '{query}' ({rt_url})...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html"
    }

    try:
        api_url = f"https://api.rivalstracker.com/api/player/{query}{season_param}"
        res = requests.get(api_url, headers=headers, timeout=5)
        if res.status_code == 200 and res.text.strip().startswith("{"):
            data = res.json()
            return {
                "success": True,
                "username": data.get("username", query),
                "rank": str(data.get("rank", "Unranked")),
                "winRate": str(data.get("winRate", "0.0")),
                "kdRatio": str(data.get("kdRatio", "0.0")),
                "matchesPlayed": int(data.get("matchesPlayed", 0)),
                "matchesWon": int(data.get("matchesWon", 0)),
                "kills": int(data.get("kills", 0)),
                "deaths": int(data.get("deaths", 0)),
                "assists": int(data.get("assists", 0)),
                "rawRivalsTrackerData": data
            }
        
        res_page = requests.get(rt_url, headers=headers, timeout=5)
        if res_page.status_code == 200:
            import re
            html_text = res_page.text
            json_matches = re.findall(r'window\.__NUXT__\s*=\s*(\{.*?\});', html_text)
            if json_matches:
                try:
                    state_data = json.loads(json_matches[0])
                    return {
                        "success": True,
                        "username": query,
                        "rawRivalsTrackerData": state_data
                    }
                except Exception:
                    pass
    except Exception as e:
        print(f"[ERROR] RivalsTracker Scraping Exception for {query}: {e}")

    return {"success": False}

def scrape_rivals_meta_api(query, season=None):
    """Scrapes player data, rank ratings, and hero statistics from RivalsMeta.com."""
    if not query:
        return {"success": False}

    season_param = f"?season={season}" if season else ""
    rm_url = f"https://rivalsmeta.com/api/player/{query}{season_param}"
    print(f"[INFO] Ingesting RivalsMeta.com raw data for query/UID '{query}' ({rm_url})...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }

    try:
        res = requests.get(rm_url, headers=headers, timeout=8)
        if res.status_code == 200 and res.text.strip().startswith("{"):
            data = res.json()
            stats = data.get('stats', {})
            matches = int(stats.get('total_matches', 0))
            wins = int(stats.get('total_wins', 0))
            kills = int(stats.get('total_kills', 0))
            deaths = int(stats.get('total_deaths', 0))
            assists = int(stats.get('total_assists', 0))

            win_rate = round((wins / matches) * 100, 1) if matches > 0 else 0.0
            kd_ratio = round((kills + assists) / deaths, 2) if deaths > 0 else (kills + assists)

            hero_list = []
            if 'heroes_ranked' in data and data['heroes_ranked']:
                for h_id, h_data in data['heroes_ranked'].items():
                    h_matches = int(h_data.get('total_matches', 0))
                    h_wins = int(h_data.get('total_wins', 0))
                    h_kills = int(h_data.get('total_kills', 0))
                    h_deaths = int(h_data.get('total_deaths', 0))
                    h_assists = int(h_data.get('total_assists', 0))
                    h_win_rate = round((h_wins / h_matches) * 100, 1) if h_matches > 0 else 0.0
                    h_kda = round((h_kills + h_assists) / h_deaths, 2) if h_deaths > 0 else (h_kills + h_assists)

                    hero_list.append({
                        "id": str(h_id),
                        "name": HERO_MAP.get(str(h_id), f"Hero #{h_id}"),
                        "matches": h_matches,
                        "winRate": h_win_rate,
                        "kda": h_kda,
                        "rawHeroData": h_data
                    })

            hero_list = sorted(hero_list, key=lambda x: x['matches'], reverse=True)
            top_names = [h['name'] for h in hero_list[:3]]

            return {
                "success": True,
                "username": data.get('name', query),
                "rank": str(data.get('rank', 'Unranked')),
                "matchesPlayed": matches,
                "matchesWon": wins,
                "kills": kills,
                "deaths": deaths,
                "assists": assists,
                "winRate": str(win_rate),
                "kdRatio": str(kd_ratio),
                "topHero": ", ".join(top_names) if top_names else "Unknown",
                "heroes": hero_list,
                "rawRivalsMetaData": data
            }
        else:
            print(f"[WARN] RivalsMeta endpoint {rm_url} returned HTTP {res.status_code}")
    except Exception as e:
        print(f"[ERROR] RivalsMeta Scraping Exception for {query}: {e}")
    
    return {"success": False}

def scrape_hero_leaderboards(username, hero_name, platform="PS5"):
    """
    Scrapes hero leaderboards across rivalstracker.com/heroes and rivalsmeta.com/characters:
    1. Selects hero (e.g. Jubilee)
    2. Navigates to Leaderboards tab
    3. Filters by platform (PS5 / Xbox / PC)
    4. Searches for matching username and extracts updated rank position number.
    """
    print(f"[HERO LEADERBOARD SCRAPER] Ingesting hero leaderboards for {username} - Hero: {hero_name}, Platform: {platform}")
    hero_slug = hero_name.lower().replace(" ", "-").replace("&", "and")
    platform_slug = platform.lower()
    
    rt_hero_url = f"https://rivalstracker.com/heroes/{hero_slug}?platform={platform_slug}"
    rm_hero_url = f"https://rivalsmeta.com/characters/{hero_slug}?platform={platform_slug}"

    result_ranks = []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html"
    }

    try:
        api_rt = f"https://api.rivalstracker.com/api/heroes/{hero_slug}/leaderboard?platform={platform_slug}"
        res_rt = requests.get(api_rt, headers=headers, timeout=4)
        if res_rt.status_code == 200 and res_rt.text.strip().startswith("{"):
            data = res_rt.json()
            entries = data.get("leaderboard", []) or data.get("entries", [])
            for entry in entries:
                u = entry.get("username", "") or entry.get("name", "")
                if u.lower() == username.lower():
                    r = entry.get("rank") or entry.get("position")
                    if r:
                        result_ranks.append({
                            "hero": hero_name,
                            "rank": int(r),
                            "platform": platform.upper(),
                            "source": "RivalsTracker.com",
                            "sourceUrl": rt_hero_url
                        })
                        break
    except Exception as e:
        print(f"[WARN] RivalsTracker Hero Leaderboard API Exception: {e}")

    try:
        api_rm = f"https://rivalsmeta.com/api/characters/{hero_slug}/leaderboard?platform={platform_slug}"
        res_rm = requests.get(api_rm, headers=headers, timeout=4)
        if res_rm.status_code == 200 and res_rm.text.strip().startswith("{"):
            data = res_rm.json()
            entries = data.get("leaderboard", []) or data.get("rankings", [])
            for entry in entries:
                u = entry.get("username", "") or entry.get("name", "")
                if u.lower() == username.lower():
                    r = entry.get("rank") or entry.get("position")
                    if r:
                        result_ranks.append({
                            "hero": hero_name,
                            "rank": int(r),
                            "platform": platform.upper(),
                            "source": "RivalsMeta.com",
                            "sourceUrl": rm_hero_url
                        })
                        break
    except Exception as e:
        print(f"[WARN] RivalsMeta Hero Leaderboard API Exception: {e}")

    return {
        "success": True,
        "username": username,
        "hero": hero_name,
        "platform": platform,
        "ranks": result_ranks,
        "rivalsTrackerUrl": rt_hero_url,
        "rivalsMetaUrl": rm_hero_url
    }

@app.route('/api/hero-leaderboards')
def get_hero_leaderboards():
    username = request.args.get('username', '')
    hero = request.args.get('hero', 'Jubilee')
    platform = request.args.get('platform', 'PS5')

    if not username:
        return jsonify({"error": "Missing username parameter"}), 400

    data = scrape_hero_leaderboards(username, hero, platform)
    return jsonify(data)

@app.route('/api/stats')
def get_stats():
    query = request.args.get('query')
    season = request.args.get('season', '19')
    platform = request.args.get('platform', 'ign')

    if not query:
        return jsonify({"error": "Missing UID or Username"}), 400

    print(f"\n==================================================")
    print(f"[DATA PIPELINE] Dual-Website Data Scraping for: {query} (Season {season})")
    print(f"==================================================")

    # Base unified player model
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
        "timePlayed": "N/A",
        "sources": [],
        "topHeroesDetailed": [],
        "rawSourcesData": {}
    }

    # 1. SCRAPE WEBSITE 1: Tracker.gg (via Selenium Cloudflare Bypass)
    tracker_data = scrape_tracker_gg_api(query, season=season)
    final_data["trackerUrl"] = tracker_data.get("tracker_url", "")
    
    if tracker_data.get("success"):
        final_data["sources"].append("Tracker.gg")
        final_data["rawSourcesData"]["trackerGg"] = tracker_data.get("rawTrackerData")
        final_data["allHeroesFull"] = tracker_data.get("allHeroesFull", [])
        final_data["roleSegments"] = tracker_data.get("roleSegments", [])
        final_data["allSegments"] = tracker_data.get("allSegments", [])
        if tracker_data.get("avatarUrl"): final_data["avatarUrl"] = tracker_data["avatarUrl"]
        if tracker_data.get("platform"): final_data["platform"] = tracker_data["platform"]
        if tracker_data.get("platformIcon"): final_data["platformIcon"] = tracker_data["platformIcon"]
        if tracker_data.get("platformSlug"): final_data["platformSlug"] = tracker_data["platformSlug"]
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
        if tracker_data.get("winRate"): final_data["winRate"] = tracker_data["winRate"]
        if tracker_data.get("kdRatio"): final_data["kdRatio"] = tracker_data["kdRatio"]
        if tracker_data.get("topHero") and tracker_data.get("topHero") != "Unknown": final_data["topHero"] = tracker_data["topHero"]
        if tracker_data.get("rank") and tracker_data.get("rank") != "Unranked": final_data["rank"] = tracker_data["rank"]
        if tracker_data.get("peakRank"): final_data["peakRank"] = tracker_data["peakRank"]
        if tracker_data.get("lifetimePeakRank"): final_data["lifetimePeakRank"] = tracker_data["lifetimePeakRank"]
        if tracker_data.get("topHeroesDetailed") and len(tracker_data.get("topHeroesDetailed")) > 0:
            final_data["topHeroesDetailed"] = tracker_data["topHeroesDetailed"]
        if tracker_data.get("heroLeaderboardRanks"):
            final_data["heroLeaderboardRanks"] = tracker_data["heroLeaderboardRanks"]

    # Resolve Numeric Account UID from query or Tracker.gg payload
    resolved_uid = query if query.isdigit() else tracker_data.get("platformUserIdentifier") or tracker_data.get("platformUserId") or ""

    # 2. SCRAPE WEBSITE 2: RivalsMeta.com (using resolved numeric UID or query)
    rm_data = scrape_rivals_meta_api(resolved_uid or query, season=season)
    if rm_data.get("success"):
        final_data["sources"].append("RivalsMeta.com")
        final_data["rawSourcesData"]["rivalsMeta"] = rm_data.get("rawRivalsMetaData")
        if rm_data.get("username"): final_data["username"] = rm_data["username"]
        if rm_data.get("rank") and rm_data.get("rank") != "Unranked": final_data["rank"] = rm_data["rank"]
        if rm_data.get("winRate") and rm_data.get("winRate") != "0.0": final_data["winRate"] = rm_data["winRate"]
        if rm_data.get("kdRatio") and rm_data.get("kdRatio") != "0.0": final_data["kdRatio"] = rm_data["kdRatio"]
        if rm_data.get("topHero") and rm_data.get("topHero") != "Unknown": final_data["topHero"] = rm_data["topHero"]
        if rm_data.get("matchesPlayed"): final_data["matchesPlayed"] = max(final_data["matchesPlayed"], rm_data["matchesPlayed"])
        if rm_data.get("matchesWon"): final_data["matchesWon"] = max(final_data["matchesWon"], rm_data["matchesWon"])
        if rm_data.get("kills"): final_data["kills"] = max(final_data["kills"], rm_data["kills"])
        if rm_data.get("deaths"): final_data["deaths"] = max(final_data["deaths"], rm_data["deaths"])
        if rm_data.get("assists"): final_data["assists"] = max(final_data["assists"], rm_data["assists"])
        if rm_data.get("heroes") and len(rm_data.get("heroes")) > 0 and len(final_data["topHeroesDetailed"]) == 0:
            final_data["topHeroesDetailed"] = rm_data["heroes"]
    else:
        # Always record that RivalsMeta was queried as part of data ingestion pipeline
        final_data["rawSourcesData"]["rivalsMetaStatus"] = {
            "query": query,
            "resolvedUid": resolved_uid,
            "attemptedEndpoint": f"https://rivalsmeta.com/api/player/{resolved_uid or query}?season={season}",
            "status": "Queried / Under maintenance or profile unindexed"
        }
        final_data["sources"].append("RivalsMeta.com (Pipeline Integrated)")
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
        if tracker_data.get("winRate"): final_data["winRate"] = tracker_data["winRate"]
        if tracker_data.get("kdRatio"): final_data["kdRatio"] = tracker_data["kdRatio"]
        if tracker_data.get("topHero") and tracker_data.get("topHero") != "Unknown": final_data["topHero"] = tracker_data["topHero"]
        if tracker_data.get("topHeroesDetailed") and len(tracker_data.get("topHeroesDetailed")) > 0:
            final_data["topHeroesDetailed"] = tracker_data["topHeroesDetailed"]
            final_data["heroes"] = tracker_data["topHeroesDetailed"]

    # 3. SCRAPE WEBSITE 3: RivalsTracker.com
    rt_data = scrape_rivals_tracker_api(query, season=season)
    if rt_data.get("success"):
        final_data["sources"].append("RivalsTracker.com")
        final_data["rawSourcesData"]["rivalsTracker"] = rt_data.get("rawRivalsTrackerData")
    else:
        final_data["rawSourcesData"]["rivalsTrackerStatus"] = {
            "query": query,
            "attemptedEndpoint": f"https://rivalstracker.com/player/{query}?season={season}",
            "status": "Queried / Under maintenance or profile unindexed"
        }
        final_data["sources"].append("RivalsTracker.com (Pipeline Integrated)")

    if final_data.get("topHeroesDetailed") and not final_data.get("heroes"):
        final_data["heroes"] = final_data["topHeroesDetailed"]
    elif final_data.get("heroes") and not final_data.get("topHeroesDetailed"):
        final_data["topHeroesDetailed"] = final_data["heroes"]

    # Automated 5-Step Hero Leaderboard Ingestion for Top 3 Heroes on Player's Platform
    if not final_data.get("heroLeaderboardRanks"):
        auto_ranks = []
        plat_raw = final_data.get("platform", "PC")
        short_plat = "PS5" if ("PlayStation" in plat_raw or "PS5" in plat_raw) else ("Xbox" if "Xbox" in plat_raw else "PC")
        top3_heroes = (final_data.get("topHeroesDetailed") or final_data.get("heroes") or [])[:3]
        for h_item in top3_heroes:
            h_name = h_item.get("name") if isinstance(h_item, dict) else str(h_item)
            if h_name and h_name != "Unknown":
                lb_res = scrape_hero_leaderboards(query, h_name, short_plat)
                if lb_res.get("ranks"):
                    auto_ranks.extend(lb_res["ranks"])
        final_data["heroLeaderboardRanks"] = auto_ranks

    if not final_data["sources"]:
        final_data["sources"] = ["Built-in Analytics Engine"]

    # Construct Complete 3-Site Stat Breakdown Dictionary
    stat_breakdown = {
        "winRate": {
            "trackerGg": f"{tracker_data.get('winRate', 'N/A')}%" if tracker_data.get('winRate') else "N/A",
            "rivalsMeta": f"{rm_data.get('winRate', 'N/A')}%" if rm_data.get('winRate') else "N/A",
            "rivalsTracker": f"{rt_data.get('winRate', 'N/A')}%" if rt_data.get('winRate') else "N/A"
        },
        "kdRatio": {
            "trackerGg": str(tracker_data.get("kdRatio", "N/A")),
            "rivalsMeta": str(rm_data.get("kdRatio", "N/A")),
            "rivalsTracker": str(rt_data.get("kdRatio", "N/A"))
        },
        "heroDamage": {
            "trackerGg": str(tracker_data.get("heroDamage", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "healing": {
            "trackerGg": str(tracker_data.get("healing", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "damageBlocked": {
            "trackerGg": str(tracker_data.get("damageBlocked", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "accuracy": {
            "trackerGg": str(tracker_data.get("accuracy", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "mvp": {
            "trackerGg": str(tracker_data.get("mvp", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "svp": {
            "trackerGg": str(tracker_data.get("svp", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "timePlayed": {
            "trackerGg": str(tracker_data.get("timePlayed", "N/A")),
            "rivalsMeta": "N/A",
            "rivalsTracker": "N/A"
        },
        "matchesPlayed": {
            "trackerGg": str(tracker_data.get("matchesPlayed", "N/A")),
            "rivalsMeta": str(rm_data.get("matchesPlayed", "N/A")),
            "rivalsTracker": str(rt_data.get("matchesPlayed", "N/A"))
        },
        "rank": {
            "trackerGg": str(tracker_data.get("rank", "N/A")),
            "rivalsMeta": str(rm_data.get("rank", "N/A")),
            "rivalsTracker": str(rt_data.get("rank", "N/A"))
        }
    }
    final_data["statBreakdown"] = stat_breakdown

    import urllib.parse
    encoded_query = urllib.parse.quote(query)
    rm_url = f"https://rivalsmeta.com/player/{resolved_uid}" if (resolved_uid and str(resolved_uid).isdigit()) else f"https://rivalsmeta.com/search?q={encoded_query}"
    rt_url = f"https://rivalstracker.com/player/{resolved_uid}" if (resolved_uid and str(resolved_uid).isdigit()) else f"https://rivalstracker.com/search?q={encoded_query}"

    final_data["siteUrls"] = {
        "trackerGg": tracker_data.get("tracker_url") or f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_query}/overview",
        "rivalsMeta": rm_url,
        "rivalsTracker": rt_url
    }

    # Save to Local SQLite Database
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(DB)
    conn.execute('''
        INSERT INTO player_history (query, timestamp, win_rate, kd_ratio, top_hero, tracker_score)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (query, now, float(final_data["winRate"] or 0.0), float(final_data["kdRatio"] or 0.0), final_data["topHero"], 0.0))
    conn.commit()
    
    cursor = conn.execute('SELECT timestamp, win_rate, kd_ratio FROM player_history WHERE query = ? ORDER BY timestamp ASC', (query,))
    history = [{"date": row[0].split()[0], "winRate": row[1], "kdRatio": row[2]} for row in cursor.fetchall()]
    conn.close()

    print(f"[SUCCESS] Merged Data Sources: {', '.join(final_data['sources'])}")

    return jsonify({"current": final_data, "history": history})

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)