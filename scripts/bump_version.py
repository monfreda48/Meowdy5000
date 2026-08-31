import json
import re

pkg_path = "c:/Users/User/Desktop/RivalsTracker/frontend/package.json"
gradle_path = "c:/Users/User/Desktop/RivalsTracker/frontend/android/app/build.gradle"
app_jsx_path = "c:/Users/User/Desktop/RivalsTracker/frontend/src/App.jsx"

def bump_version():
    # 1. Read package.json
    with open(pkg_path, "r", encoding="utf-8") as f:
        pkg = json.load(f)

    current_ver = pkg.get("version", "1.0.4")
    parts = [int(x) for x in current_ver.split(".")]
    parts[-1] += 1
    new_ver = f"{parts[0]}.{parts[1]}.{parts[2]}"
    pkg["version"] = new_ver

    with open(pkg_path, "w", encoding="utf-8") as f:
        json.dump(pkg, f, indent=2)
    print(f"[VERSION BUMP] package.json version: {current_ver} -> {new_ver}")

    # 2. Read build.gradle
    with open(gradle_path, "r", encoding="utf-8") as f:
        gradle_content = f.read()

    # match versionCode
    vc_match = re.search(r'versionCode\s+(\d+)', gradle_content)
    if vc_match:
        old_vc = int(vc_match.group(1))
        new_vc = old_vc + 1
        gradle_content = re.sub(r'versionCode\s+\d+', f'versionCode {new_vc}', gradle_content)
        print(f"[VERSION BUMP] build.gradle versionCode: {old_vc} -> {new_vc}")

    gradle_content = re.sub(r'versionName\s+"[^"]+"', f'versionName "{new_ver}"', gradle_content)
    with open(gradle_path, "w", encoding="utf-8") as f:
        f.write(gradle_content)
    print(f"[VERSION BUMP] build.gradle versionName -> {new_ver}")

    # 3. Update App.jsx default version constant
    with open(app_jsx_path, "r", encoding="utf-8") as f:
        jsx_content = f.read()

    jsx_content = re.sub(r'1\.0\.\d+', new_ver, jsx_content)
    with open(app_jsx_path, "w", encoding="utf-8") as f:
        f.write(jsx_content)
    print(f"[VERSION BUMP] App.jsx version strings updated to v{new_ver}")

    return new_ver

if __name__ == "__main__":
    bump_version()
