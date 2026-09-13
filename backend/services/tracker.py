from typing import Dict, Any, Optional
from datetime import datetime, timedelta

def should_refresh_profile(last_scraped_at: Optional[str], interval_hours: int = 12) -> bool:
    """
    Checks if last_scraped_at timestamp exceeds interval_hours throttling threshold.
    """
    if not last_scraped_at:
        return True
    try:
        clean_ts = str(last_scraped_at).replace('Z', '+00:00')
        last_scrape = datetime.fromisoformat(clean_ts)
        now = datetime.now(last_scrape.tzinfo)
        return (now - last_scrape) >= timedelta(hours=interval_hours)
    except Exception:
        return True

def normalize_private_profile_response(
    player_uid: Optional[str] = "",
    username: Optional[str] = "",
    message: str = "Player profile is set to Private in Marvel Rivals game client."
) -> Dict[str, Any]:
    """
    Returns a standardized dictionary representation for NetEase private profile responses.
    """
    clean_uid = str(player_uid or "").strip()
    clean_user = str(username or clean_uid or "Unknown").strip()

    return {
        "player_uid": clean_uid,
        "username": clean_user,
        "is_private": True,
        "error_code": "PROFILE_PRIVATE",
        "message": message,
        "stats": None,
        "matches": [],
        "rank": "Private Profile",
        "winRate": "0.0%",
        "matchesPlayed": 0,
        "kdRatio": "0.00"
    }

def is_private_profile_data(data: Dict[str, Any]) -> bool:
    """
    Detects if a raw parsed profile response indicates a NetEase private profile.
    """
    if not isinstance(data, dict):
        return False
        
    if data.get("is_private") is True or data.get("error_code") == "PROFILE_PRIVATE":
        return True
        
    # NetEase returns valid profile metadata but empty stats / histories
    has_meta = bool(data.get("username") or data.get("uid") or data.get("player_uid"))
    matches_empty = data.get("matches") == [] or data.get("matches") is None
    stats_empty = (
        data.get("stats") is None or 
        (isinstance(data.get("stats"), dict) and len(data.get("stats")) == 0)
    )
    is_explicit_private_flag = data.get("privacy") in ["private", "friends_only", 1, 2]

    return has_meta and (matches_empty and stats_empty) and is_explicit_private_flag
