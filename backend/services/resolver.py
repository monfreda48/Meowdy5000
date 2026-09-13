import re
import logging
from typing import Dict, Any, List, Optional
from backend.adapters.rivalsdata import resolve_player_identity, normalize_platform_code

logger = logging.getLogger("player_resolver")

def normalize_platform(platform_input: Optional[str]) -> str:
    return normalize_platform_code(platform_input)

async def resolve_player_query(query: str) -> Dict[str, Any]:
    clean_query = query.strip()
    if not clean_query:
        return {
            "query": "",
            "requires_disambiguation": False,
            "candidates": []
        }

    candidates = await resolve_player_identity(clean_query)

    distinct_platforms = {c.get("platform", "pc") for c in candidates}
    distinct_uids = {c.get("uid") for c in candidates if c.get("uid")}
    requires_disambiguation = len(candidates) > 1 or len(distinct_platforms) > 1 or len(distinct_uids) > 1

    return {
        "query": clean_query,
        "requires_disambiguation": requires_disambiguation,
        "candidates": candidates
    }
