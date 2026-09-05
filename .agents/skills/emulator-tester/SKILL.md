---
name: emulator-tester
description: Automated post-fix feature & search function verification workflow on live Android emulator via ADB
---

# Emulator Feature & Search Verification Sub-Agent Skill

Use this skill when spawning or operating a **Verification Sub-Agent** to validate fixes, UI layouts, and search functionality on the active Android Studio emulator.

---

## 1. Pre-Flight Verification Environment

1. **Target Device**: Ensure `emulator-5554` (or active booted emulator) is detected via `adb devices`.
2. **Backend Server**: Ensure Python Uvicorn server is active on `http://0.0.0.0:8000` (`python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000`).
3. **App Build & Launch**:
   ```bash
   cd frontend/android
   .\gradlew.bat installDebug
   adb shell am start -n com.meowdy5000.stattracker/.MainActivity
   ```

---

## 2. Automated Testing Suite

Execute the following test steps systematically:

### Test 1: Initial Profile & Cache Validation
- Wait 3 seconds post-launch.
- Capture screen: `adb exec-out screencap -p > scratch/test_step1_launch.png`.
- Confirm initial lookup loads cleanly without rendering `⚠️ Profile Unavailable` banner.

### Test 2: Primary Player Search (`Meowdy 5000`)
- Trigger search for target user `Meowdy 5000`:
  ```bash
  # Tap search text field, input username, and submit
  adb shell input keyevent 66  # Enter key
  ```
- Capture screen: `adb exec-out screencap -p > scratch/test_step2_meowdy.png`.
- Verify presence of 6 card sections:
  1. Season Banner ("Season 9.5")
  2. Competitive Rank & Skill Rating ("Grandmaster III", "4120 SR")
  3. Combat Overview (Win Rate 64.5%, KDA 3.42)
  4. Per 10-Minute Rates (Damage/10m 14850, Healing/10m 9200)
  5. Lifetime Totals & Combat Records
  6. Hero Performance Breakdown (Magneto, Hela, Luna Snow, Venom)

### Test 3: Alternative Player Search (`HelaMain99`)
- Clear search bar and type new username.
- Submit search and wait 3 seconds.
- Capture screen: `adb exec-out screencap -p > scratch/test_step3_alt_player.png`.
- Verify dynamic procedural profile generation works smoothly without `Player Not Found` alert.

### Test 4: UI Features & Navigation Drawer
- Open Right-Anchored Navigation Drawer (tap top-right hamburger icon).
- Verify Kinetic Purple theme active.
- Verify settings items ("Check for Updates", "Report Issue", "Donate").

### Test 5: Logcat Diagnostics & Error Trapping
- Dump runtime exceptions:
  ```bash
  adb logcat -d -s AndroidRuntime:E DashboardSearch:* System.err:*
  ```
- Ensure zero fatal crashes or uncaught exceptions.

---

## 3. Reporting Requirements

The sub-agent must generate a concise pass/fail summary report containing:
- [x] APK build & install status
- [x] Backend connectivity status (`0.0.0.0:8000`)
- [x] Primary search verification (`Meowdy 5000`)
- [x] Secondary player search verification
- [x] Zero Logcat `AndroidRuntime` crashes
- Embedded screenshot file paths for visual proof.
