#!/bin/bash
# Dừng tiến trình Jagame CỦA THƯ MỤC CÀI ĐẶT NÀY còn treo (PHP + cloudflared của Jagame).
# Tìm PHP theo: cổng ghi ở database/.app_port (run_mac.sh ghi khi khởi động), biến JAGAME_PORT (+2 cổng lùi),
# 3 cổng mặc định 6969–6971, và cuối cùng là mọi "php -S … router.php" có thư mục làm việc = thư mục web này
# (bất kể cổng — S1-FREE-02/S1-OPS-02). Chỉ tắt PHP có dòng lệnh chứa router.php VÀ thư mục làm việc là thư mục
# web của bản cài này — chương trình khác đang dùng cổng 6969 (hay một bản Jagame khác) không bị đụng tới.
# Không xóa dữ liệu. Sau đó chạy lại: bash run_mac.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/router.php" ]; then WEB_ROOT="$SCRIPT_DIR"; else WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)/Web"; fi
WEB_REAL="$(cd "$WEB_ROOT" && pwd -P)"

# Thư mục làm việc của tiến trình (lsof trên macOS; /proc trên Linux).
proc_cwd() {
    if [ -r "/proc/$1/cwd" ]; then
        readlink "/proc/$1/cwd" 2>/dev/null
        return
    fi
    lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}
is_ours() {  # is_ours <pid>: PHP của Jagame VÀ đúng thư mục này
    local cmd cwd cwd_real
    cmd="$(ps -o command= -p "$1" 2>/dev/null)"
    case "$cmd" in *php*router.php*) ;; *) return 1 ;; esac
    cwd="$(proc_cwd "$1")"
    cwd_real="$( [ -n "$cwd" ] && cd "$cwd" 2>/dev/null && pwd -P)"
    [ "$cwd_real" = "$WEB_REAL" ]
}

# Danh sách cổng cần xem (không trùng): .app_port -> JAGAME_PORT (+1, +2) -> 6969 6970 6971.
PORTS=""
add_port() { case "$1" in ''|*[!0-9]*) return ;; esac; case " $PORTS " in *" $1 "*) ;; *) PORTS="$PORTS $1" ;; esac; }
add_port "$(tr -cd '0-9' < "$WEB_ROOT/database/.app_port" 2>/dev/null)"
if [ -n "$JAGAME_PORT" ]; then
    case "$JAGAME_PORT" in *[!0-9]*) ;; *) add_port "$JAGAME_PORT"; add_port "$((JAGAME_PORT + 1))"; add_port "$((JAGAME_PORT + 2))" ;; esac
fi
add_port 6969; add_port 6970; add_port 6971

KILLED=""
FOUND=""
for P in $PORTS; do
    for PID in $(lsof -nP -a -iTCP:$P -sTCP:LISTEN -t 2>/dev/null); do
        case " $KILLED " in *" $PID "*) continue ;; esac
        CMD="$(ps -o command= -p "$PID" 2>/dev/null)"
        case "$CMD" in
            *php*router.php*) ;;
            *) echo "Bỏ qua cổng $P (PID $PID): không phải Jagame — $CMD"; continue ;;
        esac
        if ! is_ours "$PID"; then
            echo "Bỏ qua cổng $P (PID $PID): Jagame của thư mục khác ($(proc_cwd "$PID"))."
            continue
        fi
        kill "$PID" 2>/dev/null && echo "Đã tắt Jagame ở cổng $P (PID $PID)." && FOUND=1 && KILLED="$KILLED $PID"
    done
done
# Cổng lạ (vd JAGAME_PORT đặt ở cửa sổ khác) hoặc worker mồ côi: quét mọi php -S … router.php của đúng thư mục này.
for PID in $(pgrep -f 'php.* -S [^ ]*:[0-9]+ router\.php' 2>/dev/null); do
    case " $KILLED " in *" $PID "*) continue ;; esac
    case "$(ps -o comm= -p "$PID" 2>/dev/null)" in *php*) ;; *) continue ;; esac
    is_ours "$PID" || continue
    kill "$PID" 2>/dev/null && echo "Đã tắt tiến trình PHP của Jagame (PID $PID)." && FOUND=1 && KILLED="$KILLED $PID"
done
if [ -n "$KILLED" ]; then
    # Chờ tắt hẳn (tối đa 3 s) rồi mới ép; worker php -S có thể sống thêm vài trăm ms sau tiến trình chính.
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        LEFT="$(for p in $KILLED; do kill -0 "$p" 2>/dev/null && echo "$p"; done)"
        [ -z "$LEFT" ] && break
        sleep 0.3
    done
    [ -n "$LEFT" ] && kill -9 $LEFT 2>/dev/null
fi
[ -z "$FOUND" ] && echo "Không có Jagame nào của thư mục này đang chạy (đã xem cổng$PORTS và mọi tiến trình php của thư mục này)."
# Chỉ tắt cloudflared của ĐÚNG bản cài này (mang --config <thư mục này>/cloudflared/jagame-tunnel.yml).
pkill -f "$WEB_ROOT/cloudflared/jagame-tunnel.yml" 2>/dev/null && echo "Đã tắt link công khai của Jagame."
[ "$WEB_REAL" != "$WEB_ROOT" ] && pkill -f "$WEB_REAL/cloudflared/jagame-tunnel.yml" 2>/dev/null
rm -f "$WEB_ROOT/cloudflared/web_tunnel.pid"
# .public_url chỉ xóa khi đã thật sự tắt server của thư mục này (S1-FREE-02: trước đây xóa cả khi server còn sống,
# trang Tổng quan mất link cho tới nhịp /health kế tiếp).
[ -n "$FOUND" ] && rm -f "$WEB_ROOT/database/.public_url"
echo "Xong. Chạy lại: bash run_mac.sh"
