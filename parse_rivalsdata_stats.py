from bs4 import BeautifulSoup
import json
import re

with open("tracker_recon/probes/rivals_data_dump.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")

print("=" * 70)
print("[1] RIVALSDATA EMBEDDED SCRIPTS & JSON DATA")
print("=" * 70)
scripts = soup.find_all("script")
found_script_data = False
for i, s in enumerate(scripts):
    s_type = s.get("type", "")
    s_id = s.get("id", "")
    content = s.string or ""
    if "json" in s_type.lower() or "{" in content:
        # Check if contains player or stat keywords
        if any(k in content.lower() for k in ["damage", "kills", "winrate", "season", "rank"]):
            print(f"Found candidate script #{i} (id='{s_id}', type='{s_type}'): {len(content)} chars")
            # Try to save first 1000 chars preview
            print(f"Preview: {content[:300]}...\n")
            found_script_data = True

if not found_script_data:
    print("No embedded JSON script found. RivalsData is 100% Server-Side Rendered (SSR) HTML.")

print("=" * 70)
print("[2] RIVALSDATA RENDERED STAT LABELS & VALUES")
print("=" * 70)
# Look for standard stat card pairs (label + value)
cards = soup.find_all(lambda el: el.name in ['div', 'span', 'p'] and any(c in el.get('class', []) for c in ['stat', 'card', 'box', 'item']))
extracted = []
for c in cards:
    txt = c.get_text(" ", strip=True)
    if any(k in txt.lower() for k in ["win", "k/d", "kda", "damage", "heal", "match", "rank"]):
        extracted.append(txt)

for item in list(dict.fromkeys(extracted))[:12]:
    print(f"  -> {item}")

print("=" * 70)
