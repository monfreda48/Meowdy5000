with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines in App.jsx: {len(lines)}")
for idx, line in enumerate(lines):
    if "export default" in line:
        print(f"Line {idx+1}: {line.strip()}")

print("\n--- Last 35 lines of App.jsx ---")
for idx, line in enumerate(lines[-35:], start=max(1, len(lines)-34)):
    print(f"{idx}: {line.rstrip()}")
