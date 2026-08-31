@echo off
cd /d "%~dp0frontend\android"
call gradlew.bat %*
set BUILD_STATUS=%ERRORLEVEL%

if %BUILD_STATUS%==0 (
    if exist "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" (
        copy /y "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0app-debug.apk" >nul
    )
)

exit /b %BUILD_STATUS%
