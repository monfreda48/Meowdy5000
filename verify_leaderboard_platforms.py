from bs4 import BeautifulSoup
from curl_cffi import requests

session = requests.Session(impersonate="chrome124")
HERO = "jubilee"

print("=" * 75)
print("[1] RIVALSDATA: TESTING PC VS CONSOLE LEADERBOARD")
print("=" * 75)
r_pc = session.get(f"https://rivalsdata.com/heroes/{HERO}/leaderboard?platform=pc", timeout=10)
r_con = session.get(f"https://rivalsdata.com/heroes/{HERO}/leaderboard?platform=console", timeout=10)

def extract_rd_top(html):
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.find_all("tr")
    names = []
    for row in rows[:5]:
        text = row.get_text(" ", strip=True)
        if text and "Player" not in text:
            names.append(text[:60])
    return names

pc_top = extract_rd_top(r_pc.text)
con_top = extract_rd_top(r_con.text)

print(f"PC Status: {r_pc.status_code} | Top Entries: {len(pc_top)}")
print(f"Console Status: {r_con.status_code} | Top Entries: {len(con_top)}")
print("Are PC and Console datasets different?:", pc_top != con_top)
if pc_top:
    print("  Sample PC Top     :", pc_top[0])
if con_top:
    print("  Sample Console Top :", con_top[0])

print("\n" + "=" * 75)
print("[2] RIVALSMETA: TESTING PC VS CONSOLE LEADERBOARD")
print("=" * 75)
meta_urls = [
    f"https://rivalsmeta.com/characters/{HERO}/leaderboard",
    f"https://rivalsmeta.com/characters/{HERO}/leaderboard?platform=console",
    f"https://rivalsmeta.com/characters/{HERO}/leaderboard?platform=ps5",
]
for url in meta_urls:
    res = session.get(url, timeout=10)
    print(f"Status: {res.status_code} | Bytes: {len(res.text)} | URL: {url}")

print("=" * 75)
