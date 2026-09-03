@echo off
title Secure Excel Media Extractor (Local Desktop Edition)

echo ================================================================
echo           SECURE EXCEL MEDIA EXTRACTOR (DESKTOP EDITION)
echo ================================================================
echo.
echo [INFO] High-speed batch processing engine for 90+ Excel workbooks (2,800+ lines each).
echo [INFO] 100%% Local & Confidential. Zero server upload.
echo.

if exist "%~dp0Secure_Excel_Media_Extractor.exe" (
    echo [INFO] Launching native standalone Windows executable...
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
