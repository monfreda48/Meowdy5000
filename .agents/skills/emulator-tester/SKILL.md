---
name: emulator-tester
description: Automated post-fix feature & search function verification workflow on live Android emulator via ADB
---

# Emulator Feature & Search Verification Sub-Agent Skill

Use this skill when performing mandatory Android emulator testing and ADB verification for all tasks (frontend and backend).

---

## 1. Device Handshake Check

Before building, confirm ADB connectivity:
```bash
adb devices
```
If no device is detected or listed as offline:
1. Restart ADB server:
   ```bash
   adb kill-server && adb start-server
   ```
2. If still missing, launch the default AVD:
   ```powershell
   emulator -avd (emulator -list-avds | Select-Object -First 1) -no-snapshot-load
   ```
3. Wait until booted:
   ```bash
   adb wait-for-device shell "while [ -z \$(getprop sys.boot_completed) ]; do sleep 1; done"
   ```

---

## 2. Mandatory Build, Deploy & Launch Loop

Every time code is modified in `app/` (or `frontend/android/`) or `backend/`:

1. Compile and install without hanging the terminal:
   ```powershell
   cd frontend/android
   .\gradlew.bat installDebug --no-daemon
   ```
2. Launch the main dashboard activity:
   ```bash
   adb shell am start -n com.meowdy5000.stattracker/.MainActivity
   ```
3. Wait 3 seconds for UI rendering:
   ```cmd
   timeout /t 3 /nobreak > nul
   ```

---

## 3. Automated UI Inspection & Verification

After launching:

1. Trigger the search for "Meowdy 5000":
   ```bash
   adb shell input keyevent 84
   adb shell input text "Meowdy%s5000"
   adb shell input keyevent 66
   ```
2. Wait 6 seconds for network data response:
   ```cmd
   timeout /t 6 /nobreak > nul
   ```
3. Capture the emulator screen and pull it locally:
   ```bash
   adb shell screencap -p /sdcard/screen_verify.png
   adb pull /sdcard/screen_verify.png ./screen_verify.png
   ```
4. Dump the UI hierarchy to inspect the rendered text:
   ```bash
   adb shell uiautomator dump /sdcard/ui_verify.xml
   adb pull /sdcard/ui_verify.xml ./ui_verify.xml
   ```

---

## 4. Definition of Done

Report your final status ONLY after you have:
1. Pulled and visually inspected `screen_verify.png`.
2. Verified that the relevant cards on `ui_verify.xml` are populated.
3. Confirmed no `AndroidRuntime` crashes exist in `adb logcat -d -s AndroidRuntime:E`.
