import json
import re
from bs4 import BeautifulSoup
from curl_cffi import requests

HERO = "jubilee"
UID = "70463344"
IGN = "Meowdy 5000"
ALT_IGN = "Braekdown48"

session = requests.Session(impersonate="chrome124")

print("=" * 75)
print(f"[1] PROBING RIVALSDATA PLATFORM MECHANISM ({HERO})")
print("=" * 75)

rd_url = f"https://rivalsdata.com/heroes/{HERO}/leaderboard"
# Test direct query parameters
for param in [{"platform": "console"}, {"device": "console"}, {"type": "console"}, {}]:
    try:
        r = session.get(rd_url, params=param, timeout=10)
        has_user = any(k.lower() in r.text.lower() for k in [IGN, ALT_IGN, UID])
        print(f"  Query {param} -> Status: {r.status_code}, Bytes: {len(r.text)}, Found Player: {has_user}")
        
        # Check for embedded API calls or state in HTML
        if not param:
            apis = re.findall(r'["\'](/api/[^"\']+)["\']', r.text)
            if apis:
                print(f"    Discovered internal APIs: {set(apis)}")
    except Exception as e:
        print(f"  Error on RivalsData {param}: {e}")

print("\n" + "=" * 75)
print(f"[2] PROBING RIVALSTRACKER API & PLATFORM SWITCH ({HERO})")
print("=" * 75)

rt_endpoints = [
    f"https://rivalstracker.com/heroes/{HERO}",
    f"https://api.rivalstracker.com/api/heroes/{HERO}/leaderboard?device=ps",
    f"https://api.rivalstracker.com/api/heroes/{HERO}/leaderboard?platform=playstation",
    f"https://api.rivalstracker.com/api/heroes/{HERO}/leaderboard?platform=console",
]

for url in rt_endpoints:
    try:
        r = session.get(url, timeout=10)
        print(f"  Testing: {url[:70]}")
        print(f"    Status: {r.status_code}, Content-Type: {r.headers.get('content-type', '')[:30]}")
        if r.status_code == 200:
            has_user = any(k.lower() in r.text.lower() for k in [IGN, ALT_IGN, UID])
            print(f"    Found Player: {has_user} (Length: {len(r.text)} bytes)")
    except Exception as e:
        print(f"    Error: {e}")

print("\n" + "=" * 75)
print(f"[3] PROBING RIVALSMETA HERO LEADERBOARD ({HERO})")
print("=" * 75)

rm_url = f"https://rivalsmeta.com/characters/{HERO}/leaderboard"
try:
    r = session.get(rm_url, timeout=10)
    print(f"  URL: {rm_url} -> Status: {r.status_code}, Bytes: {len(r.text)}")
    soup = BeautifulSoup(r.text, "html.parser")
    rows = soup.find_all("tr")
    print(f"  Leaderboard Rows: {len(rows)}")
    has_user = any(k.lower() in r.text.lower() for k in [IGN, ALT_IGN, UID])
    print(f"  Found Player in Table: {has_user}")
except Exception as e:
    print(f"  Error on RivalsMeta: {e}")

print("=" * 75)
