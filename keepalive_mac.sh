#!/bin/bash
# keepalive_mac.sh — giữ Jagame chạy liên tục (dùng cho máy để bật suốt ngày).
# Chạy run_mac.sh; server thoát thì tự chạy lại sau vài giây. Dừng hẳn: Ctrl+C.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN="$SCRIPT_DIR/run_mac.sh"
DELAY=5; MAX_FAST=5; MIN_UP=15; COOLDOWN=60
fast=0
trap 'echo ""; echo "[keepalive] Đã dừng."; exit 0' INT TERM

echo "[keepalive] Giám sát Jagame. Nhấn Ctrl+C để dừng hẳn."
while true; do
    START=$(date +%s)
    echo "[keepalive] $(date '+%H:%M:%S') khởi động..."
    # run_mac.sh tự dọn PHP mồ côi của ĐÚNG thư mục này (worker còn giữ cổng sau khi PHP chính chết) trước khi chọn
    # cổng, và khi thoát tắt cả worker + cloudflared -> lần chạy lại dùng đúng cổng cũ, link jagame không đổi (R5-04).
    bash "$RUN"
    # Chỉ lần chạy đầu mở trình duyệt; các lần chạy lại không mở thêm tab (R2-32).
    export JAGAME_NO_BROWSER=1
    UP=$(( $(date +%s) - START ))
    if [ "$UP" -lt "$MIN_UP" ]; then
        fast=$((fast + 1))
        echo "[keepalive] Thoát sau ${UP}s (lần $fast)."
        if [ "$fast" -ge "$MAX_FAST" ]; then
            echo "[keepalive] Lỗi liên tục — nghỉ ${COOLDOWN}s."
            sleep "$COOLDOWN"; fast=0
        else
            sleep "$DELAY"
        fi
    else
        fast=0
        echo "[keepalive] Thoát sau ${UP}s — chạy lại sau ${DELAY}s."
        sleep "$DELAY"
    fi
done
