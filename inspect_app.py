with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("=== 1. SEARCHED UID & CLAIMED UID USAGE ===")
for i, line in enumerate(lines):
    if any(k in line for k in ['searchedUid', 'm5_claimed_uid', 'handleClaimProfile']):
        print(f"L{i+1}: {line.rstrip()}")

print("\n=== 2. STATS FETCH & SET STATE ===")
for i, line in enumerate(lines):
    if '/api/player/' in line or 'setStats(' in line:
        start = max(0, i - 2)
        end = min(len(lines), i + 8)
        for j in range(start, end):
            print(f"L{j+1}: {lines[j].rstrip()}")
        print("-" * 40)

print("\n=== 3. OVERVIEW CARDS (CURRENT RANK, WIN RATE, KDA) ===")
for i, line in enumerate(lines):
    if any(k in line for k in ['Current Rank', 'CURRENT RANK', 'WIN RATE', 'KDA RATIO']):
        start = max(0, i - 2)
        end = min(len(lines), i + 6)
        for j in range(start, end):
            print(f"L{j+1}: {lines[j].rstrip()}")
        print("-" * 40)
