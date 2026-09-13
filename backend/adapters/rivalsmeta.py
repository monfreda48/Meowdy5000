import os
import re
import json
import time
import asyncio
import sqlite3
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger("rivalsmeta_adapter")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_TTL_SECONDS = 12 * 60 * 60  # 12-hour TTL

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

def normalize_season(raw_val: Any) -> Dict[str, Any]:
    """
    Normalizes NetEase internal season IDs and scraped text into display strings.
    NetEase uses half-season increments (e.g. 20 = Season 10, 21 = Season 10.5 / Phase 2).
    """
    if raw_val is None:
        return {"display_name": "SEASON 10", "internal_id": 20, "is_half_season": False}
        
    val_str = str(raw_val).strip()
    
    # Case A: Pure integer or integer string (e.g., 20 or "20")
    if val_str.isdigit():
        num = int(val_str)
        if num >= 15:
            season_major = num // 2
            is_half = (num % 2) != 0
            display = f"SEASON {season_major}.5" if is_half else f"SEASON {season_major}"
            return {"display_name": display, "internal_id": num, "is_half_season": is_half}
        else:
            return {"display_name": f"SEASON {num}", "internal_id": num * 2, "is_half_season": False}

    # Case B: Regex match on strings like "Season 10", "Season 20", "S10"
    match = re.search(r'(?:SEASON|S)\s*(\d+)(?:\.(\d+))?', val_str, re.IGNORECASE)
    if match:
        major = int(match.group(1))
        sub = match.group(2)
        if major >= 15:
            season_major = major // 2
            is_half = (major % 2) != 0 or (sub is not None and sub != '0')
            display = f"SEASON {season_major}.5" if is_half else f"SEASON {season_major}"
            return {"display_name": display, "internal_id": major, "is_half_season": is_half}
        else:
            is_half = sub is not None and sub != '0'
            display = f"SEASON {major}.{sub}" if is_half else f"SEASON {major}"
            return {"display_name": display, "internal_id": major * 2 + (1 if is_half else 0), "is_half_season": is_half}

    return {"display_name": "SEASON 10", "internal_id": 20, "is_half_season": False}

def clear_stale_meta_cache(db_filename: str = "rivals_tracker.db"):
    db_path = os.path.join(BASE_DIR, db_filename)
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("DELETE FROM meta_cache WHERE key = 'season_meta' OR key = 'season_data';")
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Error clearing stale meta_cache from {db_filename}: {e}")

def get_cached_meta_season(db_filename: str = "rivals_tracker.db") -> Optional[Dict[str, Any]]:
    db_path = os.path.join(BASE_DIR, db_filename)
    if not os.path.exists(db_path):
        return None
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meta_cache (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at INTEGER NOT NULL
            );
        """)
        cur.execute("SELECT data, cached_at FROM meta_cache WHERE key = 'season_meta';")
        row = cur.fetchone()
        conn.close()
        if row:
            data_str, cached_at = row
            if (time.time() - cached_at) < CACHE_TTL_SECONDS:
                parsed = json.loads(data_str)
                if isinstance(parsed, dict) and not parsed.get("error") and parsed.get("season_name"):
                    return parsed
    except Exception as e:
        logger.warning(f"Error reading meta_cache from {db_filename}: {e}")
    return None

def save_cached_meta_season(data: Dict[str, Any], db_filename: str = "rivals_tracker.db"):
    if not isinstance(data, dict) or data.get("error"):
        return
    db_path = os.path.join(BASE_DIR, db_filename)
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meta_cache (
                key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                cached_at INTEGER NOT NULL
            );
        """)
        cur.execute("""
            INSERT INTO meta_cache (key, data, cached_at)
            VALUES ('season_meta', ?, ?)
            ON CONFLICT(key) DO UPDATE SET data=excluded.data, cached_at=excluded.cached_at;
        """, (json.dumps(data), int(time.time())))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Error saving meta_cache to {db_filename}: {e}")

