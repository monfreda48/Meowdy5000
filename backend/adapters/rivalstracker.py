import re
import json
import logging
import urllib.parse
from typing import Dict, Any, Optional, List
from bs4 import BeautifulSoup
import httpx

from backend.database import upsert_global_tier_list, get_global_tier_lists_from_db
from backend.services.stealth_fetcher import fetch_profile_html

logger = logging.getLogger("rivalstracker_adapter")

def parse_player_level(soup: BeautifulSoup) -> int:
    level_el = (
        soup.select_one(".left_info .lvl p, .lvl p, div.lvl p, p[data-v-cfd279cc]") or 
        soup.select_one(".level, .player-level, [class*='level'], span.level")
    )
    if level_el:
        digits = re.sub(r"[^\d]", "", level_el.get_text(strip=True))
        if digits:
            return int(digits)
    return 1

def parse_rivalstracker_html(html_content: str) -> Dict[str, Any]:
    if not html_content:
        return {
            "level": 1,
            "username": "",
            "tag": "",
            "platform": "ps5",
            "rank": "Unranked",
            "rank_score": 0,
            "peak_rank": "Unranked",
            "peak_rank_score": 0,
            "summary": {},
            "top_heroes": [],
            "top_roles": [],
            "best_teammates": [],
            "match_history": [],
            "detailed_heroes": [],
            "detailed_maps": [],
            "rank_history": {},
            "skins_summary": {}
        }

    soup = BeautifulSoup(html_content, "html.parser")
    data = {
        "level": parse_player_level(soup),
        "username": "",
        "tag": "",
        "platform": "ps5",
        "rank": "Unranked",
        "rank_score": 0,
        "peak_rank": "Unranked",
        "peak_rank_score": 0,
        "summary": {},
        "top_heroes": [],
        "top_roles": [],
        "best_teammates": [],
        "match_history": [],
        "detailed_heroes": [],
        "detailed_maps": [],
        "rank_history": {},
        "skins_summary": {}
    }

    # 1. Header & Identity
    lvl_el = soup.select_one(".lvl p, p[data-v-cfd279cc]")
    if lvl_el:
        digits = re.sub(r"[^\d]", "", lvl_el.get_text(strip=True))
        if digits:
            data["level"] = int(digits)

    name_el = soup.select_one(".informations h1")
    if name_el:
        tag_el = name_el.select_one("span")
        data["tag"] = tag_el.get_text(strip=True) if tag_el else ""
        if tag_el:
            tag_el.decompose()
        data["username"] = name_el.get_text(strip=True)

    # 2. Current & Peak Rank
    rank_box = soup.select_one(".rank-block")
    if rank_box:
        title_el = rank_box.select_one(".rank-title")
        score_el = rank_box.find(string=re.compile(r"[\d,]+\s*Score", re.IGNORECASE))
        data["rank"] = title_el.get_text(strip=True) if title_el else "Unranked"
        if score_el:
            data["rank_score"] = int(re.sub(r"[^\d]", "", str(score_el)) or 0)

    peak_box = soup.select_one(".season_highest")
    if peak_box:
        p_title = peak_box.select_one(".rank-title")
        p_score = peak_box.find(string=re.compile(r"[\d,]+\s*Score", re.IGNORECASE))
        data["peak_rank"] = p_title.get_text(strip=True) if p_title else data["rank"]
        if p_score:
            data["peak_rank_score"] = int(re.sub(r"[^\d]", "", str(p_score)) or 0)

    # 3. Season Overview Summary (.profile-summary)
    summary_box = soup.select_one(".profile-summary")
    if summary_box:
        rec_cell = summary_box.select_one(".profile-summary__cell:nth-of-type(1)")
        kda_cell = summary_box.select_one(".profile-summary__cell:nth-of-type(3)")
        main_cell = summary_box.select_one(".profile-summary__cell--who:nth-of-type(4)")
        duo_cell = summary_box.select_one(".profile-summary__cell--who:nth-of-type(5)")

        data["summary"] = {
            "record": rec_cell.select_one(".profile-summary__value").get_text(" ", strip=True) if rec_cell and rec_cell.select_one(".profile-summary__value") else "--",
            "win_rate": rec_cell.select_one(".profile-summary__sub b").get_text(strip=True) if rec_cell and rec_cell.select_one(".profile-summary__sub b") else "--",
            "matches": int(re.sub(r"[^\d]", "", rec_cell.select_one(".profile-summary__sub").get_text()) or 0) if rec_cell and rec_cell.select_one(".profile-summary__sub") else 0,
            "avg_kda": float(re.search(r"[\d.]+", kda_cell.select_one(".profile-summary__value").get_text()).group(0)) if kda_cell and kda_cell.select_one(".profile-summary__value") and re.search(r"[\d.]+", kda_cell.select_one(".profile-summary__value").get_text()) else 0.0,
            "kda_split": kda_cell.select_one(".profile-summary__sub").get_text(strip=True) if kda_cell and kda_cell.select_one(".profile-summary__sub") else "",
            "main_hero": main_cell.select_one(".profile-summary__name").get_text(strip=True) if main_cell and main_cell.select_one(".profile-summary__name") else "",
            "most_played_with": duo_cell.select_one(".profile-summary__name").get_text(strip=True) if duo_cell and duo_cell.select_one(".profile-summary__name") else ""
        }

    # 4. Best Teammates (.played-friend table tbody tr)
    for tr in soup.select(".played-friend table tbody tr"):
        p_link = tr.select_one("a.player")
        p_name = tr.select_one("a.player p, .player p")
        struct_p = tr.select(".games_struct p")
        wr_el = tr.select_one(".winrate_teammate")

        if p_name:
            teammate_href = p_link.get("href", "") if p_link else ""
            uid_match = re.search(r"/profile/(\d+)", teammate_href)
            teammate_uid = uid_match.group(1) if uid_match else ""
            matches_cnt = int(re.sub(r"[^\d]", "", struct_p[0].get_text()) or 0) if len(struct_p) > 0 else 0
            wl_record = struct_p[1].get_text(strip=True) if len(struct_p) > 1 else ""
            wr_val = float(re.sub(r"[^\d.]", "", wr_el.get_text()) or 0) if wr_el else 0.0

            data["best_teammates"].append({
                "name": p_name.get_text(strip=True),
                "uid": teammate_uid,
                "matches": matches_cnt,
                "record": wl_record,
                "win_rate": wr_val
            })

    # 5. Top Roles Performance (.played-champions.roles .role-performance)
    for role_box in soup.select(".played-champions.roles .role-performance"):
        r_name = role_box.select_one(".role-name")
        r_wr = role_box.select_one(".win-rate")
        r_games = role_box.select_one(".total-games")
        r_kda = role_box.select_one(".kda-ratio")
        r_split = role_box.select_one(".kda-split")

        if r_name:
            data["top_roles"].append({
                "role": r_name.get_text(strip=True),
                "win_rate": r_wr.get_text(strip=True) if r_wr else "--",
                "record": r_games.get_text(strip=True) if r_games else "--",
                "kda": float(re.search(r"[\d.]+", r_kda.get_text()).group(0)) if r_kda and re.search(r"[\d.]+", r_kda.get_text()) else 0.0,
                "kda_split": r_split.get_text(strip=True) if r_split else ""
            })

    # 6. Detailed Heroes Table (.heroes_statistiques table tbody tr)
    for tr in soup.select(".heroes_statistiques table tbody tr"):
        name_div = tr.select_one(".profile .name, .name")
        tds = tr.find_all("td")
        if not name_div or len(tds) < 8:
            continue

        wr_strong = tr.select_one(".win-r")
        wl_p = tr.select_one(".win-loss")
        kda_ratio = tr.select_one(".kda-ratio")
        kda_split = tr.select_one(".kda-split")

        data["detailed_heroes"].append({
            "hero": name_div.get_text(strip=True),
            "win_rate": wr_strong.get_text(strip=True) if wr_strong else "--",
            "record": wl_p.get_text(strip=True) if wl_p else "",
            "kda": float(re.search(r"[\d.]+", kda_ratio.get_text()).group(0)) if kda_ratio and re.search(r"[\d.]+", kda_ratio.get_text()) else 0.0,
            "kda_split": kda_split.get_text(strip=True) if kda_split else "",
            "kills": int(re.sub(r"[^\d]", "", tds[3].get_text()) or 0),
            "deaths": int(re.sub(r"[^\d]", "", tds[4].get_text()) or 0),
            "assists": int(re.sub(r"[^\d]", "", tds[5].get_text()) or 0),
            "matches": int(re.sub(r"[^\d]", "", tds[6].get_text()) or 0),
            "time_played": tds[7].select_one(".time-played_value").get_text(strip=True) if tds[7].select_one(".time-played_value") else ""
        })

    # 7. Detailed Maps Table (.maps_statistiques table tbody tr)
    for tr in soup.select(".maps_statistiques table tbody tr"):
        map_name = tr.select_one(".map-card_name p, .map-name")
        tds = tr.find_all("td")
        if not map_name or len(tds) < 8:
            continue

        wr_strong = tr.select_one(".win-r")
        wl_p = tr.select_one(".win-loss")
        kda_ratio = tr.select_one(".kda-ratio")
        kda_split = tr.select_one(".kda-split")

        data["detailed_maps"].append({
            "map_name": map_name.get_text(strip=True),
            "win_rate": wr_strong.get_text(strip=True) if wr_strong else "--",
            "record": wl_p.get_text(strip=True) if wl_p else "",
            "kda": float(re.search(r"[\d.]+", kda_ratio.get_text()).group(0)) if kda_ratio and re.search(r"[\d.]+", kda_ratio.get_text()) else 0.0,
            "kda_split": kda_split.get_text(strip=True) if kda_split else "",
            "kills": int(re.sub(r"[^\d]", "", tds[3].get_text()) or 0),
            "deaths": int(re.sub(r"[^\d]", "", tds[4].get_text()) or 0),
            "assists": int(re.sub(r"[^\d]", "", tds[5].get_text()) or 0),
            "matches": int(re.sub(r"[^\d]", "", tds[6].get_text()) or 0),
            "time_played": tds[7].select_one(".time-played_value").get_text(strip=True) if tds[7].select_one(".time-played_value") else ""
        })

    # 8. Match History Cards (.match-history_match-card)
    for card in soup.select(".match-history_match-card"):
        q_type = card.select_one(".queue-type")
        time_ago = card.select_one(".from-now")
        lp_el = card.select_one(".lp-value")
        status_el = card.select_one(".victory-status")
        dur_el = card.select_one(".game-duration")
        kda_totals = card.select_one(".KDA-totals")
        kda_ratio = card.select_one(".KDA-ratio")
        score_el = card.select_one(".group-score .value")
        map_el = card.select_one(".map-card_name p")
        is_mvp = bool(card.select_one(".mvp"))
        is_svp = bool(card.select_one(".svp"))

        if q_type:
            data["match_history"].append({
                "queue": q_type.get_text(strip=True),
                "time_ago": time_ago.get_text(strip=True) if time_ago else "",
                "lp_delta": int(re.sub(r"[^\d-]", "", lp_el.get_text()) or 0) if lp_el else 0,
                "result": "WIN" if status_el and "win" in status_el.get_text().lower() else "LOSS",
                "duration": dur_el.get_text(strip=True) if dur_el else "",
                "kda_totals": kda_totals.get_text(" ", strip=True) if kda_totals else "",
                "kda_ratio": kda_ratio.get_text(strip=True) if kda_ratio else "",
                "match_score": score_el.get_text(strip=True) if score_el else "",
                "map": map_el.get_text(strip=True) if map_el else "",
                "is_mvp": is_mvp,
                "is_svp": is_svp
            })

    # Backward Compatibility Key Binding
    data["win_rate"] = float(re.sub(r"[^\d.]", "", data["summary"].get("win_rate", "0")) or 0.0)
    data["kda"] = data["summary"].get("avg_kda", 0.0)
    data["total_matches"] = data["summary"].get("matches", 0)
    data["score"] = data["rank_score"]
    data["peak_score"] = data["peak_rank_score"]
    data["teammates"] = data["best_teammates"]

    return data

async def fetch_rivalstracker_profile(uid: str) -> Dict[str, Any]:
    clean_uid = str(uid).strip()
    if not clean_uid:
        return parse_rivalstracker_html("")
    url = f"https://rivalstracker.com/profile/{urllib.parse.quote(clean_uid)}"
    try:
        html = await fetch_profile_html(url)
        if isinstance(html, str) and len(html) > 500:
            return parse_rivalstracker_html(html)
    except Exception as e:
        logger.warning(f"[rivalstracker] Scrape error for UID '{clean_uid}': {e}")
    return parse_rivalstracker_html("")

class RivalsTrackerAdapter:
    def __init__(self):
        self.base_url = "https://rivalstracker.com"

    async def scrape_player(self, identifier: str) -> Dict[str, Any]:
        ident = str(identifier).strip()
        if not ident:
            return {"success": False, "data": {}, "error": "Player identifier is empty"}
        data = await fetch_rivalstracker_profile(ident)
        return {"success": True, "data": data, "error": None}
