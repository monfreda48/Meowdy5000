import asyncio
import json
import os
import sys

# Ensure backend module is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.adapters.trackergg import fetch_all_trackergg_tabs

async def run_verification():
    target_user_name = "Meowdy 5000"
    print(f"=== INITIATING LIVE TRACKER.GG 5-TAB PROBE FOR '{target_user_name}' ===")
    data = await fetch_all_trackergg_tabs(target_user_name)

    ov = data.get("overview", {})
    print("\n[TAB 1: OVERVIEW]")
    print(f"  Matches Played : {ov.get('matches_played')} (Expected: ~3,966)")
    print(f"  Playtime       : {ov.get('playtime_hours')} (Expected: ~544h)")
    print(f"  Current RS     : {ov.get('rank_score')} (Expected: ~4,196)")
    print(f"  Kills          : {ov.get('kills', 0):,} (Expected: ~58,287)")
    print(f"  Total Damage   : {ov.get('damage', 0):,} (Expected: ~33,844,755)")
    print(f"  Total Healing  : {ov.get('healing', 0):,} (Expected: ~54,654,145)")
    print(f"  Damage Blocked : {ov.get('damage_blocked', 0):,} (Expected: ~29,366,667)")

    roles = data.get("roles", [])
    print(f"\n[TAB 2: ROLES] - Extracted {len(roles)} Roles")
    for r in roles:
        print(f"  Role: {r.get('role'):<12} | Matches: {r.get('matches'):<8} | WR: {r.get('win_rate')}% | KDA: {r.get('kda')}")

    heroes = data.get("heroes", [])
    print(f"\n[TAB 3: HEROES] - Extracted {len(heroes)} Heroes")
    for h in heroes[:4]:
        print(f"  Hero: {h.get('hero'):<15} | Matches: {h.get('matches'):<6} | WR: {h.get('win_rate')}% | KDA: {h.get('kda')} | Dmg/m: {h.get('damage_per_min')} | Heal/m: {h.get('heal_per_min')}")

    enc = data.get("encounters", [])
    print(f"\n[TAB 4: ENCOUNTERS] - Extracted {len(enc)} Teammates")
    for e in enc[:5]:
        print(f"  Player: {e.get('player_name'):<16} | Played With: {e.get('played_with_count')} games | Last: {e.get('last_encounter')}")

    matches = data.get("matches_data", {}).get("matches", [])
    print(f"\n[TAB 5: MATCHES] - Extracted {len(matches)} Recent Matches")
    if matches:
        m0 = matches[0]
        print(f"  Latest Match -> Score: {m0.get('score')} | Map: {m0.get('map')} | RS: {m0.get('rank_score')} | KDA: {m0.get('kda')}")

    print("\n=== VERIFICATION COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(run_verification())