async def debug_scrape_rivalsmeta_season() -> Dict[str, Any]:
    """
    Bypasses SQLite cache completely, fetches fresh markup from upstream directly,
    and returns diagnostic status & metadata.
    """
    raw_title = ""
    raw_season = None
    detected_end_date = None
    http_status = 500

    targets = [
        "https://rivalstracker.com/tier-list",
        "https://rivalsmeta.com/tier-list",
        "https://rivalsmeta.com"
    ]

    for url in targets:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(url, headers=DEFAULT_HEADERS)
                http_status = res.status_code
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    if soup.title and soup.title.string and not raw_title:
                        raw_title = soup.title.string.strip()

                    # Check script hydration for season_id, season_index, currentSeason, season_number
                    for script_id in ["__NEXT_DATA__", "__NUXT_DATA__"]:
                        script_tag = soup.find("script", id=script_id)
                        if script_tag and script_tag.string:
                            m = re.search(r'"(?:season_id|season_index|currentSeason|season_number|seasonName|season)"\s*:\s*"?([^",}]+)"?', script_tag.string, re.IGNORECASE)
                            if m:
                                raw_season = m.group(1).strip()
                                break

                    # Check text regex with strict word boundary r'\bSeason\s+(\d+(?:\.\d+)?)\b'
                    if not raw_season:
                        matches = re.findall(r'\bSeason\s+(\d+(?:\.\d+)?)\b', res.text, re.IGNORECASE)
                        if matches:
                            raw_season = f"Season {matches[0].strip()}"

                    if raw_season:
                        break
        except Exception as e:
            logger.warning(f"Debug probe failed for {url}: {e}")

    norm = normalize_season(raw_season)

    return {
        "raw_scraped_title": raw_title,
        "raw_season": raw_season or "Season 20",
        "detected_season": norm["display_name"],
        "internal_season_id": norm["internal_id"],
        "is_half_season": norm["is_half_season"],
        "detected_end_date": detected_end_date or "2026-10-15T00:00:00Z",
        "http_status": http_status,
        "cache_ttl_active": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

async def fetch_rivalsmeta_season(force_refresh: bool = False) -> Dict[str, Any]:
    if not force_refresh:
        for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
            cached = get_cached_meta_season(db_file)
            if cached:
                logger.info(f"Loaded valid 12h season metadata cache from {db_file}")
                return cached

    targets = [
        ("https://rivalstracker.com/tier-list", "rivalstracker.com"),
        ("https://rivalsmeta.com/tier-list", "rivalsmeta.com"),
        ("https://rivalsmeta.com", "rivalsmeta.com")
    ]

    for url, source_domain in targets:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                res = await client.get(url, headers=DEFAULT_HEADERS)
                if res.status_code == 200:
                    soup = BeautifulSoup(res.text, "html.parser")
                    script_tag = soup.find("script", id="__NEXT_DATA__") or soup.find("script", id="__NUXT_DATA__")

                    raw_season = None
                    end_timestamp = None
                    upcoming_hero = None

                    if script_tag and script_tag.string:
                        try:
                            season_m = re.search(r'"(?:season_id|season_index|currentSeason|season_number|seasonName|season)"\s*:\s*"?([^",}]+)"?', script_tag.string, re.IGNORECASE)
                            if season_m:
                                raw_season = season_m.group(1).strip()
                            hero_m = re.search(r'"upcomingHero"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if hero_m:
                                upcoming_hero = hero_m.group(1)
                            end_m = re.search(r'"endDate"\s*:\s*"([^"]+)"', script_tag.string, re.IGNORECASE)
                            if end_m:
                                end_timestamp = end_m.group(1)
                        except Exception as json_err:
                            logger.warning(f"Failed parsing script data from {url}: {json_err}")

                    if not raw_season:
                        matches = re.findall(r'\bSeason\s+(\d+(?:\.\d+)?)\b', res.text, re.IGNORECASE)
                        if matches:
                            raw_season = f"Season {matches[0].strip()}"

                    if raw_season:
                        norm = normalize_season(raw_season)
                        season_display = norm["display_name"]

                        if not end_timestamp:
                            now_dt = datetime.now(timezone.utc)
                            end_dt = now_dt + timedelta(days=31)
                            end_timestamp = end_dt.isoformat()

                        try:
                            end_dt = datetime.fromisoformat(end_timestamp.replace("Z", "+00:00"))
                            now_dt = datetime.now(timezone.utc)
                            days_rem = max(0, (end_dt - now_dt).days)
                        except Exception:
                            days_rem = 31

                        meta_data = {
                            "season_name": season_display,
                            "internal_season_id": norm["internal_id"],
                            "is_half_season": norm["is_half_season"],
                            "end_timestamp": end_timestamp,
                            "days_remaining": days_rem,
                            "upcoming_hero": upcoming_hero or "Hawkeye",
                            "source": source_domain,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }

                        for db_file in ["rivals_tracker.db", "stats.db", "rivals.db"]:
                            save_cached_meta_season(meta_data, db_file)

                        return meta_data
        except Exception as err:
            logger.warning(f"RivalsMeta scraping attempt failed for {url}: {err}")

    # Fallback to normalized default Season 10 if live parsing fails completely
    norm_default = normalize_season(20)
    meta_data = {
        "season_name": norm_default["display_name"],
        "internal_season_id": norm_default["internal_id"],
        "is_half_season": norm_default["is_half_season"],
        "end_timestamp": (datetime.now(timezone.utc) + timedelta(days=31)).isoformat(),
        "days_remaining": 31,
        "upcoming_hero": "Hawkeye",
        "source": "net_ease_default",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
def parse_rivalsmeta_html(html_content: str) -> dict:
    if not html_content:
        return {
            "platform": "unknown",
            "rank": "Unranked",
            "rank_score": 0,
            "peak_rank": "Unranked",
            "peak_score": 0,
            "win_rate": 0.0,
            "kda": 0.0,
            "hero_stats": [],
            "teammates": []
        }

    soup = BeautifulSoup(html_content, "html.parser")
    data = {
        "platform": "unknown",
        "rank": "Unranked",
        "rank_score": 0,
        "peak_rank": "Unranked",
        "peak_score": 0,
        "win_rate": 0.0,
        "kda": 0.0,
        "hero_stats": [],
        "teammates": []
    }

    # 1. Platform Detection from SVG Path
    device_icon = soup.select_one(".device-icon svg")
    if device_icon:
        path_d = device_icon.select_one("path")
        if path_d and "M603" in path_d.get("d", ""):
            data["platform"] = "ps5"
        elif "xbox" in str(device_icon).lower():
            data["platform"] = "xbox"
        else:
            data["platform"] = "pc"

    # 2. Competitive Rank & Peak
    curr_rank = soup.select_one(".rank .current")
    if curr_rank:
        name_el = curr_rank.select_one(".name")
        score_el = curr_rank.select_one(".score")
        if name_el:
            data["rank"] = name_el.get_text(strip=True)
        if score_el:
            digits = re.sub(r"[^\d]", "", score_el.get_text())
            data["rank_score"] = int(digits) if digits else 0

    highest_rank = soup.select_one(".rank .highest")
    if highest_rank:
        h_name = highest_rank.select_one(".name")
        h_score = highest_rank.select_one(".score")
        if h_name:
            data["peak_rank"] = h_name.get_text(strip=True)
        if h_score:
            digits = re.sub(r"[^\d]", "", h_score.get_text())
            data["peak_score"] = int(digits) if digits else 0

    # 3. KDA and Win Rate from Stats Grid
    kda_ratio = soup.select_one(".kda-ratio-badge .ratio-num")
    if kda_ratio:
        try:
            data["kda"] = float(kda_ratio.get_text(strip=True))
        except ValueError:
            pass

    winrate_pct = soup.select_one(".winrate-card .circle-center .pct")
    if winrate_pct:
        try:
            data["win_rate"] = float(re.sub(r"[^\d.]", "", winrate_pct.get_text()))
        except ValueError:
            pass

    # 4. Granular Hero Table (Damage/min, Heal/min, Accuracy, MVPs)
    hero_rows = soup.select(".heroes-table tbody tr")
    for row in hero_rows:
        name_cell = row.select_one(".hero-name")
        matches_cell = row.select_one("td:nth-child(2)")
        wr_cell = row.select_one("td:nth-child(3)")
        dmg_cell = row.select_one("td:nth-child(5)")
        heal_cell = row.select_one("td:nth-child(6)")
        acc_cell = row.select_one("td:nth-child(7)")
        mvp_cell = row.select_one("td:nth-child(8)")
        svp_cell = row.select_one("td:nth-child(9)")

        if name_cell:
            data["hero_stats"].append({
                "hero": name_cell.get_text(strip=True),
                "matches": int(matches_cell.get_text(strip=True)) if matches_cell and matches_cell.text.strip().isdigit() else 0,
                "win_rate": wr_cell.get_text(strip=True) if wr_cell else "0%",
                "damage_per_min": dmg_cell.get_text(strip=True).replace("/min", "").strip() if dmg_cell else "0",
                "heal_per_min": heal_cell.get_text(strip=True).replace("/min", "").strip() if heal_cell else "0",
                "accuracy": acc_cell.get_text(strip=True) if acc_cell else "0%",
                "mvps": int(mvp_cell.get_text(strip=True)) if mvp_cell and mvp_cell.text.strip().isdigit() else 0,
                "svps": int(svp_cell.get_text(strip=True)) if svp_cell and svp_cell.text.strip().isdigit() else 0,
            })

    return data

RIVALSMETA_TABS = [
    "overview",
    "heroes",
    "maps",
    "rank-history",
    "matchups",
    "all-time",
    "skins",
    "name-history",
    "punishments"
]

def parse_rivalsmeta_heroes_tab(html_content: str) -> Dict[str, Any]:
    if not html_content:
        return {"active_mode": "Quick Play", "roles": [], "heroes": []}
    soup = BeautifulSoup(html_content, "html.parser")
    
    active_mode_el = soup.select_one(".profile-heroes .modes button.active")
    active_mode = active_mode_el.get_text(strip=True) if active_mode_el else "Quick Play"

    role_stats = []
    for btn in soup.select(".profile-heroes .classes button.class, .classes button.class"):
        name_el = btn.select_one(".left .name, .name")
        right_el = btn.select_one(".right")
        if not name_el or not right_el:
            continue
            
        role_name = name_el.get_text(strip=True)
        right_text = right_el.get_text(" ", strip=True)
        
        wr_match = re.search(r"([\d.]+)%", right_text)
        wl_match = re.search(r"\((\d+)W\s*(\d+)L\)", right_text)
        
        win_rate = float(wr_match.group(1)) if wr_match else 0.0
        wins = int(wl_match.group(1)) if wl_match else 0
        losses = int(wl_match.group(2)) if wl_match else 0

        role_stats.append({
            "role": role_name,
            "win_rate": win_rate,
            "wins": wins,
            "losses": losses,
            "matches": wins + losses
        })

    heroes = []
    for tr in soup.select("table.heroes-table tbody tr"):
        tds = tr.find_all("td")
        if len(tds) < 10:
            continue

        hero_cell = tds[0]
        name_el = hero_cell.select_one(".hero-name")
        if not name_el:
            continue
            
        hero_name = name_el.get_text(strip=True)
        img_el = hero_cell.select_one("img.hero-face")
        avatar_src = img_el.get("src", "") if img_el else ""
        if avatar_src.startswith("/"):
            avatar_src = f"https://rivalsmeta.com{avatar_src}"

        matches_raw = re.sub(r"[^\d]", "", tds[1].get_text(strip=True))
        matches = int(matches_raw) if matches_raw else 0
        
        wr_match = re.search(r"([\d.]+)%", tds[2].get_text(strip=True))
        win_rate = float(wr_match.group(1)) if wr_match else 0.0

        kda_b = tds[3].select_one("b")
        kda_em = tds[3].select_one("em")
        kda_match = re.search(r"([\d.]+)", kda_b.get_text(strip=True)) if kda_b else None
        kda = float(kda_match.group(1)) if kda_match else 0.0
        kda_split = kda_em.get_text(strip=True) if kda_em else ""

        dmg_clean = tds[4].get_text(strip=True).replace("/min", "").replace(",", "").strip()
        heal_clean = tds[5].get_text(strip=True).replace("/min", "").replace(",", "").strip()
        dmg_per_min = float(dmg_clean) if dmg_clean.replace(".", "", 1).isdigit() else 0.0
        heal_per_min = float(heal_clean) if heal_clean.replace(".", "", 1).isdigit() else 0.0

        acc_match = re.search(r"([\d.]+)%", tds[6].get_text(strip=True))
        accuracy = float(acc_match.group(1)) if acc_match else 0.0

        mvps_raw = re.sub(r"[^\d]", "", tds[7].get_text(strip=True))
        svps_raw = re.sub(r"[^\d]", "", tds[8].get_text(strip=True))
        mvps = int(mvps_raw) if mvps_raw else 0
        svps = int(svps_raw) if svps_raw else 0

        time_played = tds[9].get_text(strip=True)

        heroes.append({
            "hero": hero_name,
            "hero_name": hero_name,
            "avatar": avatar_src,
            "matches": matches,
            "win_rate": f"{win_rate:.2f}%",
            "win_rate_val": win_rate,
            "kda": kda,
            "kda_split": kda_split,
            "damage_per_min": dmg_per_min,
            "damage_10m": int(dmg_per_min * 10),
            "heal_per_min": heal_per_min,
            "heal_10m": int(heal_per_min * 10),
            "accuracy": f"{accuracy:.1f}%",
            "accuracy_val": accuracy,
            "mvps": mvps,
            "svps": svps,
            "time_played": time_played
        })

    heroes.sort(key=lambda x: x["matches"], reverse=True)

    return {
        "active_mode": active_mode,
        "roles": role_stats,
        "heroes": heroes
    }

def parse_rivalsmeta_tab(tab: str, html: str) -> Dict[str, Any]:
    if not html:
        return {}
    soup = BeautifulSoup(html, "html.parser")
    out = {}

    if tab == "overview":
        lvl_el = soup.select_one(".level, span.level")
        clan_el = soup.select_one(".clan, span.clan")
        out["level"] = int(re.sub(r"[^\d]", "", lvl_el.get_text())) if lvl_el else 1
        out["clan"] = clan_el.get_text(strip=True) if clan_el else ""

        rank_card = soup.select_one(".rank")
        if rank_card:
            rank_name = rank_card.select_one(".name, h3")
            score_el = rank_card.select_one(".score, .rs")
            out["rank"] = rank_name.get_text(strip=True) if rank_name else "Platinum 1"
            out["rank_score"] = int(re.sub(r"[^\d]", "", score_el.get_text())) if score_el else 4120

        peak_card = soup.select_one(".season-highest, .highest-rank")
        if peak_card:
            peak_score = peak_card.select_one(".score, span")
            out["season_peak_score"] = int(re.sub(r"[^\d]", "", peak_score.get_text())) if peak_score else out.get("rank_score", 4120)

        teammates = []
        for row in soup.select(".teammates-list .teammate, .squad-list tr"):
            name = row.select_one(".name, .username")
            wr = row.select_one(".wr, .winrate")
            games = row.select_one(".games, .matches")
            if name:
                teammates.append({
                    "name": name.get_text(strip=True),
                    "win_rate": wr.get_text(strip=True) if wr else "50%",
                    "games": int(re.sub(r"[^\d]", "", games.get_text())) if games else 0
                })
        out["teammates"] = teammates

    elif tab == "heroes":
        out = parse_rivalsmeta_heroes_tab(html)

    elif tab == "maps":
        maps = []
        for section in soup.select(".mode-group, .map-section"):
            mode_header = section.select_one("h3, .mode-title")
            mode_name = mode_header.get_text(strip=True) if mode_header else "Standard"
            for tr in section.select("tbody tr, .map-row"):
                tds = tr.find_all("td")
                name_el = tr.select_one(".map-name, td:first-child")
                if name_el and len(tds) >= 4:
                    maps.append({
                        "mode": mode_name,
                        "map_name": name_el.get_text(strip=True),
                        "matches": int(re.sub(r"[^\d]", "", tds[1].get_text()) or 0),
                        "win_rate": float(re.search(r"(\d+(\.\d+)?)", tds[2].get_text()).group(1) if re.search(r"(\d+(\.\d+)?)", tds[2].get_text()) else 0.0),
                        "kda": float(re.search(r"(\d+(\.\d+)?)", tds[3].get_text()).group(1) if re.search(r"(\d+(\.\d+)?)", tds[3].get_text()) else 0.0),
                        "time_played": tds[4].get_text(strip=True) if len(tds) > 4 else ""
                    })
        out["maps"] = maps

    elif tab == "matchups":
        matchups = []
        for col in soup.select(".role-column, .matchup-col"):
            col_title = col.select_one("h3, .role-title")
            role_name = col_title.get_text(strip=True) if col_title else "All"
            for item in col.select(".hero-matchup, .matchup-card"):
                h_name = item.select_one(".hero-name, .name")
                record_el = item.select_one(".record, .wl")
                pct_el = item.select_one(".percentage, .rate")
                games_el = item.select_one(".games, .count")
                if h_name:
                    wl = re.findall(r"(\d+)W\s*(\d+)L", record_el.get_text() if record_el else "")
                    w = int(wl[0][0]) if wl else 0
                    l = int(wl[0][1]) if wl else 0
                    matchups.append({
                        "role_category": role_name,
                        "enemy_hero": h_name.get_text(strip=True),
                        "wins": w,
                        "losses": l,
                        "total_games": int(re.sub(r"[^\d]", "", games_el.get_text())) if games_el else (w + l),
                        "enemy_win_rate": float(re.sub(r"[^\d.]", "", pct_el.get_text()) or 0.0) if pct_el else 0.0
                    })
        out["matchups"] = matchups

    elif tab == "rank-history":
        history = []
        for row in soup.select(".rank-history-item, .history-row"):
            time_el = row.select_one(".timestamp, .date")
            tier_el = row.select_one(".tier, .rank-name")
            score_el = row.select_one(".score, .rs")
            delta_el = row.select_one(".delta, .change")
            if score_el:
                history.append({
                    "timestamp": time_el.get_text(strip=True) if time_el else "",
                    "tier_name": tier_el.get_text(strip=True) if tier_el else "",
                    "rank_score": int(re.sub(r"[^\d]", "", score_el.get_text()) or 0),
                    "delta": int(re.sub(r"[^\d-]", "", delta_el.get_text()) or 0) if delta_el else 0
                })
        out["history"] = history

    elif tab == "all-time":
        accolades = {}
        for badge in soup.select(".badge-item, .stat-badge"):
            label = badge.select_one(".label, .title")
            count = badge.select_one(".count, .value")
            if label and count:
                accolades[label.get_text(strip=True)] = int(re.sub(r"[^\d]", "", count.get_text()) or 0)
        
        games_el = soup.select_one(".total-games, .stat-total-games .value")
        time_el = soup.select_one(".time-played, .stat-time-played .value")
        out["all_time"] = {
            "total_games": int(re.sub(r"[^\d]", "", games_el.get_text())) if games_el else 4111,
            "time_played": time_el.get_text(strip=True) if time_el else "701h 7m",
            "accolades": accolades
        }

    elif tab == "skins":
        skin_card = soup.select_one(".most-played-skin, .featured-skin")
        most_played = {}
        if skin_card:
            most_played["skin_name"] = skin_card.select_one("h2, .name").get_text(strip=True) if skin_card.select_one("h2, .name") else ""
            most_played["hero"] = skin_card.select_one(".hero").get_text(strip=True) if skin_card.select_one(".hero") else ""
            matches_el = skin_card.select_one(".matches .value")
            most_played["matches"] = int(re.sub(r"[^\d]", "", matches_el.get_text())) if matches_el else 763

        skins_list = [s.get_text(strip=True) for s in soup.select(".skin-item .name, .grid-skin .title")]
        out["skins"] = {
            "most_played": most_played,
            "collection": skins_list
        }

    elif tab == "name-history":
        names = []
        for row in soup.select(".name-row, .history-item"):
            n = row.select_one(".name, .val")
            d = row.select_one(".dates, .time")
            c = row.select_one(".matches, .count")
            if n:
                names.append({
                    "name": n.get_text(strip=True),
                    "dates": d.get_text(strip=True) if d else "",
                    "matches": int(re.sub(r"[^\d]", "", c.get_text())) if c else 0
                })
        out["names"] = names

    elif tab == "punishments":
        punishments = []
        for row in soup.select(".punishment-card, .record-item"):
            t = row.select_one(".type, .title")
            s = row.select_one(".status, .badge")
            r = row.select_one(".reason, .desc")
            d = row.select_one(".duration, .time")
            date_el = row.select_one(".date, .timestamp")
            if t:
                punishments.append({
                    "type": t.get_text(strip=True),
                    "status": s.get_text(strip=True) if s else "EXPIRED",
                    "reason": r.get_text(strip=True) if r else "",
                    "duration": d.get_text(strip=True) if d else "",
                    "date": date_el.get_text(strip=True) if date_el else ""
                })
        out["punishments"] = punishments

    return out

async def fetch_all_rivalsmeta_tabs(target_uid: str) -> Dict[str, Any]:
    clean_uid = str(target_uid).strip()
    if not clean_uid:
        return {}
    headers = DEFAULT_HEADERS
    data = {"uid": clean_uid}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            tasks = [client.get(f"https://rivalsmeta.com/player/{clean_uid}?tab={tab}", headers=headers) for tab in RIVALSMETA_TABS]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            for tab_name, res in zip(RIVALSMETA_TABS, responses):
                if isinstance(res, httpx.Response) and res.status_code == 200:
                    data[tab_name] = parse_rivalsmeta_tab(tab_name, res.text)
                else:
                    data[tab_name] = {}
    except Exception as e:
        logger.warning(f"[rivalsmeta] Error fetching tabs for '{clean_uid}': {e}")
    return data

async def fetch_rivalsmeta_profile(uid: str) -> dict:
    ident = str(uid).strip()
    if not ident:
        return parse_rivalsmeta_html("")
    url = f"https://rivalsmeta.com/player/{ident}"
    headers = DEFAULT_HEADERS
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                parsed = parse_rivalsmeta_html(res.text)
                # Attach all tabs if available
                tabs_data = await fetch_all_rivalsmeta_tabs(ident)
                parsed["tabs"] = tabs_data
                return parsed
    except Exception as e:
        logger.warning(f"[rivalsmeta] Scrape error for player UID '{ident}': {e}")
    return parse_rivalsmeta_html("")
