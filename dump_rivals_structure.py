from bs4 import BeautifulSoup
import re

with open("tracker_recon/probes/rivals_data_dump.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

print("=" * 70)
print("[1] SCRIPT BUNDLES & ASSETS")
print("=" * 70)
scripts = [s["src"] for s in soup.find_all("script", src=True)]
for src in scripts[:8]:
    print(f"  * {src}")

print("\n" + "=" * 70)
print("[2] HEADINGS (H1-H4)")
print("=" * 70)
for h in soup.find_all(["h1", "h2", "h3", "h4"]):
    text = h.get_text(strip=True)
    if text:
        print(f"  <{h.name}> {text}")

print("\n" + "=" * 70)
print("[3] TABLES & DATA MATRICES")
print("=" * 70)
tables = soup.find_all("table")
print(f"Total <table> elements found: {len(tables)}")
for i, t in enumerate(tables[:3]):
    print(f"\nTable #{i+1}:")
    rows = t.find_all("tr")
    for r in rows[:6]:
        cols = [c.get_text(strip=True) for c in r.find_all(["th", "td"])]
        if any(cols):
            print("   ", cols)

print("\n" + "=" * 70)
print("[4] ELEMENTS SURROUNDING PLAYER / CLAN IDENTITY")
print("=" * 70)
matches = soup.find_all(string=re.compile(r"Meowdy|SN4CK", re.I))
for m in matches[:3]:
    p = m.parent
    grandparent = p.parent if p else None
    if grandparent:
        print(f"Container <{grandparent.name}> (classes: {grandparent.get('class', [])}):")
        print(f"  Text: {grandparent.get_text(' | ', strip=True)[:300]}\n")

print("=" * 70)
