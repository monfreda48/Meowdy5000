import math
import logging
from typing import Dict, Any, List
from backend.services.platform_detector import extract_platform_from_rivalsdata

logger = logging.getLogger("metric_brain")

def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        clean = str(val).replace(",", "").replace("%", "").replace("h", "").replace("m", "").strip()
        return float(clean)
    except Exception:
        return default

def safe_int(val: Any, default: int = 0) -> int:
    if val is None or val == "":
        return default
    try:
        clean = str(val).replace(",", "").strip()
        return int(float(clean))
    except Exception:
        return default

def format_username(name: str) -> str:
    if not name or not isinstance(name, str):
        return ""
    clean = name.strip()
    if not clean:
        return ""
    return " ".join(word[0].upper() + word[1:] if word else "" for word in clean.split(" "))

class MetricBrain:
    """
    Reconciles raw multi-provider telemetry into canonical core metrics
    and spawns dynamic extended metrics without dropping novel stats.
    """
    @staticmethod
    def normalize_to_10m(value: float, time_sec: float) -> float:
        if not time_sec or time_sec <= 0:
            return 0.0
        return round((float(value) / float(time_sec)) * 600.0, 1)

    @staticmethod
    def process(raw_telemetry: Dict[str, Any], uid: str = "") -> Dict[str, Any]:
        t_gg = raw_telemetry.get("tracker_gg", {}).get("data", {}) if isinstance(raw_telemetry.get("tracker_gg"), dict) else {}
        r_tr = raw_telemetry.get("rivals_tracker", {}).get("data", {}) if isinstance(raw_telemetry.get("rivals_tracker"), dict) else {}
        r_meta = raw_telemetry.get("rivals_meta", {}).get("data", {}) if isinstance(raw_telemetry.get("rivals_meta"), dict) else {}
        r_data = raw_telemetry.get("rivals_data", {}).get("data", {}) if isinstance(raw_telemetry.get("rivals_data"), dict) else {}

        # 1. Playtime Extraction (Seconds)
        play_time_sec = 0.0
        if isinstance(t_gg, dict):
            for seg in t_gg.get("segments", []) if isinstance(t_gg.get("segments"), list) else []:
                if isinstance(seg, dict) and seg.get("type") == "overview":
                    stats = seg.get("stats", {})
                    time_val = stats.get("playTime", {}).get("value")
                    if time_val and float(time_val) > 0:
                        play_time_sec = float(time_val)
                        break

        if not play_time_sec:
            hours = safe_float(r_meta.get("playtime_hours") or r_tr.get("playtime_hours") or 0.0)
            if hours > 0:
                play_time_sec = hours * 3600.0

        # 2. Canonical Core Metrics Reconciler
        total_matches = (
            safe_int(t_gg.get("total_matches")) or
            safe_int(r_tr.get("total_games")) or
            safe_int(r_tr.get("total_matches")) or
            safe_int(r_meta.get("total_matches")) or 0
        )

        win_rate = (
            t_gg.get("win_rate") or
            r_tr.get("win_rate") or
            r_meta.get("win_rate") or
            r_data.get("win_rate") or "0%"
        )

        kda = (
            safe_float(t_gg.get("kda")) or
            safe_float(r_tr.get("kda")) or
            safe_float(r_meta.get("kda")) or 0.0
        )

        # 10m Rate Normalization (scaling 1-min metrics x10 or total -> 10m)
        raw_dmg = safe_float(t_gg.get("damage") or r_tr.get("damage") or r_meta.get("damage"))
        raw_heal = safe_float(t_gg.get("healing") or r_tr.get("healing") or r_meta.get("healing"))

        dmg_1m = safe_float(t_gg.get("dmg_per_min") or r_meta.get("dmg_per_min"))
        heal_1m = safe_float(t_gg.get("heal_per_min") or r_meta.get("heal_per_min"))

        if dmg_1m > 0:
            hero_damage_10m = round(dmg_1m * 10.0, 1)
        elif play_time_sec > 0 and raw_dmg > 0:
            hero_damage_10m = MetricBrain.normalize_to_10m(raw_dmg, play_time_sec)
        else:
            hero_damage_10m = 0.0

        if heal_1m > 0:
            healing_10m = round(heal_1m * 10.0, 1)
        elif play_time_sec > 0 and raw_heal > 0:
            healing_10m = MetricBrain.normalize_to_10m(raw_heal, play_time_sec)
        else:
            healing_10m = 0.0

        current_rank = (
            r_data.get("rank_tier") or
            r_tr.get("current_rank") or
            r_meta.get("rank") or "Unranked"
        )

        rank_score = (
            r_data.get("rank_score") or
            r_tr.get("current_score") or
            r_meta.get("rank_score") or "0 RS"
        )

        # 3. Dynamic Extended Metrics Spawner
        extended_metrics = {}

        # RivalsTracker novel metrics
        if r_tr.get("peak_score"):
            extended_metrics["peak_rating"] = {"label": "Peak Rating", "value": str(r_tr["peak_score"]), "source": "RivalsTracker"}
        if r_tr.get("net_score"):
            extended_metrics["net_score_delta"] = {"label": "Net Score Delta", "value": str(r_tr["net_score"]), "source": "RivalsTracker"}
        if r_tr.get("largest_gain"):
            extended_metrics["largest_gain"] = {"label": "Largest Gain", "value": str(r_tr["largest_gain"]), "source": "RivalsTracker"}
        if r_tr.get("largest_loss"):
            extended_metrics["largest_loss"] = {"label": "Largest Loss", "value": str(r_tr["largest_loss"]), "source": "RivalsTracker"}

        # RivalsMeta novel metrics
        if r_meta.get("damage_taken"):
            raw_dt = safe_float(r_meta["damage_taken"])
            dt_10m = MetricBrain.normalize_to_10m(raw_dt, play_time_sec) if play_time_sec > 0 else raw_dt
            extended_metrics["damage_taken_10m"] = {"label": "Damage Taken / 10m", "value": f"{dt_10m:,.1f}", "source": "RivalsMeta"}

        # Accuracy / Hit Rate
        accuracy_val = t_gg.get("accuracy") or r_meta.get("accuracy")
        if accuracy_val:
            acc_str = str(accuracy_val)
            extended_metrics["weapon_accuracy"] = {"label": "Weapon Accuracy", "value": acc_str if acc_str.endswith("%") else f"{acc_str}%", "source": "Tracker.gg"}

        # RivalsData novel metrics
        if r_data.get("rank_score"):
            extended_metrics["rs_in_tier"] = {"label": "RS in Tier", "value": str(r_data["rank_score"]), "source": "RivalsData"}
        if r_data.get("record"):
            extended_metrics["season_record"] = {"label": "Season Record", "value": str(r_data["record"]), "source": "RivalsData"}

        # Authoritative Upstream Name Resolution
        raw_name = (
            r_meta.get("player", {}).get("info", {}).get("name")
            or r_meta.get("name")
            or t_gg.get("data", {}).get("platformInfo", {}).get("platformUserHandle")
            or t_gg.get("platformInfo", {}).get("platformUserHandle")
            or r_tr.get("username")
            or r_data.get("name")
            or (uid if uid and not uid.isdigit() else f"Player {uid}")
        )
        canonical_name = format_username(str(raw_name))

        # Platform Resolution via RivalsData HTML
        r_data_html = str(r_data.get("raw_html", "")) or str(r_data)
        canonical_platform = extract_platform_from_rivalsdata(r_data_html)

        # Top Hero Slug Extraction
        top_hero_slug = "hulk"
        if r_meta.get("hero_stats") and len(r_meta["hero_stats"]) > 0:
            top_hero_slug = r_meta["hero_stats"][0].get("hero") or r_meta["hero_stats"][0].get("name") or top_hero_slug
        elif r_tr.get("hero_stats") and len(r_tr["hero_stats"]) > 0:
            top_hero_slug = r_tr["hero_stats"][0].get("hero") or r_tr["hero_stats"][0].get("name") or top_hero_slug
        elif t_gg.get("heroes") and len(t_gg["heroes"]) > 0:
            top_hero_slug = t_gg["heroes"][0].get("hero") or t_gg["heroes"][0].get("name") or top_hero_slug

        top_hero_slug = str(top_hero_slug).lower().strip().replace(" ", "-").replace("&", "and")

        return {
            "uid": uid,
            "platform": canonical_platform,
            "top_hero_slug": top_hero_slug,
            "player_identity": {
                "display_name": canonical_name,
                "username": canonical_name,
                "uid": uid,
                "platform": canonical_platform
            },
            "canonical": {
                "display_name": canonical_name,
                "username": canonical_name,
                "platform": canonical_platform,
                "total_matches": total_matches,
                "win_rate": str(win_rate),
                "kda": kda,
                "hero_damage_10m": hero_damage_10m,
                "healing_10m": healing_10m,
                "current_rank": current_rank,
                "rank_score": str(rank_score)
            },
            "extended_metrics": extended_metrics,
            "top_squadmates": top_squadmates,
            "hero_matchups": hero_matchups,
            "hero_leaderboard_badges": [],
            "raw_telemetry": raw_telemetry
        }

    @staticmethod
    async def process_async(raw_telemetry: Dict[str, Any], uid: str = "") -> Dict[str, Any]:
        data = MetricBrain.process(raw_telemetry, uid=uid)
        canonical_name = data.get("player_identity", {}).get("display_name", uid)
        canonical_platform = data.get("platform", "pc")
        top_hero_slug = data.get("top_hero_slug", "hulk")

        try:
            from backend.services.hero_leaderboard_service import HeroLeaderboardRankService
            rank_service = HeroLeaderboardRankService(
                hero_slug=top_hero_slug,
                ign=canonical_name,
                player_uid=uid,
                canonical_platform=canonical_platform
            )
            badges = await rank_service.get_badges()
            data["hero_leaderboard_badges"] = badges
        except Exception as e:
            logger.warning(f"[process_async] Hero leaderboard warning: {e}")
            data["hero_leaderboard_badges"] = []

        return data
