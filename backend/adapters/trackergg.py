import os
import re
import json
import logging
import urllib.parse
from typing import Dict, Any, Optional, List
from bs4 import BeautifulSoup
import httpx

logger = logging.getLogger("trackergg_adapter")

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
    data = {
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

    # 1. Extract Latest Rank & RS from the most recent match row
    latest_match = soup.select_one(".v3-match-row")
    if latest_match:
        rank_name_el = latest_match.select_one(".stat-ver .stat-name span.truncate")
        if rank_name_el:
            data["rank"] = rank_name_el.get_text(strip=True)
        
        rs_el = latest_match.select_one(".stat-ver .stat-value span.truncate")
        if rs_el:
            score_digits = re.sub(r"[^\d]", "", rs_el.get_text().split("RS")[0])
            if score_digits:
                data["rank_score"] = int(score_digits)

    # 2. Extract Last 25 Matches Summary Stats (Win Rate, KDA, Record)
    stat_bars = soup.select(".v3-card__body .stat-hor")
    for bar in stat_bars:
        name_el = bar.select_one(".stat-name")
        val_el = bar.select_one(".stat-value")
        if not name_el or not val_el:
            continue
        
        name_text = name_el.get_text(strip=True).lower()
        val_text = val_el.get_text(strip=True)

        if "win rate" in name_text:
            match = re.search(r"(\d+(\.\d+)?)%", val_text)
            if match:
                data["win_rate"] = float(match.group(1))
            w_chip = bar.find(string=re.compile(r"\d+\s*W"))
            l_chip = bar.find(string=re.compile(r"\d+\s*L"))
            if w_chip:
                digits = re.sub(r"[^\d]", "", str(w_chip))
                if digits:
                    data["wins"] = int(digits)
            if l_chip:
                digits = re.sub(r"[^\d]", "", str(l_chip))
                if digits:
                    data["losses"] = int(digits)
            data["total_matches"] = data["wins"] + data["losses"]

        elif "kda" in name_text:
            match = re.search(r"\d+(\.\d+)?", val_text)
            if match:
                data["kda"] = float(match.group(0))

        elif "picked" in name_text:
            hero_img = bar.select_one("img")
            if hero_img and hero_img.get("alt"):
                data["top_hero"] = hero_img["alt"]

    return data

def build_trackergg_url(username: str, season: int = 20) -> str:
    """
    Constructs the canonical Tracker.gg profile overview URL.
    Encodes spaces to %20 without altering unspaced characters.
    """
    clean_username = str(username).strip()
    encoded_username = urllib.parse.quote(clean_username, safe="")
    return f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_username}/overview?season={season}"

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
                return parse_trackergg_html(res.text)
    except Exception as e:
        logger.warning(f"[trackergg] Scrape error for player '{clean_name}': {e}")
    return parse_trackergg_html("")
