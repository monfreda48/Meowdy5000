with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('debug_core.txt', 'w', encoding='utf-8') as out:
    out.write("=== A. AUTO-LOAD ON STARTUP (useEffect around L310-L450) ===\n")
    for i, l in enumerate(lines):
        if 'autoLoadHomeProfile' in l or 'm5_claimed_uid' in l or 'claimed_profile' in l:
            start = max(0, i - 3)
            end = min(len(lines), i + 15)
            out.write(f"--- Triggered at L{i+1}: {l.strip()} ---\n")
            for j in range(start, end):
                out.write(f"L{j+1}: {lines[j]}")
            out.write("\n" + "="*40 + "\n")

    out.write("\n=== B. OVERVIEW 5 CARDS (CURRENT RANK, WIN RATE, KDA, DAMAGE, HEALING) ===\n")
    for i, l in enumerate(lines):
        if 'CURRENT RANK' in l or 'Canonical 10m Rate' in l or 'Combat Efficiency' in l:
            start = max(0, i - 5)
            end = min(len(lines), i + 25)
            out.write(f"--- Cards at L{i+1} ---\n")
            for j in range(start, end):
                out.write(f"L{j+1}: {lines[j]}")
            out.write("\n" + "="*40 + "\n")

    out.write("\n=== C. NORMALIZER INPUT (Lines 2820-2900) ===\n")
    for i in range(2820, min(len(lines), 2900)):
        out.write(f"L{i+1}: {lines[i]}")
