import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.identity import IdentityManager
from backend.database import get_connection

def list_all():
    IdentityManager.init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT id, username, uid, platform, updated_at FROM identity_cache ORDER BY id DESC").fetchall()
        print("\n=== MARVEL RIVALS IDENTITY REGISTRY ===")
        print(f"{'ID':<4} | {'Username':<25} | {'UID':<12} | {'Platform':<8} | {'Updated'}")
        print("-" * 75)
        for r in rows:
            print(f"{r[0]:<4} | {r[1]:<25} | {r[2]:<12} | {r[3]:<8} | {r[4]}")
        print("=" * 75)

if __name__ == "__main__":
    IdentityManager.init_db()
    args = sys.argv[1:]

    if not args or args[0] in ["--list", "-l"]:
        list_all()
    elif len(args) == 2:
        IdentityManager.link_identity(args[0], args[1])
        list_all()
    elif len(args) == 1:
        res = asyncio.run(IdentityManager.resolve_identity(args[0]))
        print("\nResolved Identity Result:")
        print(res)
