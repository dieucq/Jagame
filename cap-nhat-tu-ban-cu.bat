@echo off
chcp 65001 >nul
title Jagame - cap nhat tu ban cu
:: Cap nhat Jagame tren Windows: bam dup file nay trong thu muc jagame MOI vua giai nen, keo thu muc jagame CU vao cua so,
:: nhan Enter. Du lieu (database, uploads, games, cloudflared) duoc chep sang ban moi roi ban moi tu chay; thu muc cu giu nguyen.
:: Phan loi nam trong cap-nhat-tu-ban-cu.ps1 (cung thu muc). File nay CHI chua ky tu ASCII.
IF NOT EXIST "%~dp0cap-nhat-tu-ban-cu.ps1" GOTO notextracted
SET "JG_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
IF NOT EXIST "%JG_PS%" SET "JG_PS=powershell"
"%JG_PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0cap-nhat-tu-ban-cu.ps1" %*
SET "JG_RC=%ERRORLEVEL%"
IF NOT "%JG_RC%"=="0" pause
EXIT /B %JG_RC%

:notextracted
echo.
echo [LOI] Khong thay cap-nhat-tu-ban-cu.ps1 canh file nay - hay giai nen goi (chuot phai -^> "Extract All") truoc.
pause
EXIT /B 1
