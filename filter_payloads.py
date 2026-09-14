import glob, json, os

bundle = {}
print(f"{'FILE':<28} | {'SIZE':<9} | TOP KEYS")
print("-" * 75)

for path in sorted(glob.glob("tracker_recon/payloads/*.json")):
    try:
        size = f"{os.path.getsize(path)/1024:.1f} KB"
        filename = os.path.basename(path)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # Check for real Marvel Rivals game telemetry signatures
        dump_str = json.dumps(data)[:2000].lower()
        signatures = ["heroes_ranked", "match_history", "player_uid", "total_matches", "rank_game", "segments", "hero_damage"]
        
        if any(k in dump_str for k in signatures):
            bundle[filename] = data
            if isinstance(data, dict):
                keys = list(data.keys())[:5]
                print(f"{filename:<28} | {size:<9} | {keys}")
            elif isinstance(data, list):
                print(f"{filename:<28} | {size:<9} | [List of {len(data)} items]")
    except Exception:
        pass

output_bundle = "tracker_recon/game_data_bundle.json"
with open(output_bundle, "w", encoding="utf-8") as out:
    json.dump(bundle, out, indent=2)

print("-" * 75)
print(f"Bundled {len(bundle)} game payload(s) into: {output_bundle}")
