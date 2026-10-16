@echo off
REM keepalive_win.bat — giu Anh Cuoi chay lien tuc: server thoat thi tu chay lai. Dong cua so de dung.
REM Duong dan co the chua dau cach, ( ) & hoac chu co dau: SET "X=..." + !X! (R2-03).
setlocal EnableDelayedExpansion
SET "RUN=%~dp0run_window.bat"
SET "JAGAME_NO_BROWSER="
echo [keepalive] Giam sat Anh Cuoi. Dong cua so de dung han.
:loop
echo [keepalive] !TIME! khoi dong...
call "!RUN!" < nul
REM Ma thoat 2 = loi can nguoi dung xu ly (thieu php.exe, chua cai duoc Visual C++): dung han, khong chay lai.
IF ERRORLEVEL 2 GOTO stop
REM Chi lan chay dau mo trinh duyet; cac lan chay lai khong mo them tab (R2-32).
SET "JAGAME_NO_BROWSER=1"
echo [keepalive] Server thoat - chay lai sau 5s.
timeout /t 5 /nobreak >nul
GOTO loop

:stop
echo [keepalive] Dung han: sua loi o tren roi chay lai keepalive_win.bat.
pause
EXIT /B 2
