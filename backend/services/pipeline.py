import os
import sqlite3
import asyncio
import re
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from backend.services.multi_source_fetcher import MultiSourceTrackerFetcher

logger = logging.getLogger("ingestion_pipeline")

def resolve_player_identity(target: str, default_platform: str = "PS5") -> Tuple[Optional[str], Optional[str], str]:
    """
    Resolves numeric UID and Username from SQLite databases (stats.db, rivals_tracker.db, rivals.db).
    Strictly refrains from injecting any hardcoded names or mock defaults.
    """
    clean = str(target).strip()
    if not clean:
        return None, None, default_platform.upper()

    resolved_uid = clean if clean.isdigit() else None
    resolved_ign = clean if not clean.isdigit() else None
    resolved_platform = default_platform.upper()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_files = ['stats.db', 'rivals_tracker.db', 'rivals.db']

    for db_name in db_files:
        db_path = os.path.join(base_dir, db_name)
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()

                # Check players table
                try:
                    cur.execute(
                        "SELECT uid, username, platform FROM players WHERE uid = ? OR username = ? COLLATE NOCASE LIMIT 1;",
                        (clean, clean)
                    )
                    row = cur.fetchone()
                except sqlite3.OperationalError:
                    row = None

                # Check tracked_players table fallback
                if not row:
                    try:
                        cur.execute(
                            "SELECT uid, player_name as username, platform FROM tracked_players WHERE uid = ? OR player_name = ? COLLATE NOCASE LIMIT 1;",
                            (clean, clean)
                        )
                        row = cur.fetchone()
                    except sqlite3.OperationalError:
                        row = None

                conn.close()

                if row:
                    r = dict(row)
                    if r.get("uid"):
                        resolved_uid = str(r["uid"]).strip()
                    if r.get("username"):
                        resolved_ign = str(r["username"]).strip()
                    if r.get("platform"):
                        plat = str(r["platform"]).strip().upper()
                        if "PLAYSTATION" in plat or "PSN" in plat:
                            plat = "PS5"
                        resolved_platform = plat
                    break
            except Exception as e:
                logger.debug(f"[IdentityResolution] SQLite error on {db_name}: {e}")

    return resolved_uid, resolved_ign, resolved_platform

def parse_number_value(val: Any) -> Optional[float]:
    """Extracts floating point value from arbitrary scraped metric representation, returning None if invalid."""
    if val is None:
        return None
    s = str(val).strip().replace(',', '').replace('%', '').replace('RS', '').replace('h', '').replace('/10m', '').strip()
    if not s or s in ['--', 'N/A', 'null', 'None', 'Unranked', '0', '0.0', '0%']:
        return None
    try:
        f = float(s)
        return f if f > 0 else None
    except (ValueError, TypeError):
        return None

def compute_metric_consensus(sources_dict: Dict[str, Optional[str]], metric_type: str) -> Dict[str, Any]:
    """
    Calculates arithmetic mean for reported provider metrics when 2+ providers supply valid numbers.
    If 1 provider reports, uses that value. If 0 report, returns '--'.
    """
    valid_floats: List[float] = []
    formatted_sources: Dict[str, str] = {}

    for source_key, val_str in sources_dict.items():
        if val_str is not None and str(val_str).strip() not in ['', '--', 'N/A', 'null', 'None']:
            formatted_sources[source_key] = str(val_str).strip()
            num = parse_number_value(val_str)
            if num is not None:
                valid_floats.append(num)
        else:
            formatted_sources[source_key] = "--"

    if not valid_floats:
        display_val = "--"
    elif len(valid_floats) == 1:
        val = valid_floats[0]
        if metric_type == "win_rate":
            display_val = f"{val:.1f}%" if not str(formatted_sources.get(next(iter(formatted_sources)))).endswith('%') else str(sources_dict[next(iter(sources_dict))])
        elif metric_type == "kda":
            display_val = f"{val:.2f}"
        elif metric_type == "total_matches":
            display_val = f"{int(round(val))}"
        else:  # damage_10m, healing_10m, blocked_10m
            display_val = f"{int(round(val)):,}"
    else:
        mean_val = sum(valid_floats) / len(valid_floats)
        if metric_type == "win_rate":
            display_val = f"{mean_val:.1f}%"
        elif metric_type == "kda":
            display_val = f"{mean_val:.2f}"
        elif metric_type == "total_matches":
            display_val = f"{int(round(mean_val))}"
        else:
            display_val = f"{int(round(mean_val)):,}"

    return {
        "display": display_val,
        "sources": formatted_sources
    }

