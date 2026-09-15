import os
import re

file_path = "backend/app.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Ensure sys.path includes both the project root and backend directory
sys_path_shim = """import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
"""

if "sys.path.insert" not in content:
    content = sys_path_shim + content
    print("[+] Injected root sys.path shim into backend/app.py")

# 2. Patch the season import to use a dual-lookup fallback
old_import = "from backend.adapters.rivalsmeta import fetch_rivalsmeta_season"
new_import = """try:
            from backend.adapters.rivalsmeta import fetch_rivalsmeta_season
        except ImportError:
            from adapters.rivalsmeta import fetch_rivalsmeta_season"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("[+] Patched fetch_rivalsmeta_season import with dual fallback")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] backend/app.py patched.")
