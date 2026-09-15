import os
import re

file_path = "backend/adapters/rivalstracker.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Ensure stealth_fetcher import works regardless of execution directory
old_fetcher_import = "from backend.services.stealth_fetcher import fetch_profile_html"
safe_fetcher_import = """try:
    from backend.services.stealth_fetcher import fetch_profile_html
except ImportError:
    from services.stealth_fetcher import fetch_profile_html"""

if old_fetcher_import in content:
    content = content.replace(old_fetcher_import, safe_fetcher_import)

# 2. Append RivalsTrackerAdapter class if not already defined
adapter_class_code = '''

class RivalsTrackerAdapter:
    """Adapter bridging ingestion orchestration with RivalsTracker HTML parsers."""

    def __init__(self):
        pass

    async def scrape_player(self, identifier: str) -> Dict[str, Any]:
        """Scrapes player telemetry by UID or IGN and returns standardized payload."""
        try:
            data = await fetch_rivalstracker_profile(identifier)
            if data and isinstance(data, dict) and data.get("username"):
                return {"success": True, "data": data}
            return {"success": False, "data": {}, "error": "No profile data extracted"}
        except Exception as e:
            return {"success": False, "data": {}, "error": str(e)}

    async def scrape_tier_list(self) -> Dict[str, Any]:
        """Scrapes global tier list rankings from rivalstracker.com."""
        try:
            html = await fetch_profile_html("https://rivalstracker.com/tier-list")
            if not html:
                return {"success": False, "data": {"tier_list": []}}
            soup = BeautifulSoup(html, "html.parser")
            records = []
            for item in soup.select(".tier-item, .hero-row, tr[data-hero]"):
                text = item.get_text(strip=True)
                if text:
                    records.append({"hero": text, "source": "rivalstracker.com"})
            return {"success": True, "data": {"tier_list": records}}
        except Exception as e:
            return {"success": False, "data": {"tier_list": []}, "error": str(e)}
'''

if "class RivalsTrackerAdapter" not in content:
    content += adapter_class_code
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[SUCCESS] Appended RivalsTrackerAdapter class to backend/adapters/rivalstracker.py")
else:
    print("[-] RivalsTrackerAdapter class already exists.")
