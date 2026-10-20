@echo off
setlocal EnableDelayedExpansion
:: Dung tien trinh Jagame CUA THU MUC CAI DAT NAY con treo (PHP cong 6969-6971 + tunnel). Khong xoa du lieu.
:: Chi tat php.exe / cloudflared.exe nam trong thu muc cai dat nay (hoac cloudflared chay voi cau hinh
:: jagame-tunnel.yml cua thu muc nay): chuong trinh khac dung cong 6969 khong bi dung toi.
:: Duong dan co the chua dau cach, ( ) & hoac chu co dau (R2-03): SET "X=..." + !X!, khong %X% trong khoi ( ).
:: PowerShell nhan duong dan qua bien moi truong ($env:AC_ROOT, $env:AC_CONF), khong ghep vao chuoi lenh.
SET "SCRIPT_DIR=%~dp0"
IF EXIST "!SCRIPT_DIR!router.php" GOTO layout_release
FOR %%I IN ("!SCRIPT_DIR!..") DO SET "AC_ROOT=%%~fI\"
SET "WEB_ROOT=!AC_ROOT!Web\"
GOTO layout_done
:layout_release
SET "WEB_ROOT=!SCRIPT_DIR!"
SET "AC_ROOT=!SCRIPT_DIR!"
:layout_done
SET "AC_CONF=!WEB_ROOT!cloudflared\jagame-tunnel.yml"

FOR %%P IN (6969 6970 6971 7969 7970 7971) DO (
    FOR /F "tokens=5" %%i IN ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') DO CALL :killmine %%i %%P
)
DEL /Q "!WEB_ROOT!cloudflared\beat.run" >nul 2>&1
:: Cua so nhip go cua run_window.bat (tu thoat khi mat beat.run, tat luon cho nhanh).
TASKKILL /F /T /FI "WINDOWTITLE eq Jagame Beat*" >nul 2>&1
:: cloudflared cua ban cai nay (web bat trong cua so "Jagame Tunnel"): nhan ra qua duong dan cau hinh rieng.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cloudflared.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($env:AC_CONF, [StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Da tat link cong khai (PID ' + $_.ProcessId + ').') }"
DEL /Q "!WEB_ROOT!database\.public_url" "!WEB_ROOT!cloudflared\web_tunnel.pid" >nul 2>&1
echo Xong. Chay lai run_window.bat
pause
EXIT /B 0

:: killmine <PID> <cong>: chi tat neu la php.exe/cloudflared.exe nam trong thu muc cai dat nay.
:killmine
SET "AC_PID=%~1"
SET "AC_PORT=%~2"
powershell -NoProfile -Command "$p = Get-Process -Id $env:AC_PID -ErrorAction SilentlyContinue; if ($p -and $p.Path -and ($p.ProcessName -eq 'php' -or $p.ProcessName -eq 'node' -or $p.ProcessName -eq 'cloudflared') -and $p.Path.StartsWith($env:AC_ROOT, [StringComparison]::OrdinalIgnoreCase)) { Stop-Process -Id $p.Id -Force; Write-Host ('Da tat Jagame o cong ' + $env:AC_PORT + ' (PID ' + $p.Id + ').') } elseif ($p) { Write-Host ('Bo qua cong ' + $env:AC_PORT + ' (PID ' + $p.Id + '): ' + $p.Path + ' khong thuoc thu muc nay.') }"
GOTO :eof
