# Deployment Pipeline Workflow: NAS & Web Deployment

## Environment & Build Requirements
1. **Frontend Production Compilation**:
   - Run `npm run build` inside `frontend/`.
   - Output dist assets to `frontend/dist/`.

2. **Capacitor Mobile Sync**:
   - Run `npx cap sync android` inside `frontend/`.

3. **Android Debug & Production Assemblies**:
   - Execute `.\gradlew.bat assembleDebug` inside `frontend/android/`.
   - Output path: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

4. **Web Proxy & Anti-Caching Verification**:
   - Verify image proxy route `/api/image-proxy` handles avatar sanitization.
   - Verify `index.html` headers prevent stale cache pinning.
