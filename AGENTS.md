# AGENTS.md - Autonomous Developer Guidelines & Safeguards

This file defines authoritative guidelines, command whitelists, protected assets, verification protocols, and error recovery loops for autonomous agent sessions working on **Meowdy 5000 Rivals Tracker**.

---

## 1. Project Architecture Overview

Meowdy 5000 Rivals Tracker is a multi-platform Marvel Rivals statistics tracker and telemetry monitoring application comprising:

- **Frontend (`frontend/`)**: React 19 + Vite + TailwindCSS 4 web app packaged for mobile using Capacitor 7 (`@capacitor/android`).
- **Backend (`backend/`)**: Python Flask / SQLite telemetry and stats aggregation server (`backend/app.py`).
- **Android Native Shell (`frontend/android/`)**: Capacitor Android project compiled via Gradle (`gradlew.bat`).
- **Database & Telemetry**: SQLite database (`backend/stats.db`) and error tracking log (`backend/processed_errors.json`).

---

## 2. Whitelisted Development Commands

Always execute commands within their respective working directories.

### Frontend (`frontend/`)
```bash
# Build production Vite bundle
npm run build

# Lint frontend codebase
npm run lint

# Sync Capacitor native Android assets
npm run sync

# Full Android APK compilation (Requires Android SDK)
npm run build:android
```

### Backend (`backend/`)
```bash
# Verify backend Python syntax
python -m py_compile backend/app.py

# Run error listener telemetry daemon
python backend/auto_error_listener.py
```

### Versioning & Utility Scripts (`scripts/`, `scratch/`)
```bash
# Auto-bump version numbers across package.json, gradle, and app files
python scripts/bump_version.py
```

---

## 3. Protected Files & Protected Assets

The following project files, databases, and local configurations contain persistent state, credentials, or build settings. **NEVER modify, delete, truncate, or overwrite these files without explicit user instruction:**

### Protected Databases & Telemetry
- `backend/stats.db` & `stats.db` — Live SQLite database storing historical lookup snapshots and telemetry reports.
- `backend/processed_errors.json` — Persistent tracking state for handled issue reports.
- `backend/error_reports.log` — Raw unhandled error log history.

### Protected Native Build Configurations
- `local.properties` — Android SDK location and local system properties.
- `frontend/android/gradle.properties` — Gradle JVM arguments and build parameters.
- `frontend/android/app/build.gradle` — Android application ID, version codes, and SDK versions.
- `capacitor.config.json` & `frontend/capacitor.config.json` — Capacitor plugin and app bindings.

### Protected System Configurations
- `.agents/` — Custom skills (`android-cap-debug`, `rivals-telemetry`), hooks, and agent rules.
- `.vscode/` — Workspace editor configurations and environment settings.

---

## 4. Automated Mandatory Verification Protocol

Before declaring any coding or bug-fix task complete, you **MUST** run the following verification steps:

1. **Frontend Compilation Verification**:
   - Run `npm run build` inside `frontend/`.
   - Ensure the build exits with `code 0` and zero Vite/JSX syntax errors.
2. **Backend Syntax Verification** (if Python backend files were touched):
   - Run `python -m py_compile backend/app.py`.
   - Ensure zero Python syntax errors.
3. **Working Tree Cleanliness**:
   - Run `git status` to ensure no temporary test artifacts or scratch files are untracked outside `scratch/`.

---

## 5. Autonomous 3-Strike Error-Recovery Loop

When a build, lint, or verification command fails during an autonomous session, follow this 3-strike recovery protocol before reporting back to the user:

```
                  ┌───────────────────────────────┐
                  │   Command Error Encountered   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │ Strike 1: Fetch & Inspect   │
                   │ Full Un-truncated Error Log │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │ Apply Targeted Code Fix  │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────┴────────────┐
                    │ Re-run Build Verification│
                    └─────────────┬────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │ Passed? ──► [ DONE ]          │
                  │ Failed?                       │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │ Strike 2: Perform Deep Code │
                   │ Audit & Structural Fix      │
                   └──────────────┬──────────────┘
                                  │
                    ┌─────────────┴────────────┐
                    │ Re-run Build Verification│
                    └─────────────┬────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │ Passed? ──► [ DONE ]          │
                  │ Failed?                       │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │ Strike 3: Revert Changes    │
                   │ & Synthesize Error Report   │
                   └─────────────────────────────┘
```

- **Strike 1 — Diagnostic Inspection & Targeted Fix**:
  - Fetch and inspect the full, un-truncated error log output.
  - Identify the exact filename, line number, and error type (e.g. syntax error, unresolved import, undefined variable).
  - Apply a minimal, targeted fix to the affected file.
  - Re-run `npm run build` or verification command.

