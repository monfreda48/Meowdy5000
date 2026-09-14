import re
import logging
from typing import Optional

logger = logging.getLogger("platform_detector")

def extract_platform_from_rivalsdata(html: str) -> str:
    """
    Inspects RivalsData HTML for platform SVGs, alt attributes, or asset paths.
    Returns canonical platform string: 'playstation', 'xbox', or 'pc'.
    """
    if not html or not isinstance(html, str):
        return "pc"

    # Regex match on platform SVG assets: /assets/platforms/([a-zA-Z0-9_-]+)\.svg
    match = re.search(r"/assets/platforms/([a-zA-Z0-9_-]+)\.svg", html, re.I)
    if match:
        platform_name = match.group(1).lower()
        if "playstation" in platform_name or "ps" in platform_name:
            return "playstation"
        if "xbox" in platform_name:
            return "xbox"
        if any(term in platform_name for term in ["pc", "steam", "windows"]):
            return "pc"

    # Fallback checking alt tags or text snippets
    html_lower = html.lower()
    if 'alt="playstation"' in html_lower or "playstation" in html_lower and "ps5" in html_lower:
        return "playstation"
    if 'alt="xbox"' in html_lower or "xbox" in html_lower:
        return "xbox"

    return "pc"

def get_platform_param(platform: str, provider: str) -> str:
    """
    Maps canonical platform string ('playstation', 'xbox', 'pc') to provider-specific query parameter.
    """
    plat = (platform or "pc").lower()
    prov = (provider or "").lower()

    if prov == "rivals_data":
        return "console" if plat in ["playstation", "xbox"] else "pc"
    elif prov == "rivals_tracker":
        return plat  # "playstation", "xbox", "pc"
    elif prov == "rivals_meta":
        if plat == "playstation":
            return "ps5"
        elif plat == "xbox":
            return "xbox"
        return "pc"

    return "pc"
