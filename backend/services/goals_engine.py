import math
import logging
from typing import Dict, Any, List

logger = logging.getLogger("goals_engine")

def generate_goal_recommendations(stats: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Calculates dynamic performance milestones and coaching tips based on player telemetry.
    Includes division-by-zero safety checks for unranked / new profiles.
    """
    if not isinstance(stats, dict):
        stats = {}

    current_dict = stats.get("current", {}) if isinstance(stats.get("current"), dict) else stats

    # Helper parsing with default safety
    def parse_float(val, default=0.0):
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        try:
            s = str(val).replace("%", "").replace(",", "").strip()
            return float(s)
        except Exception:
            return default

    def parse_int(val, default=0):
        if val is None:
            return default
        if isinstance(val, int):
            return val
        try:
            s = str(val).replace(",", "").strip()
            return int(float(s))
        except Exception:
            return default

    kda = parse_float(current_dict.get("kda") or current_dict.get("kda_ratio") or stats.get("kda"), 2.50)
    win_rate = parse_float(current_dict.get("win_rate") or current_dict.get("winRate") or stats.get("win_rate"), 50.0)
    total_matches = parse_int(current_dict.get("total_matches") or current_dict.get("matches") or stats.get("total_matches"), 40)
    deaths_per_match = parse_float(current_dict.get("deaths_per_match") or stats.get("deaths_per_match"), 6.5)

    goals = []

    # 1. Rank Climb / Win Rate Milestone
    if win_rate < 50.0:
        target_win = 50.0
        tip = "Winning 3 consecutive matches will shift your active rank bracket."
    elif win_rate < 55.0:
        target_win = round(win_rate + 2.0, 1)
        tip = "Maintain a positive win delta over your next 10 matches to climb ranks."
    else:
        target_win = min(100.0, round(win_rate + 3.0, 1))
        tip = "Dominant win rate! Keep pushing for higher competitive ladder tiers."

    win_progress = min(100.0, max(0.0, round((win_rate / target_win) * 100, 1))) if target_win > 0 else 100.0
    goals.append({
        "id": "win_rate_climb",
        "category": "Rank Climb",
        "title": "Secure Positive Win Delta",
        "current_value": round(win_rate, 1),
        "target_value": target_win,
        "unit": "%",
        "progress_pct": win_progress,
        "tip": tip
    })

    # 2. KDA Ratio Bracket
    if kda < 2.0:
        target_kda = 2.00
    elif kda < 3.0:
        target_kda = 3.00
    elif kda < 4.0:
        target_kda = 4.00
    else:
        target_kda = round(kda + 1.0, 1)

    kda_progress = min(100.0, max(0.0, round((kda / target_kda) * 100, 1))) if target_kda > 0 else 100.0
    goals.append({
        "id": "kda_target",
        "category": "Combat Efficiency",
        "title": f"Reach {target_kda:.2f} KDA Ratio",
        "current_value": round(kda, 2),
        "target_value": target_kda,
        "unit": "ratio",
        "progress_pct": kda_progress,
        "tip": "Focus on high-assist grouping to minimize unsupported deaths."
    })

    # 3. Survivability / Death Reduction
    target_deaths = 5.0
    if deaths_per_match > 0:
        surv_progress = min(100.0, max(0.0, round((target_deaths / max(0.1, deaths_per_match)) * 100, 1)))
    else:
        surv_progress = 100.0

    goals.append({
        "id": "survivability",
        "category": "Survivability",
        "title": "Sub-5 Death Average",
        "current_value": round(deaths_per_match, 1),
        "target_value": target_deaths,
        "unit": "deaths/game",
        "progress_pct": surv_progress,
        "tip": "Disengage when team fights fall below 2v4 numbers to protect KDA."
    })

    # 4. Match Volume Milestone
    milestones = [50, 100, 250, 500, 1000]
    next_milestone = next((m for m in milestones if m > total_matches), total_matches + 50)
    vol_progress = min(100.0, max(0.0, round((total_matches / next_milestone) * 100, 1))) if next_milestone > 0 else 100.0

    goals.append({
        "id": "match_volume",
        "category": "Experience",
        "title": f"Reach {next_milestone} Matches Played",
        "current_value": total_matches,
        "target_value": next_milestone,
        "unit": "matches",
        "progress_pct": vol_progress,
        "tip": "Building match sample size improves rank accuracy and telemetry confidence."
    })

    return goals
