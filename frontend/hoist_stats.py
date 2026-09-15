import os
import re

file_path = "src/App.jsx" if os.path.exists("src/App.jsx") else "frontend/src/App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Locate the claimedProfile assignment
claimed_match = re.search(r'^\s*const\s+claimedProfile\s*=', content, re.MULTILINE)
if not claimed_match:
    print("[!] Could not find 'const claimedProfile =' in App.jsx")
    exit(1)

claimed_pos = claimed_match.start()

# 2. Locate the stats declaration (useState or useRef)
# Matches: const [stats, setStats] = ... or const stats = useRef(...)
stats_match = re.search(r'^\s*(?:const|let|var)\s+(?:\[\s*stats\s*,\s*setStats\s*\]|stats)\s*=\s*', content, re.MULTILINE)
if not stats_match:
    print("[!] Could not find declaration of 'stats' in App.jsx")
    exit(1)

stats_start = stats_match.start()

# Find the end of the statement by matching semicolons while tracking brackets
depth_paren = 0
depth_brace = 0
depth_bracket = 0
stats_end = -1

for idx in range(stats_start, len(content)):
    ch = content[idx]
    if ch == '(': depth_paren += 1
    elif ch == ')': depth_paren -= 1
    elif ch == '{': depth_brace += 1
    elif ch == '}': depth_brace -= 1
    elif ch == '[': depth_bracket += 1
    elif ch == ']': depth_bracket -= 1
    elif ch == ';' and depth_paren == 0 and depth_brace == 0 and depth_bracket == 0:
        stats_end = idx + 1
        break

if stats_end == -1:
    print("[!] Could not parse end of stats declaration statement")
    exit(1)

stats_stmt = content[stats_start:stats_end].strip()
print(f"Found stats declaration:\n  {stats_stmt}")

if stats_start < claimed_pos:
    print("[-] 'stats' is already declared before 'claimedProfile'.")
else:
    # Remove stats from lower position
    content_clean = content[:stats_start] + content[stats_end:]
    
    # Re-calculate claimed_pos in the trimmed content
    new_claimed_match = re.search(r'^\s*const\s+claimedProfile\s*=', content_clean, re.MULTILINE)
    insert_pos = new_claimed_match.start()
    
    # Insert stats right before claimedProfile
    fixed_content = (
        content_clean[:insert_pos]
        + f"  // --- Hoisted to resolve TDZ ReferenceError ---\n  {stats_stmt}\n\n"
        + content_clean[insert_pos:]
    )
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(fixed_content)
    
    print(f"[SUCCESS] Hoisted '{stats_stmt[:40]}...' directly above 'claimedProfile'.")
