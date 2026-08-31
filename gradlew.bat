@echo off
cd /d "%~dp0frontend\android"
call gradlew.bat %*
