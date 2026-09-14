import os
import json
import re
import httpx
from bs4 import BeautifulSoup

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "heroes.json")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "heroes")
LIQUIPEDIA_URL = "https://liquipedia.net/marvelrivals/Hero_ID"

HEADERS = {
    "User-Agent": "M5StatTracker/1.0 (contact: admin@m5stats.local; personal use)",
    "Accept-Encoding": "gzip, deflate"
}

def load_heroes():
    target_path = os.path.abspath(DATA_FILE)
    if os.path.exists(target_path):
        with open(target_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

async def sync_hero_roster():
    static_target_dir = os.path.abspath(STATIC_DIR)
    data_target_file = os.path.abspath(DATA_FILE)
    
    os.makedirs(static_target_dir, exist_ok=True)
    os.makedirs(os.path.dirname(data_target_file), exist_ok=True)
    heroes = load_heroes()
    
    try:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(LIQUIPEDIA_URL)
            if resp.status_code != 200:
                print(f"[HeroSync] Liquipedia returned HTTP {resp.status_code}, using cached roster.")
                return heroes
            
            soup = BeautifulSoup(resp.text, "html.parser")
            rows = soup.find_all("tr")
            
            for row in rows:
                cols = row.find_all(["td", "th"])
                if len(cols) < 2:
                    continue
                
                text_content = " ".join([c.get_text(strip=True) for c in cols])
                id_match = re.search(r"\b(10\d{2})\b", text_content)
                if not id_match:
                    continue
                
                hero_id = id_match.group(1)
                name = cols[1].get_text(strip=True) if len(cols) > 1 else f"Hero {hero_id}"
                
                # Extract portrait image
                img_tag = row.find("img")
                local_icon = f"/static/heroes/{hero_id}.png"
                local_icon_path = os.path.join(static_target_dir, f"{hero_id}.png")
                
                if img_tag and not os.path.exists(local_icon_path):
                    img_url = img_tag.get("src", "")
                    if img_url.startswith("/"):
                        img_url = "https://liquipedia.net" + img_url
                    try:
                        img_resp = await client.get(img_url, timeout=5.0)
                        if img_resp.status_code == 200:
                            with open(local_icon_path, "wb") as img_f:
                                img_f.write(img_resp.content)
                    except Exception as e:
                        print(f"[HeroSync] Failed to download image for hero {hero_id}: {e}")
                
                heroes[hero_id] = {
                    "name": name,
                    "icon": local_icon if os.path.exists(local_icon_path) else "/static/heroes/default.png"
                }
            
            with open(data_target_file, "w", encoding="utf-8") as f:
                json.dump(heroes, f, indent=2)
    except Exception as e:
        print(f"[HeroSync] Fallback to cached heroes: {e}")
        
    return heroes

if __name__ == "__main__":
    import asyncio
    asyncio.run(sync_hero_roster())
