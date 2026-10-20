@echo off
chcp 65001 >nul
title Jagame - cap nhat tu ban cu
:: Cap nhat Jagame tren Windows: bam dup file nay trong thu muc jagame MOI vua giai nen, keo thu muc jagame CU vao cua so,
:: nhan Enter. Du lieu (database, uploads, games, cloudflared) duoc chep sang ban moi roi ban moi tu chay; thu muc cu giu nguyen.
:: Phan loi nam trong cap-nhat-tu-ban-cu.ps1 (cung thu muc).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cap-nhat-tu-ban-cu.ps1" %*
SET "JG_RC=%ERRORLEVEL%"
IF NOT "%JG_RC%"=="0" pause
EXIT /B %JG_RC%
