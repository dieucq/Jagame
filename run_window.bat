@echo off
chcp 65001 >nul
title Jagame
:: Chay Jagame tren Windows: phan loi nam trong run_window.ps1 (cung thu muc) - PowerShell co san trong Windows 10/11.
:: Nguoi dung chi can bam dup file nay. Ma thoat 2 = loi can nguoi dung xu ly (keepalive_win.bat dung han).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_window.ps1"
SET "JG_RC=%ERRORLEVEL%"
IF NOT "%JG_RC%"=="0" pause
EXIT /B %JG_RC%