- **Strike 2 — Deep Code Search & Structural Fix**:
  - If Strike 1 fails, perform a deep search (`grep_search` / `view_file`) across related imports, component props, and caller sites.
  - Identify structural mismatches or missing dependencies.
  - Apply the corrected structural change.
  - Re-run verification command.

- **Strike 3 — Safety Reversion & User Report**:
  - If Strike 2 fails, run `git checkout -- <file>` to revert broken modifications.
  - Stop further automated edits to avoid cascading regressions.
  - Present a concise, detailed diagnostic report to the user summarizing the exact error log and recommended manual intervention.

---

## 6. Code Style & Safety Guidelines

- **Preserve Existing Comments**: Retain docstrings, inline comments, and copyright headers unless specifically asked to update them.
- **Strict Control Flow Scoping**: Avoid mutating global arrays or window state directly; isolate state changes to React hooks or explicit setters.
- **Log Inspection Before Diagnosis**: Always read log files before forming diagnostic hypotheses. Never guess API contracts or variable names.

---

## Mandatory Android Emulator Directives & Verification Loop

Do not consider any frontend or backend task complete without running and validating on the active emulator. Follow this strict execution loop:

### 1. Device Handshake Check
Before building, confirm ADB connectivity:
```bash
adb devices
```
If no device is detected or listed as offline:
1. Run `adb kill-server && adb start-server`
2. If still missing, launch the default AVD:
   `emulator -avd $(emulator -list-avds | Select-Object -First 1) -no-snapshot-load &`
3. Wait until booted: `adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'`

### 2. Mandatory Build, Deploy & Launch Loop
Every time code is modified in `frontend/android/` or `backend/`:
1. Compile and install without hanging the terminal:
   ```powershell
   cd frontend/android
   .\gradlew.bat installDebug --no-daemon
   ```
2. Launch the main activity:
   ```bash
   adb shell am start -n com.meowdy5000.stattracker/.MainActivity
   ```
3. Wait 3 seconds for UI rendering:
   ```cmd
   timeout /t 3 /nobreak > nul
   ```

### 3. Automated UI Inspection & Verification
After launching:
1. Trigger the search for "Meowdy 5000":
   ```bash
   adb shell input keyevent 84
   adb shell input text "Meowdy%s5000"
   adb shell input keyevent 66
   ```
2. Wait 6 seconds for network data:
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

### 4. Definition of Done
Report your final status ONLY after you have:
- Pulled and visually inspected `screen_verify.png`.
- Verified that the relevant cards on `ui_verify.xml` are populated.
- Confirmed no `AndroidRuntime` crashes exist in `adb logcat -d`.

---

## Autonomous Troubleshooting & Sub-Agent Protocol

You are operating under full autonomous test, debug, and sub-agent delegation authority for this repository. Whenever a task, build, or test fails, do not halt to ask for manual user intervention. Self-diagnose, isolate regressions, and dispatch tasks to specialized sub-agents to fix issues.

### 1. Autonomous Self-Testing & Troubleshooting Loop

1. **Active Target**: 
   - Execute all builds and runtime tests against the active Android Studio emulator on screen via ADB (`.\gradlew.bat installDebug --no-daemon` and `adb shell am start -n com.meowdy5000.stattracker/.MainActivity`).

2. **Automated Error Trapping**:
   - If a build fails or an `AndroidRuntime` crash occurs on the emulator:
     - Immediately dump the stack trace using `adb logcat -d -s AndroidRuntime:E <app_tag>:*`.
     - Analyze the fatal exception, missing resource, or lifecycle regression.
     - Attempt up to **3 automated repair cycles** before surfacing any blockers to the user.

### 2. Sub-Agent Orchestration Directives

When dealing with multi-faceted bugs or feature builds, split and delegate responsibilities to sub-agents:

- **Diagnostics Sub-Agent**: Task with parsing Logcat crashes, reading stack traces, and locating offending file lines or lifecycle hooks.
- **Implementation Sub-Agent**: Task with refactoring Kotlin classes, updating XML resources, or correcting Gradle dependencies based on diagnostic findings.
- **Verification Sub-Agent (`emulator-tester` skill)**: Automatically dispatches after every fix to execute the mandatory 4-step verification loop (ADB device handshake, compile & install, UI dump/screenshot, Logcat verification).

### 3. Operating Contract

- You have full authority to execute whitelisted Gradle and ADB commands without waiting for user confirmation.
- Only stop and prompt the user if:
  1. All 3 repair loops fail to resolve the issue.
  2. You encounter an unresolvable dependency conflict that requires architectural decision-making.
  3. A critical security or signing secret is missing.



