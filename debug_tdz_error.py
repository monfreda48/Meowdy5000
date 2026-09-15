import os
import re

src_dir = "frontend/src"
print("=" * 70)
print("SCANNING FRONTEND FOR CIRCULAR IMPORTS & TDZ PATTERNS")
print("=" * 70)

# 1. Check recently modified files
files = []
for root, _, filenames in os.walk(src_dir):
    for f in filenames:
        if f.endswith(('.jsx', '.js', '.tsx', '.ts')):
            path = os.path.join(root, f)
            files.append((path, os.path.getmtime(path)))

files.sort(key=lambda x: x[1], reverse=True)
print("Recently modified files:")
for path, _ in files[:6]:
    print(f"  * {path}")

# 2. Check for const components declared below export default
print("\nScanning for components declared AFTER export default:")
for path, _ in files[:8]:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    export_pos = content.find("export default")
    if export_pos != -1:
        after_export = content[export_pos:]
        late_consts = re.findall(r'const\s+([A-Z][a-zA-Z0-9_]*)\s*=', after_export)
        if late_consts:
            print(f"  [!] Potential TDZ in {path}: {late_consts} declared after export default")

# 3. Check for circular imports between components
print("\nScanning import relationships:")
import_map = {}
for path, _ in files:
    norm_path = os.path.basename(path).split('.')[0]
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        imports = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', f.read())
    import_map[norm_path] = [os.path.basename(i).split('.')[0] for i in imports]

for mod, deps in import_map.items():
    for dep in deps:
        if dep in import_map and mod in import_map[dep]:
            print(f"  [!] Circular Dependency Detected: {mod} <--> {dep}")

print("=" * 70)
