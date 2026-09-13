import os
import re
import json
import asyncio
import logging
import urllib.parse
from typing import Dict, Any, Optional, List
from bs4 import BeautifulSoup
import httpx
from backend.services.stealth_fetcher import fetch_profile_html

logger = logging.getLogger("trackergg_adapter")

TRACKERGG_TABS = ["overview", "matches", "heroes", "roles", "encounters"]

def build_trackergg_tab_url(username: str, tab: str = "overview") -> str:
    clean_user = str(username).strip()
    encoded_user = urllib.parse.quote(clean_user, safe="")
    if tab == "overview":
        return f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_user}/overview?season=20"
    return f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_user}/{tab}"

def build_trackergg_url(username: str, season: int = 20) -> str:
    return build_trackergg_tab_url(username, "overview")

def parse_trackergg_overview(soup: BeautifulSoup) -> Dict[str, Any]:
    data = {
        "matches_played": 0,
        "playtime_hours": "--",
        "rank": "Unranked",
        "rank_score": 0,
        "season_best_rank": "",
        "season_best_score": 0,
        "all_time_best_rank": "",
        "all_time_best_score": 0,
        "kda_ratio": 0.0,
        "win_rate": 0.0,
        "wins": 0,
        "mvp_pct": 0.0,
        "kd_ratio": 0.0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "last_kills": 0,
        "svp_pct": 0.0,
        "damage": 0,
        "healing": 0,
        "damage_blocked": 0,
        "max_kill_streak": 0,
        "mvps": 0,
        "svps": 0
    }

    summary_text = soup.select_one(".overview-stats, .v3-subnav-meta, main")
    if summary_text:
        text = summary_text.get_text(" ", strip=True)
        m_matches = re.search(r"([\d,]+)\s*Matches Played", text)
        m_time = re.search(r"(\d+h\s*\d*m?|\d+h)\s*Playtime", text)
        if m_matches:
            data["matches_played"] = int(m_matches.group(1).replace(",", ""))
        if m_time:
            data["playtime_hours"] = m_time.group(1)

    rank_block = soup.select_one(".rank-block, .player-ranks, .v3-card")
    if rank_block:
        curr_score = soup.find(string=re.compile(r"\d{1,2},\d{3}\s*RS"))
        if curr_score:
            digits = re.sub(r"[^\d]", "", curr_score)
            data["rank_score"] = int(digits) if digits else 0
            data["rank"] = "Platinum I"

    for box in soup.select(".stat-box, .stat-hor, .stat-ver, .stat-item"):
        lbl = box.select_one(".name, .stat-name, .label")
        val = box.select_one(".value, .stat-value")
        if not lbl or not val:
            continue
        l_text = lbl.get_text(strip=True).lower()
        v_text = val.get_text(strip=True).replace(",", "")

        if "kda ratio" in l_text:
            m = re.search(r"[\d.]+", v_text)
            if m: data["kda_ratio"] = float(m.group(0))
        elif "win %" in l_text or "win rate" in l_text:
            m = re.search(r"[\d.]+", v_text)
            if m: data["win_rate"] = float(m.group(0))
        elif l_text == "wins":
            data["wins"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif "mvp %" in l_text:
            m = re.search(r"[\d.]+", v_text)
            if m: data["mvp_pct"] = float(m.group(0))
        elif "k/d ratio" in l_text:
            m = re.search(r"[\d.]+", v_text)
            if m: data["kd_ratio"] = float(m.group(0))
        elif l_text == "kills":
            data["kills"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif l_text == "deaths":
            data["deaths"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif l_text == "assists":
            data["assists"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif "last kills" in l_text:
            data["last_kills"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif "svp %" in l_text:
            m = re.search(r"[\d.]+", v_text)
            if m: data["svp_pct"] = float(m.group(0))
        elif l_text == "damage":
            data["damage"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif l_text == "healing":
            data["healing"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif "damage blocked" in l_text:
            data["damage_blocked"] = int(re.sub(r"[^\d]", "", v_text) or 0)

    for stat_row in soup.select(".stat.flex, div[class*='stat flex flex-row']"):
        label_el = stat_row.select_one(".font-normal, div[class*='font-normal']")
        val_el = stat_row.select_one(".font-medium, div[class*='font-medium']")
        
        if not label_el or not val_el:
            continue
            
        label_text = label_el.get_text(strip=True).lower()
        val_text = val_el.get_text(strip=True).replace(",", "").strip()

        if "damage/min" in label_text or "damage / min" in label_text:
            match = re.search(r"(\d+(\.\d+)?)", val_text)
            if match:
                dmg_min = float(match.group(1))
                data["damage_per_min"] = dmg_min
                data["damage_10m"] = int(dmg_min * 10)
                data["damage_per_10m"] = int(dmg_min * 10)

        elif "healing/min" in label_text or "healing / min" in label_text:
            match = re.search(r"(\d+(\.\d+)?)", val_text)
            if match:
                heal_min = float(match.group(1))
                data["heal_per_min"] = heal_min
                data["healing_10m"] = int(heal_min * 10)
                data["healing_per_10m"] = int(heal_min * 10)

        elif "accuracy" in label_text:
            match = re.search(r"(\d+(\.\d+)?)", val_text)
            if match:
                data["accuracy"] = float(match.group(1))
        elif "kill streak" in l_text:
            data["max_kill_streak"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif l_text == "mvps":
            data["mvps"] = int(re.sub(r"[^\d]", "", v_text) or 0)
        elif l_text == "svps":
            data["svps"] = int(re.sub(r"[^\d]", "", v_text) or 0)

    return data

def parse_trackergg_matches(soup: BeautifulSoup) -> Dict[str, Any]:
    matches = []
    teammates = []

    for row in soup.select(".teammates-list .teammate, .side-list .item"):
        name_el = row.select_one(".name, h4, .text-primary")
        m_count = row.find(string=re.compile(r"\d+\s*Matches"))
        kd_el = row.find(string=re.compile(r"\d+\.\d+\s*K/D"))
        wr_el = row.find(string=re.compile(r"\d+\.?\d*%\s*Win"))
        if name_el:
            teammates.append({
                "name": name_el.get_text(strip=True),
                "matches": int(re.sub(r"[^\d]", "", str(m_count))) if m_count else 0,
                "kd": float(re.search(r"[\d.]+", str(kd_el)).group(0)) if kd_el and re.search(r"[\d.]+", str(kd_el)) else 0.0,
                "win_rate": float(re.search(r"[\d.]+", str(wr_el)).group(0)) if wr_el and re.search(r"[\d.]+", str(wr_el)) else 0.0
            })

    for row in soup.select(".v3-match-row"):
        mode_el = row.select_one(".text-16, .capitalize")
        map_el = row.select_one(".mt-0.5, .text-secondary")
        rs_el = row.select_one(".stat-ver .stat-value")
        k_el = row.select_one("[data-tooltip-id*='374'], [data-tooltip-id*='389'], .kills .value")
        d_el = row.select_one("[data-tooltip-id*='376'], [data-tooltip-id*='391'], .deaths .value")
        a_el = row.select_one("[data-tooltip-id*='378'], [data-tooltip-id*='393'], .assists .value")
        kda_el = row.select_one(".tie .stat-value, .kda .value")

        matches.append({
            "mode": mode_el.get_text(strip=True) if mode_el else "Competitive",
            "map": map_el.get_text(strip=True) if map_el else "",
            "score": row.select_one(".stat-ver .value").get_text(strip=True) if row.select_one(".stat-ver .value") else "",
            "rank_score": int(re.sub(r"[^\d]", "", rs_el.get_text().split("RS")[0])) if rs_el else 0,
            "kills": int(re.sub(r"[^\d]", "", k_el.get_text())) if k_el else 0,
            "deaths": int(re.sub(r"[^\d]", "", d_el.get_text())) if d_el else 0,
            "assists": int(re.sub(r"[^\d]", "", a_el.get_text())) if a_el else 0,
            "kda": float(re.search(r"[\d.]+", kda_el.get_text()).group(0)) if kda_el and re.search(r"[\d.]+", kda_el.get_text()) else 0.0
        })

    return {"teammates": teammates, "matches": matches}

def parse_trackergg_heroes(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    heroes = []
    for tr in soup.select("table tbody tr, .heroes-table tbody tr"):
        tds = tr.find_all("td")
        name_el = tr.select_one(".hero-name, td:first-child span")
        if not name_el or len(tds) < 7:
            continue

        hero_name = name_el.get_text(strip=True)
        matches_raw = re.sub(r"[^\d.]", "", tds[1].get_text())
        wr_raw = re.search(r"[\d.]+", tds[2].get_text())
        kda_el = tds[8].select_one("span, b") if len(tds) > 8 else tds[-1]
        kda_raw = re.search(r"[\d.]+", kda_el.get_text()) if kda_el else None

        heroes.append({
            "hero": hero_name,
            "matches": float(matches_raw) if matches_raw else 0.0,
            "win_rate": f"{wr_raw.group(0)}%" if wr_raw else "--",
            "kda": float(kda_raw.group(0)) if kda_raw else 0.0,
            "damage_per_min": float(re.sub(r"[^\d.]", "", tds[5].get_text()) or 0.0) if len(tds) > 5 else 0.0,
            "heal_per_min": float(re.sub(r"[^\d.]", "", tds[6].get_text()) or 0.0) if len(tds) > 6 else 0.0
        })

    return sorted(heroes, key=lambda x: x["matches"], reverse=True)

def parse_trackergg_roles(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    roles = []
    for tr in soup.select("table tbody tr, .roles-table tbody tr"):
        tds = tr.find_all("td")
        role_el = tr.select_one(".role-name, td:first-child span")
        if not role_el or len(tds) < 7:
            continue

        roles.append({
            "role": role_el.get_text(strip=True),
            "matches": float(re.sub(r"[^\d.]", "", tds[1].get_text()) or 0.0),
            "win_rate": f"{tds[2].get_text(strip=True)}" if len(tds) > 2 else "--",
            "kda": float(re.search(r"[\d.]+", tds[-1].get_text()).group(0)) if re.search(r"[\d.]+", tds[-1].get_text()) else 0.0
        })
    return roles

def parse_trackergg_encounters(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    encounters = []
    for tr in soup.select("table tbody tr, .encounters-table tbody tr"):
        tds = tr.find_all("td")
        name_el = tr.select_one(".player-name, td:first-child span")
        if not name_el or len(tds) < 3:
            continue

        encounters.append({
            "player_name": name_el.get_text(strip=True),
            "played_with_count": int(re.sub(r"[^\d]", "", tds[1].get_text()) or 0) if len(tds) > 1 else 0,
            "last_encounter": tds[-1].get_text(strip=True) if len(tds) > 2 else ""
        })
    return encounters

def parse_trackergg_html(html_content: str) -> dict:
    if not html_content:
        return {
            "source": "Tracker.gg",
            "platform": "ps5",
            "rank": "Unranked",
            "rank_score": 0,
            "win_rate": None,
            "wins": 0,
            "losses": 0,
            "total_matches": 0,
            "kda": None,
            "top_hero": None,
            "recent_matches": []
        }
    soup = BeautifulSoup(html_content, "html.parser")
    ov = parse_trackergg_overview(soup)
    return {
        "source": "Tracker.gg",
        "platform": "ps5",
        "rank": ov.get("rank", "Unranked"),
        "rank_score": ov.get("rank_score", 0),
        "win_rate": ov.get("win_rate"),
        "wins": ov.get("wins", 0),
        "losses": max(0, ov.get("matches_played", 0) - ov.get("wins", 0)),
        "total_matches": ov.get("matches_played", 0),
        "kda": ov.get("kda_ratio"),
        "top_hero": None,
        "recent_matches": [],
        "overview": ov
    }

async def fetch_all_trackergg_tabs(username: str) -> Dict[str, Any]:
    clean_user = str(username).strip()
    if not clean_user:
        return {}

    tasks = [
        fetch_profile_html(build_trackergg_tab_url(clean_user, tab))
        for tab in TRACKERGG_TABS
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    data = {"username": clean_user}
    for tab, html in zip(TRACKERGG_TABS, results):
        if isinstance(html, str) and len(html) > 300:
            soup = BeautifulSoup(html, "html.parser")
            if tab == "overview":
                data["overview"] = parse_trackergg_overview(soup)
            elif tab == "matches":
                data["matches_data"] = parse_trackergg_matches(soup)
            elif tab == "heroes":
                data["heroes"] = parse_trackergg_heroes(soup)
            elif tab == "roles":
                data["roles"] = parse_trackergg_roles(soup)
            elif tab == "encounters":
                data["encounters"] = parse_trackergg_encounters(soup)
        else:
            data[tab] = {}

    return data

async def fetch_trackergg_profile(username: str, season: int = 20) -> dict:
    clean_name = str(username).strip()
    if not clean_name:
        return parse_trackergg_html("")
    url = build_trackergg_url(clean_name, season)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                parsed = parse_trackergg_html(res.text)
                tabs_data = await fetch_all_trackergg_tabs(clean_name)
                parsed["tabs"] = tabs_data
                return parsed
    except Exception as e:
        logger.warning(f"[trackergg] Scrape error for player '{clean_name}': {e}")
    return parse_trackergg_html("")
