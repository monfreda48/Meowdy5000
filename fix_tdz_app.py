import re

file_path = "frontend/src/App.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Locate export default
export_match = re.search(r'export\s+default\s+(?:function\s+App|App)', content)
if not export_match:
    print("[!] Could not find 'export default' in App.jsx")
    exit(1)

export_idx = export_match.start()

before_export = content[:export_idx]
after_export = content[export_idx:]

# Find the end of the App component (or where trailing constants begin)
# Match common trailing constant blocks
const_split = re.search(r'\n(?=(?:const|let|var)\s+(?:PULL_THRESHOLD|HERO_AVATAR_PRESETS|FALLBACK_IMAGE_SVG|METRIC_LABELS|THEMES|MARVEL_LOADING_QUOTES|HERO_MAP_CLIENT|DEFAULT_SEASON_NUM|TWELVE_HOURS_MS)\b)', after_export)

if const_split:
    app_component_code = after_export[:const_split.start()]
    trailing_constants = after_export[const_split.start():]
    
    # Find position after the last import statement in before_export
    last_import = list(re.finditer(r'^import\s+.*?;?\s*$', before_export, re.MULTILINE))
    if last_import:
        insert_pos = last_import[-1].end()
        new_content = (
            before_export[:insert_pos]
            + "\n\n// --- HOISTED CONSTANTS (TDZ FIX) ---\n"
            + trailing_constants.strip()
            + "\n// ------------------------------------\n\n"
            + before_export[insert_pos:]
            + app_component_code
        )
    else:
        new_content = trailing_constants.strip() + "\n\n" + before_export + app_component_code

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("[SUCCESS] Hoisted trailing constants to the top of frontend/src/App.jsx")
else:
    print("[-] No trailing constants matched the pattern. Checking structure...")
