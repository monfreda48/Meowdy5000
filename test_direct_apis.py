import json
import re
import urllib.parse
from curl_cffi import requests

IGN = "Meowdy 5000"
SEASON = 20

print("=" * 70)
print("[1] INSPECTING RIVALSDATA HTML FOR EMBEDDED JSON/STATS")
print("=" * 70)

try:
    with open("tracker_recon/probes/rivals_data_dump.html", "r", encoding="utf-8") as f:
        html = f.read()

    # Look for script tags holding JSON data (__NEXT_DATA__, window.__INITIAL_STATE__, etc.)
    matches = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    found_json = False
    for i, m in enumerate(matches):
        m_strip = m.strip()
        if (m_strip.startswith("{") and m_strip.endswith("}")) or "__NEXT_DATA__" in m or "props" in m:
            try:
                # Extract clean json
                json_str = m_strip
                if "{" in json_str:
                    json_str = json_str[json_str.find("{"):json_str.rfind("}")+1]
                data = json.loads(json_str)
                out_path = f"tracker_recon/payloads/rivals_data_embedded_{i}.json"
                with open(out_path, "w", encoding="utf-8") as out:
                    json.dump(data, out, indent=2)
                print(f"[SUCCESS] Extracted embedded JSON from RivalsData -> {out_path} ({len(json_str)} chars)")
                print(f"          Top keys: {list(data.keys())[:6]}")
                found_json = True
            except Exception:
                pass

    if not found_json:
        # Check if raw stat keywords exist in the HTML text
        stat_keywords = ["K/D", "Win", "Rank", "Damage", "Matches", "Hero"]
        found_kw = [k for k in stat_keywords if k.lower() in html.lower()]
        print(f"RivalsData HTML contains stat keywords: {found_kw}")

except Exception as e:
    print(f"Error inspecting RivalsData dump: {e}")

print("\n" + "=" * 70)
print("[2] QUERYING TRACKER.GG DIRECT REST API VIA CURL_CFFI")
print("=" * 70)

encoded_ign = urllib.parse.quote(IGN)
tracker_endpoints = {
    "profile_overview": f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}",
    "ranked_overview": f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}/stats/overview/ranked?season={SEASON}",
    "career_segments": f"https://api.tracker.gg/api/v2/marvel-rivals/standard/profile/ign/{encoded_ign}/segments/career?mode=all&season={SEASON}"
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": f"https://tracker.gg/marvel-rivals/profile/ign/{encoded_ign}/overview",
    "Origin": "https://tracker.gg"
}

session = requests.Session(impersonate="chrome124")

for name, url in tracker_endpoints.items():
    try:
        resp = session.get(url, headers=headers, timeout=10)
        print(f"Endpoint: {name}")
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            out_file = f"tracker_recon/payloads/tracker_gg_{name}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"  [SUCCESS] Saved payload -> {out_file}")
            # Print sample top-level keys
            if isinstance(data, dict):
                print(f"  Keys: {list(data.keys())}")
                if "data" in data and isinstance(data["data"], dict):
                    print(f"  Inner Data Keys: {list(data['data'].keys())}")
        else:
            print(f"  Response ({len(resp.text)} bytes): {resp.text[:200]}")
    except Exception as e:
        print(f"  Error on {name}: {e}")

print("=" * 70)
