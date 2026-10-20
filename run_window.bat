@echo off
chcp 65001 >nul
title Jagame
:: Chay Jagame tren Windows: phan loi nam trong run_window.ps1 (cung thu muc) - PowerShell co san trong Windows 10/11.
:: Nguoi dung chi can bam dup file nay. Ma thoat 2 = loi can nguoi dung xu ly (keepalive_win.bat dung han).
:: File nay CHI chua ky tu ASCII (cmd doc .bat theo bang ma; chu co dau + chcp 65001 lam lech dong). Duong dan co dau cach,
:: ( ) & hoac chu co dau: luon trong ngoac kep, khong dung khoi ( ).
IF NOT EXIST "%~dp0run_window.ps1" GOTO notextracted
SET "JG_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
IF NOT EXIST "%JG_PS%" SET "JG_PS=powershell"
"%JG_PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_window.ps1"
SET "JG_RC=%ERRORLEVEL%"
IF NOT "%JG_RC%"=="0" pause
EXIT /B %JG_RC%

:notextracted
echo.
echo [LOI] Khong thay run_window.ps1 canh file nay.
echo       Ban dang mo thang trong file .zip? Bam chuot phai vao file jagame-windows-....zip
echo       -^> "Extract All" (Giai nen tat ca), roi bam dup run_window.bat trong thu muc vua giai nen.
echo       Tai lai goi day du: https://jagame.vn/#tai-ve
pause
EXIT /B 2
