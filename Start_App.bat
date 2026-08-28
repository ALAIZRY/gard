@echo off
title تطبيق إدارة وجرد الأصناف - صيدلية راما
cls
echo =================================================================
echo        تطبيق إدارة وجرد الأصناف - يعمل بدون إنترنت (Offline)
echo =================================================================
echo.

:: Check if node_modules exists, if not install dependencies
if not exist "node_modules\" (
    echo [1/2] جاري تثبيت المكونات الأساسية للمرة الأولى...
    echo يرجى الانتظار قليلاً...
    call npm install
    echo.
)

echo [2/2] جاري تشغيل التطبيق وفتح المتصفح...
echo.

:: Open browser automatically after 2 seconds
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Start the app server
call npm run dev
