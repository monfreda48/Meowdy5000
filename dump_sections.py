with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('inspect_clean.txt', 'w', encoding='utf-8') as out:
    out.write("=== 1. FETCH & MERGE STATS (L700-L770) ===\n")
    for i in range(max(0, 695), min(len(lines), 770)):
        out.write(f"L{i+1}: {lines[i]}")
    
    out.write("\n=== 2. INITIAL MOUNT / AUTO-LOAD (L235-L310) ===\n")
    for i in range(max(0, 235), min(len(lines), 310)):
        out.write(f"L{i+1}: {lines[i]}")

    out.write("\n=== 3. OVERVIEW CARDS (L3840-L3920) ===\n")
    for i in range(max(0, 3840), min(len(lines), 3920)):
        out.write(f"L{i+1}: {lines[i]}")
