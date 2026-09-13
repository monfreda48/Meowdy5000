import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.identity import IdentityManager

async def run_suite():
    IdentityManager.init_db()
    print("=== RUNNING BIDIRECTIONAL IDENTITY TESTS ===")

    # Test 1: Username -> Numeric UID (Forward)
    print("\n[TEST 1] Testing Forward Resolution ('Meowdy 5000' -> UID)...")
    fwd = await IdentityManager.resolve_identity("Meowdy 5000")
    print("  Result:", fwd)
    assert fwd["uid"] == "70463344", f"Expected UID 70463344, got {fwd['uid']}"
    assert fwd["username"].lower() == "meowdy 5000", f"Expected username 'Meowdy 5000', got {fwd['username']}"
    print("  [PASS] Forward resolution verified.")

    # Test 2: Numeric UID -> Username (Reverse)
    print("\n[TEST 2] Testing Reverse Resolution ('70463344' -> Username)...")
    rev = await IdentityManager.resolve_identity("70463344")
    print("  Result:", rev)
    assert rev["uid"] == "70463344", f"Expected UID 70463344, got {rev['uid']}"
    assert "meowdy" in rev["username"].lower(), f"Expected 'Meowdy' in username, got {rev['username']}"
    print("  [PASS] Reverse resolution verified.")

    print("\n=== ALL BIDIRECTIONAL IDENTITY ASSERTIONS PASSED ===")

if __name__ == "__main__":
    asyncio.run(run_suite())