def fetch_and_normalize(target_uid_or_ign: str, platform: str = "ps5") -> Dict[str, Any]:
    """
    Strict, non-mocked data ingestion pipeline executing concurrent 4-provider telemetry fetching.
    Returns zero hardcoded fallback objects or synthetic mock strings.
    """
    clean_target = str(target_uid_or_ign).strip()
    if not clean_target:
        return {
            "status": "error",
            "error": "Target UID or Username is required.",
            "player": {"uid": None, "username": None, "platform": platform.upper(), "level": None, "rank": "Unranked", "rank_score": None, "peak_rank": None},
            "consensus": {
                "win_rate": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}},
                "kda": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}},
                "total_matches": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}},
                "damage_10m": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}},
                "healing_10m": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}},
                "blocked_10m": {"display": "--", "sources": {"tracker_gg": "--", "rivals_meta": "--", "rivals_tracker": "--", "rivals_data": "--"}}
            },
            "sources": {
                "tracker_gg": {"status": "empty", "raw_stats": {}, "heroes": [], "matches": []},
                "rivals_meta": {"status": "empty", "raw_stats": {}, "heroes": [], "matchups": []},
                "rivals_tracker": {"status": "empty", "raw_stats": {}, "heroes": [], "history": []},
                "rivals_data": {"status": "empty", "raw_stats": {}, "heroes": []}
            }
        }

    # 1. Resolve identity from SQLite
    res_uid, res_ign, res_platform = resolve_player_identity(clean_target, default_platform=platform)
    query_uid = res_uid or clean_target
    query_ign = res_ign or clean_target

    # 2. Concurrently fetch all 4 providers via MultiSourceTrackerFetcher
    fetcher = MultiSourceTrackerFetcher(uid=query_uid, ign=query_ign)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    try:
        raw_telemetry = loop.run_until_complete(fetcher.fetch_all())
    except Exception as e:
        logger.error(f"[Pipeline Ingestion Error]: {e}")
        raw_telemetry = {}

    # 3. Extract provider payloads
    t_gg_res = raw_telemetry.get("tracker_gg", {}) if isinstance(raw_telemetry.get("tracker_gg"), dict) else {}
    r_tr_res = raw_telemetry.get("rivals_tracker", {}) if isinstance(raw_telemetry.get("rivals_tracker"), dict) else {}
    r_meta_res = raw_telemetry.get("rivals_meta", {}) if isinstance(raw_telemetry.get("rivals_meta"), dict) else {}
    r_data_res = raw_telemetry.get("rivals_data", {}) if isinstance(raw_telemetry.get("rivals_data"), dict) else {}

    t_gg_data = t_gg_res.get("data", {}) if isinstance(t_gg_res.get("data"), dict) else {}
    r_tr_data = r_tr_res.get("data", {}) if isinstance(r_tr_res.get("data"), dict) else {}
    r_meta_data = r_meta_res.get("data", {}) if isinstance(r_meta_res.get("data"), dict) else {}
    r_data_data = r_data_res.get("data", {}) if isinstance(r_data_res.get("data"), dict) else {}

    # Extract Tracker.gg segments
    t_stats = {}
    t_heroes = []
    t_matches = []
    if isinstance(t_gg_data, dict):
        for seg in t_gg_data.get("segments", []) if isinstance(t_gg_data.get("segments"), list) else []:
            if isinstance(seg, dict):
                if seg.get("type") == "overview":
                    t_stats = seg.get("stats", {})
                elif seg.get("type") == "hero":
                    t_heroes.append(seg)
        if isinstance(t_gg_data.get("matches"), list):
            t_matches = t_gg_data["matches"]

    # Extract RivalsMeta arrays
    rm_heroes = r_meta_data.get("heroes", []) if isinstance(r_meta_data.get("heroes"), list) else []
    rm_matchups = r_meta_data.get("matchups", []) if isinstance(r_meta_data.get("matchups"), list) else []

    # Extract RivalsTracker arrays
    rtr_heroes = r_tr_data.get("heroes", []) if isinstance(r_tr_data.get("heroes"), list) else []
    rtr_history = r_tr_data.get("history", []) if isinstance(r_tr_data.get("history"), list) else []

    # Extract RivalsData arrays
    rd_heroes = r_data_data.get("heroes", []) if isinstance(r_data_data.get("heroes"), list) else []

    # 4. Resolve Player Identity Metadata (strict nulls if unsupplied)
    final_username = (
        res_ign or
        t_gg_data.get("userInfo", {}).get("userNickname") or
        r_tr_data.get("username") or
        (clean_target if not clean_target.isdigit() else None)
    )

    final_uid = (
        res_uid or
        t_gg_data.get("userInfo", {}).get("userId") or
        r_tr_data.get("uid") or
        (clean_target if clean_target.isdigit() else None)
    )

    final_level = None
    level_candidate = t_stats.get("accountLevel", {}).get("value") or r_data_data.get("level")
    if level_candidate is not None:
        try:
            final_level = int(level_candidate)
        except (ValueError, TypeError):
            final_level = None

    rank_val = (
        t_stats.get("rank", {}).get("displayValue") or
        r_tr_data.get("rank") or
        (r_data_data.get("rank_tier") if r_data_data.get("rank_tier") not in ["Unranked", "0", None] else None) or
        "Unranked"
    )

    rank_score_val = (
        t_stats.get("rankScore", {}).get("displayValue") or
        r_tr_data.get("score") or
        r_data_data.get("rank_score") or
        None
    )

    peak_rank_val = (
        t_stats.get("peakRank", {}).get("displayValue") or
        r_tr_data.get("peak_score") or
        None
    )

    # 5. Build provider sources map for consensus calculation
    sources_wr = {
        "tracker_gg": t_stats.get("winRate", {}).get("displayValue"),
        "rivals_meta": r_meta_data.get("win_rate"),
        "rivals_tracker": r_tr_data.get("win_rate"),
        "rivals_data": r_data_data.get("win_rate") if r_data_data.get("win_rate") not in ["0%", "0", "0.0%"] else None
    }

    sources_kda = {
        "tracker_gg": str(round(parse_number_value(t_stats.get("kda", {}).get("value")), 2)) if parse_number_value(t_stats.get("kda", {}).get("value")) is not None else None,
        "rivals_meta": str(r_meta_data.get("kda")) if r_meta_data.get("kda") else None,
        "rivals_tracker": str(r_tr_data.get("kda")) if r_tr_data.get("kda") else None,
        "rivals_data": str(r_data_data.get("kda")) if r_data_data.get("kda") else None
    }

    sources_matches = {
        "tracker_gg": str(int(t_stats.get("matchesPlayed", {}).get("value"))) if t_stats.get("matchesPlayed", {}).get("value") is not None else None,
        "rivals_meta": str(r_meta_data.get("total_matches")) if r_meta_data.get("total_matches") else None,
        "rivals_tracker": str(r_tr_data.get("total_matches") or r_tr_data.get("total_games")) if (r_tr_data.get("total_matches") or r_tr_data.get("total_games")) else None,
        "rivals_data": str(r_data_data.get("total_matches")) if r_data_data.get("total_matches") else None
    }

    sources_dmg = {
        "tracker_gg": t_stats.get("damagePer10m", {}).get("displayValue"),
        "rivals_meta": r_meta_data.get("damage_per_10m"),
        "rivals_tracker": None,
        "rivals_data": None
    }

    sources_heal = {
        "tracker_gg": t_stats.get("healingPer10m", {}).get("displayValue"),
        "rivals_meta": r_meta_data.get("healing_per_10m"),
        "rivals_tracker": None,
        "rivals_data": None
    }

    sources_block = {
        "tracker_gg": t_stats.get("damageBlockedPer10m", {}).get("displayValue"),
        "rivals_meta": None,
        "rivals_tracker": None,
        "rivals_data": None
    }

    # 6. Calculate strict arithmetic consensus for all 6 core metrics
    consensus_win_rate = compute_metric_consensus(sources_wr, "win_rate")
    consensus_kda = compute_metric_consensus(sources_kda, "kda")
    consensus_matches = compute_metric_consensus(sources_matches, "total_matches")
    consensus_dmg = compute_metric_consensus(sources_dmg, "damage_10m")
    consensus_heal = compute_metric_consensus(sources_heal, "healing_10m")
    consensus_block = compute_metric_consensus(sources_block, "blocked_10m")

    # 7. Construct strictly shaped schema
    player_dict = {
        "uid": final_uid,
        "username": final_username,
        "platform": res_platform,
        "level": final_level,
        "rank": rank_val,
        "rank_score": rank_score_val,
        "peak_rank": peak_rank_val
    }

    consensus_dict = {
        "win_rate": consensus_win_rate,
        "kda": consensus_kda,
        "total_matches": consensus_matches,
        "damage_10m": consensus_dmg,
        "healing_10m": consensus_heal,
        "blocked_10m": consensus_block
    }

    sources_dict = {
        "tracker_gg": {
            "status": "success" if t_stats or t_gg_data else ("error: " + t_gg_res.get("error", "empty")),
            "raw_stats": t_stats,
            "heroes": t_heroes,
            "matches": t_matches
        },
        "rivals_meta": {
            "status": "success" if r_meta_data else ("error: " + r_meta_res.get("error", "empty")),
            "raw_stats": r_meta_data,
            "heroes": rm_heroes,
            "matchups": rm_matchups
        },
        "rivals_tracker": {
            "status": "success" if r_tr_data else ("error: " + r_tr_res.get("error", "empty")),
            "raw_stats": r_tr_data,
            "heroes": rtr_heroes,
            "history": rtr_history
        },
        "rivals_data": {
            "status": "success" if r_data_data else ("error: " + r_data_res.get("error", "empty")),
            "raw_stats": r_data_data,
            "heroes": rd_heroes
        }
    }

    payload = {
        "status": "success",
        "player": player_dict,
        "consensus": consensus_dict,
        "sources": sources_dict
    }

    # Add legacy helper bindings for frontend compatibility
    total_m_val = parse_number_value(consensus_matches["display"]) or 0
    wr_val = parse_number_value(consensus_win_rate["display"]) or 0
    m_won = int(round(total_m_val * (wr_val / 100.0))) if total_m_val > 0 and wr_val > 0 else 0
    m_lost = max(0, int(total_m_val) - m_won) if total_m_val > 0 else 0

    payload["current"] = {
        "uid": final_uid,
        "username": final_username,
        "platform": res_platform,
        "level": final_level,
        "rank": rank_val,
        "rankScore": rank_score_val,
        "rank_score": rank_score_val,
        "peakRank": peak_rank_val,
        "peak_rank": peak_rank_val,
        "winRate": consensus_win_rate["display"],
        "win_rate": consensus_win_rate["display"],
        "kda": consensus_kda["display"],
        "kdRatio": consensus_kda["display"],
        "matchesPlayed": consensus_matches["display"],
        "total_matches": consensus_matches["display"],
        "matches": consensus_matches["display"],
        "matchesWon": m_won,
        "matchesLost": m_lost,
        "heroDamage": consensus_dmg["display"],
        "damagePer10m": consensus_dmg["display"],
        "healing": consensus_heal["display"],
        "healingPer10m": consensus_heal["display"],
        "damageBlocked": consensus_block["display"],
        "timePlayed": t_stats.get("timePlayed", {}).get("displayValue") or "--"
    }

    payload["reconciled_stats"] = {
        "winRate": {"display_value": consensus_win_rate["display"], "consensus_value": consensus_win_rate["display"], "sources": consensus_win_rate["sources"]},
        "win_rate": {"display_value": consensus_win_rate["display"], "consensus_value": consensus_win_rate["display"], "sources": consensus_win_rate["sources"]},
        "kda": {"display_value": consensus_kda["display"], "consensus_value": consensus_kda["display"], "sources": consensus_kda["sources"]},
        "matchesPlayed": {"display_value": consensus_matches["display"], "consensus_value": consensus_matches["display"], "sources": consensus_matches["sources"]},
        "heroDamage": {"display_value": consensus_dmg["display"], "consensus_value": consensus_dmg["display"], "sources": consensus_dmg["sources"]},
        "healing": {"display_value": consensus_heal["display"], "consensus_value": consensus_heal["display"], "sources": consensus_heal["sources"]},
        "damageBlocked": {"display_value": consensus_block["display"], "consensus_value": consensus_block["display"], "sources": consensus_block["sources"]}
    }

    return payload
