# Meowdy 5000 Workspace Guardrails & Rules

## 1. Profile Claiming & State Protection
- `claimed_profile` must lazily hydrate on startup from `localStorage.getItem('claimed_profile')` and `GET /api/profile/claimed`.
- The `👑 TRACKING ACTIVE` indicator in the dashboard UI is purely a status badge (`cursor-default`).
- Unclaiming a profile must require an explicit separate action button with a user confirmation prompt (`window.confirm`).

## 2. Web Anti-Caching Directives
- `frontend/index.html` must include standard anti-caching meta tags:
  - `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />`
  - `<meta http-equiv="Pragma" content="no-cache" />`
  - `<meta http-equiv="Expires" content="0" />`

## 3. Automated Verification Pipeline
- Before completing frontend or backend changes, run build verification (`npm run build` in `frontend/` and `python -m py_compile backend/app.py`).
- Validate Capacitor builds on the active emulator (`emulator-5554`) using ADB.

## 4. Emulator & ADB Constraints
- NEVER run emulator.exe, Start-Process emulator, or headless virtual device commands.
- The developer runs the emulator manually in a dedicated desktop window.
- Always detect the active device via db devices and target it explicitly using the -s <serial> flag.
