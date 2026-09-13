import asyncio
import sys
import os
from typing import Dict, Any, List

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.resolver import resolve_canonical_uid
from backend.adapters.rivalsdata import fetch_rivalsdata_profile
from backend.adapters.rivalstracker import fetch_rivalstracker_profile
from backend.adapters.rivalsmeta import fetch_all_rivalsmeta_tabs
from backend.adapters.trackergg import fetch_all_trackergg_tabs
from backend.services.transformer import TelemetryTransformer

def evaluate_status(val: Any) -> str:
    if val is None or val == "" or val == "N/A" or val == "--":
        return "MISSING [NONE]"
    if val == 0 or val == 0.0 or val == "0" or val == "0s" or val == "0%":
        return "WARNING [ZERO]"
    return "OK [FOUND]"

def format_val(val: Any) -> str:
    if val is None:
        return "None"
    if isinstance(val, (int, float)):
        return f"{val:,}" if isinstance(val, int) else f"{val:.2f}"
    s = str(val).strip()
    return (s[:18] + "..") if len(s) > 20 else s

async def run_telemetry_audit(target_user: str = "Meowdy 5000"):
    print("=" * 110)
    print(f"MARVEL RIVALS 4-SITE TELEMETRY AUDIT MATRIX: '{target_user}'")
    print("=" * 110)

    # 1. Identity Resolution
    print("\n[1/5] Resolving Canonical UID via RivalsData Redirect...")
    uid = await resolve_canonical_uid(target_user)
    print(f"      -> Target Input : {target_user}")
    print(f"      -> Resolved UID : {uid}")

    # 2. Fetching Raw Upstream Payloads Concurrently
    print("\n[2/5] Initiating Parallel Live Scrapes Across All 4 Trackers...")
    tasks = [
        fetch_rivalsdata_profile(uid),
        fetch_rivalstracker_profile(uid),
        fetch_all_rivalsmeta_tabs(uid),
        fetch_all_trackergg_tabs(target_user)
    ]
    rd, rt, rm, tgg = await asyncio.gather(*tasks, return_exceptions=True)

    rd = rd if isinstance(rd, dict) else {}
    rt = rt if isinstance(rt, dict) else {}
    rm = rm if isinstance(rm, dict) else {}
    tgg = tgg if isinstance(tgg, dict) else {}

    print(f"      -> RivalsData   : {'SUCCESS' if rd else 'FAILED/EMPTY'}")
    print(f"      -> RivalsTracker: {'SUCCESS' if rt else 'FAILED/EMPTY'}")
    print(f"      -> RivalsMeta   : {'SUCCESS (' + str(len(rm)) + ' tabs)' if rm else 'FAILED/EMPTY'}")
    print(f"      -> Tracker.gg   : {'SUCCESS (' + str(len(tgg)) + ' tabs)' if tgg else 'FAILED/EMPTY'}")

    # 3. Canonical Transformation
    canonical = TelemetryTransformer.unify_player_payload(uid, rd, rt, rm, tgg)

    # 4. Metric Comparison Matrix
    tgg_ov = tgg.get("overview", {}) if isinstance(tgg, dict) else {}
    rm_ov = rm.get("overview", {}) if isinstance(rm, dict) else {}
    rm_h0 = rm.get("heroes", {}).get("heroes", [{}])[0] if isinstance(rm.get("heroes"), dict) and rm.get("heroes", {}).get("heroes") else {}
    tgg_h0 = tgg.get("heroes", [{}])[0] if isinstance(tgg.get("heroes"), list) and len(tgg.get("heroes")) > 0 else {}

    audit_keys = [
        ("Player Level", rd.get("level"), rt.get("level"), rm_ov.get("level"), tgg_ov.get("level"), canonical.get("level")),
        ("Current Rank", rd.get("rank"), rt.get("rank"), rm_ov.get("rank"), tgg_ov.get("rank"), canonical.get("rank")),
        ("Rank Score (RS)", rd.get("rank_points"), rt.get("score"), rm_ov.get("rank_score"), tgg_ov.get("rank_score"), canonical.get("rank_points")),
        ("Win Rate %", rd.get("win_rate"), rt.get("win_rate"), rm_ov.get("win_rate"), tgg_ov.get("win_rate"), canonical.get("win_rate")),
        ("Matches Played", rd.get("total_matches"), rt.get("total_matches"), rm_ov.get("total_matches"), tgg_ov.get("matches_played"), canonical.get("total_matches")),
        ("Total Kills", rd.get("elims"), rt.get("kills"), rm_ov.get("kills"), tgg_ov.get("kills"), canonical.get("kills")),
        ("Total Deaths", rd.get("deaths"), rt.get("deaths"), rm_ov.get("deaths"), tgg_ov.get("deaths"), canonical.get("deaths")),
        ("Total Assists", rd.get("assists"), rt.get("assists"), rm_ov.get("assists"), tgg_ov.get("assists"), canonical.get("assists")),
        ("KDA Ratio", rd.get("kda"), rt.get("kda"), rm_ov.get("kda"), tgg_ov.get("kda_ratio"), canonical.get("kda")),
        ("Damage / Min", rd.get("dmg_min"), rt.get("dmg_min"), rm_h0.get("damage_per_min"), tgg_ov.get("damage_per_min"), canonical.get("damage_per_min")),
        ("Damage / 10M", None, None, int(rm_h0.get("damage_per_min", 0) * 10) if rm_h0 and rm_h0.get("damage_per_min") else None, tgg_ov.get("damage_10m"), canonical.get("damage_per_10m")),
        ("Healing / Min", None, None, rm_h0.get("heal_per_min"), tgg_ov.get("heal_per_min"), canonical.get("healing_per_min")),
        ("Healing / 10M", None, None, int(rm_h0.get("heal_per_min", 0) * 10) if rm_h0 and rm_h0.get("heal_per_min") else None, tgg_ov.get("healing_10m"), canonical.get("healing_per_10m")),
        ("Top Hero Name", None, rt.get("top_hero"), rm_h0.get("hero_name"), tgg_h0.get("hero"), canonical.get("top_hero_name")),
        ("Top Hero Playtime", None, None, rm_h0.get("time_played"), tgg_h0.get("matches"), canonical.get("top_hero_playtime_hours"))
    ]

    print("\n[3/5] Metric Audit Comparison Table:")
    print("-" * 110)
    print(f"{'METRIC':<22} | {'RivalsData':<13} | {'RivalsTracker':<13} | {'RivalsMeta':<13} | {'Tracker.gg':<13} | {'CANONICAL':<13} | STATUS")
    print("-" * 110)

    for metric_name, v_rd, v_rt, v_rm, v_tgg, v_can in audit_keys:
        status = evaluate_status(v_can)
        print(f"{metric_name:<22} | {format_val(v_rd):<13} | {format_val(v_rt):<13} | {format_val(v_rm):<13} | {format_val(v_tgg):<13} | {format_val(v_can):<13} | {status}")
    print("-" * 110)

    # 5. Summary & Health Report
    found_count = sum(1 for _, _, _, _, _, v in audit_keys if evaluate_status(v).startswith("OK"))
    total_count = len(audit_keys)
    coverage_pct = (found_count / total_count) * 100

    print("\n[4/5] Coverage Summary:")
    print(f"      -> Canonical Metric Coverage: {found_count}/{total_count} ({coverage_pct:.1f}%)")
    print(f"      -> Sources Synced          : {canonical.get('sources_synced')}")

    print("\n[5/5] Audit Verification Complete.\n")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "Meowdy 5000"
    asyncio.run(run_telemetry_audit(target))
