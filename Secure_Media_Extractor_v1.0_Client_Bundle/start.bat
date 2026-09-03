@echo off
title Secure Excel Media Extractor Launcher

echo ================================================================
echo           SECURE EXCEL MEDIA EXTRACTOR (LOCAL EDITION)
echo ================================================================
echo.

if exist "%~dp0Secure_Excel_Media_Extractor.exe" (
    echo [INFO] Launching standalone desktop application...
    echo [INFO] 100%% Local & Private. Zero server upload.
    start "" "%~dp0Secure_Excel_Media_Extractor.exe"
    exit /b 0
)

where node >nul 2>nul
if %errorlevel% eq 0 (
    echo [INFO] Starting local application server at http://localhost:3000 ...
    node "%~dp0server.js"
    exit /b 0
)

echo [INFO] Opening local standalone application build...
start "" "%~dp0dist\index.html"
