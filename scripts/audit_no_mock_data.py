import os
import sys
import re

BANNED_PATTERNS = [
    (r"SEASONS_LIST\s*=", "Hardcoded seasons list"),
    (r"mock_player|dummy_stats|test_user", "Mock/dummy user data"),
    (r"\"status\":\s*\"(upcoming|current|past)\"", "Hardcoded season status dictionary"),
]

EXCLUDED_DIRS = {".git", "node_modules", "dist", ".venv", "__pycache__"}

def audit_codebase():
    violations = []
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            if file.endswith((".py", ".js", ".jsx", ".ts", ".tsx")):
                filepath = os.path.join(root, file)
                if "audit_no_mock_data.py" in filepath:
                    continue
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    for pattern, description in BANNED_PATTERNS:
                        if re.search(pattern, content):
                            violations.append(f"[{description}] in {filepath}")
    
    if violations:
        print("\n[FAIL] HARDCODED DATA AUDIT FAILED:")
        for v in violations:
            print(f"  - {v}")
        sys.exit(1)
    else:
        print("\n[PASS] ZERO HARDCODED MOCK DATA DETECTED.")
        sys.exit(0)

if __name__ == "__main__":
    audit_codebase()
