import json
import re
from bs4 import BeautifulSoup

print("=" * 70)
print("[1] TRACKER.GG STAT KEYS SAMPLE (tracker_gg_profile_overview.json)")
print("=" * 70)

try:
    with open("tracker_recon/payloads/tracker_gg_profile_overview.json", "r", encoding="utf-8") as f:
        t_data = json.load(f)
    segments = t_data.get("data", {}).get("segments", [])
    print(f"Total Segments Found: {len(segments)}")
    for seg in segments[:3]:
        seg_type = seg.get("type")
        seg_name = seg.get("metadata", {}).get("name", "Overall")
        stats = seg.get("stats", {})
        stat_names = list(stats.keys())
        print(f"  * Segment [{seg_type}] {seg_name}: {len(stat_names)} stats -> {stat_names[:6]}")
except Exception as e:
    print(f"Error inspecting Tracker.gg: {e}")

print("\n" + "=" * 70)
print("[2] DECODING RIVALSDATA HTML STRUCTURE (rivals_data_dump.html)")
print("=" * 70)

try:
    with open("tracker_recon/probes/rivals_data_dump.html", "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Check for Inertia.js data-page attribute
    inertia_match = re.search(r'data-page="([^"]+)"', html)
    if inertia_match:
        import html as html_lib
        raw_json = html_lib.unescape(inertia_match.group(1))
        parsed = json.loads(raw_json)
        out_path = "tracker_recon/payloads/rivals_data_inertia.json"
        with open(out_path, "w", encoding="utf-8") as out:
            json.dump(parsed, out, indent=2)
        print(f"[SUCCESS] RivalsData uses Inertia.js! Saved props to {out_path}")
        print(f"          Props Keys: {list(parsed.get('props', {}).keys())}")

    # 2. Check for internal API endpoints referenced in scripts
    api_routes = set(re.findall(r'["\'](/api/[^"\']+)["\']', html))
    if api_routes:
        print(f"Discovered internal API routes in HTML: {list(api_routes)}")

    # 3. If standard SSR HTML, inspect main content divs/tables
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string if soup.title else "No Title"
    print(f"Page Title: {title.strip()}")
    
    stat_containers = soup.find_all(class_=re.compile(r'(stat|hero|profile|card|metric)', re.I))
    print(f"Found {len(stat_containers)} elements with stat/hero/profile classes.")
    if stat_containers:
        sample_text = " | ".join([c.get_text(strip=True) for c in stat_containers[:5] if c.get_text(strip=True)])
        print(f"Sample rendered stats: {sample_text[:200]}")

except Exception as e:
    print(f"Error inspecting RivalsData HTML: {e}")

print("=" * 70)
