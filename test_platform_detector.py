import re

def extract_platform_from_rivalsdata(html: str) -> str:
    # 1. Match SVG filename directly from assets path
    match = re.search(r'/assets/platforms/([a-zA-Z0-9_-]+)\.svg', html, re.IGNORECASE)
    if match:
        val = match.group(1).lower()
        if any(k in val for k in ["playstation", "ps"]):
            return "playstation"
        if "xbox" in val:
            return "xbox"
        if any(k in val for k in ["pc", "steam", "windows"]):
            return "pc"
        return val

    # 2. Match alt attribute in the image element
    if 'alt="PlayStation"' in html:
        return "playstation"
    elif 'alt="Xbox"' in html:
        return "xbox"
    return "pc"

with open("tracker_recon/probes/rivals_data_dump.html", "r", encoding="utf-8") as f:
    html_content = f.read()

platform = extract_platform_from_rivalsdata(html_content)
print("=" * 60)
print(f"RIVALS DATA PLATFORM RESOLUTION: {platform.upper()}")
print("=" * 60)
