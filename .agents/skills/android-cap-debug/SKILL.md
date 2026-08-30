---
name: android-cap-debug
description: Capacitor Android APK build, ADB logcat debugging, and scoped storage verification workflow
---

# Android Capacitor Debugging & APK Maintenance Skill

Use this skill when building, syncing, or testing Capacitor Android APK builds.

## Key Build Commands
1. Build Vite web bundle & sync Capacitor assets:
   ```bash
   cd frontend
   npm run build
   npx cap sync android
   ```
2. Build Android debug APK:
   ```bash
   cd frontend/android
   ./gradlew assembleDebug
   ```

## Native Android Permissions & Storage
- `Directory.Documents` / `Directory.Cache` are used via `@capacitor/filesystem`.
- AndroidManifest path: `frontend/android/app/src/main/AndroidManifest.xml`.
