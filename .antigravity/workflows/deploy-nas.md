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
   - Verify `backend/main.py` serves `index.html` with explicit no-cache headers:
     `Cache-Control: no-cache, no-store, must-revalidate`
     `Pragma: no-cache`
     `Expires: 0`

## Container Deployment to Synology NAS (`mynas`)
To deploy updated frontend assets and backend code to the `marvel-rivals-backend` Docker container:

```cmd
:: 1. Deploy clean frontend dist assets
cmd /c "tar -czf - -C frontend/dist . | ssh mynas ""mkdir -p /tmp/dist && tar -xzf - -C /tmp/dist && sudo /var/packages/ContainerManager/target/usr/bin/docker exec marvel-rivals-backend rm -rf /app/dist && sudo /var/packages/ContainerManager/target/usr/bin/docker cp /tmp/dist marvel-rivals-backend:/app/dist && rm -rf /tmp/dist"""

:: 2. Deploy updated backend code
cmd /c "tar -czf - -C backend . | ssh mynas ""mkdir -p /tmp/backend && tar -xzf - -C /tmp/backend && sudo /var/packages/ContainerManager/target/usr/bin/docker cp /tmp/backend/. marvel-rivals-backend:/app/backend/ && rm -rf /tmp/backend"""

:: 3. Restart container to reload uvicorn
ssh mynas "sudo /var/packages/ContainerManager/target/usr/bin/docker restart marvel-rivals-backend"
```
