with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('inspect_fetch.txt', 'w', encoding='utf-8') as out:
    out.write("=== NORMALIZER & API PARSER (L2900-L2980) ===\n")
    for i in range(2900, min(len(lines), 2980)):
        out.write(f"L{i+1}: {lines[i]}")

    out.write("\n=== FETCH STATS FUNCTION ===\n")
    for i, l in enumerate(lines):
        if 'const fetchStats' in l or 'async function fetchStats' in l:
            for j in range(i, min(len(lines), i + 70)):
                out.write(f"L{j+1}: {lines[j]}")
            break
