#!/bin/bash
# Chạy Jagame trên macOS/Linux: cổng Node (Realtime/: Socket.IO + proxy) trước PHP built-in server.
#   bash run_mac.sh                        # http://localhost:6969
#   JAGAME_BIND=0.0.0.0 bash run_mac.sh    # cho máy khác trong mạng nhà mở http://<ip-máy>:6969
#   JAGAME_PORT=9000 bash run_mac.sh       # cổng khác (bận thì lùi 9001/9002)
#   JAGAME_NO_CAFFEINATE=1 bash run_mac.sh # cho máy ngủ như thường (mặc định: macOS giữ máy thức khi hội quán chạy)
# Trình duyệt / cloudflared -> PORT (Node gateway) -> 127.0.0.1:PHP_PORT (php -S, chỉ nghe loopback).
# PHP + Node đi kèm gói (runtime/), người dùng không phải cài gì. Bản DEV lấy ở Tools/runtime/<os>-<arch>/
# (tải bằng: bash Script/fetch_runtime.sh), không có thì dùng php/node của máy.
# Link công khai do WEB tự quản (Web/application/libraries/Tunnelrunner.php): cài xong tự có
# https://xxxx.jagame.vn; script này chỉ chạy PHP + Node, tải cloudflared lần đầu và gõ /health mỗi phút.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$(uname -s)" in Darwin) HOST_OS=darwin ;; Linux) HOST_OS=linux ;; *) HOST_OS=unknown ;; esac
case "$(uname -m)" in arm64|aarch64) HOST_ARCH=arm64 ;; x86_64|amd64) HOST_ARCH=x64 ;; *) HOST_ARCH=unknown ;; esac

# ─── Bố cục: RELEASE (phẳng, router.php cùng cấp) hay DEV (Web/ + Tools/ tách) ─
if [ -f "$SCRIPT_DIR/router.php" ]; then
    LAYOUT=release
    WEB_ROOT="$SCRIPT_DIR"
    CF_TOOL_DIR="$SCRIPT_DIR/cloudflared"
    RT_DIR="$SCRIPT_DIR/Realtime"
    # runtime/php = PHP tĩnh (cùng bố cục Tools/runtime/<os>-<arch>/ của bản DEV); runtime/php/php: bố cục cũ.
    BUNDLED_PHP="$SCRIPT_DIR/runtime/php"
    [ -d "$BUNDLED_PHP" ] && BUNDLED_PHP="$SCRIPT_DIR/runtime/php/php"
    BUNDLED_NODE="$SCRIPT_DIR/runtime/node/bin/node"
    RUNTIME_DIR="$SCRIPT_DIR/runtime"
else
    LAYOUT=dev
    ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    WEB_ROOT="$ROOT_DIR/Web"
    CF_TOOL_DIR="$ROOT_DIR/Tools/cloudflared"
    RT_DIR="$ROOT_DIR/Realtime"
    RUNTIME_DIR="$ROOT_DIR/Tools/runtime/$HOST_OS-$HOST_ARCH"
    BUNDLED_PHP="$RUNTIME_DIR/php"
    BUNDLED_NODE="$RUNTIME_DIR/node/bin/node"
fi
# Cấu hình tunnel luôn nằm trong web root (Quản trị ghi vào đây).
CF_CONF_DIR="$WEB_ROOT/cloudflared"
DB_DIR="$WEB_ROOT/database"
mkdir -p "$CF_CONF_DIR" "$DB_DIR/sessions" "$WEB_ROOT/uploads/photos" 2>/dev/null
chmod 0700 "$CF_CONF_DIR" "$DB_DIR" 2>/dev/null

BIND="${JAGAME_BIND:-localhost}"

runtime_missing() {  # runtime_missing <mô tả>
    echo "[LỖI] $1"
    echo "      Gói tải về bị thiếu runtime, hãy tải lại gói đầy đủ."
    [ "$LAYOUT" = "dev" ] && echo "      (Bản DEV: bash Script/fetch_runtime.sh  -> Tools/runtime/$HOST_OS-$HOST_ARCH/)"
    exit 1
}

# Bản phát hành chưa kèm runtime (vd tải mã từ GitHub): LẦN ĐẦU tự tải PHP tĩnh + Node chính thức (cùng cloudflared ~90 MB, kiểm SHA-256)
# vào runtime/ — người dùng vẫn không phải cài gì. JAGAME_NO_FETCH=1 để tắt (dùng php/node của máy).
if [ "$LAYOUT" = "release" ] && [ -z "$JAGAME_NO_FETCH" ] && [ -f "$SCRIPT_DIR/fetch_runtime.sh" ] \
    && { [ ! -x "$BUNDLED_PHP" ] || [ ! -x "$BUNDLED_NODE" ]; }; then
    echo "  Lần đầu chạy: cần Internet để tải PHP + Node + cloudflared (khoảng 90 MB, chỉ 1 lần)."
    echo "  Mạng chậm có thể mất vài phút — cứ để nguyên cửa sổ này."
    if bash "$SCRIPT_DIR/fetch_runtime.sh"; then
        BUNDLED_PHP="$SCRIPT_DIR/runtime/php"
    else
        echo "  [!] Chưa tải được runtime (kiểm tra Internet) — thử dùng PHP/Node có sẵn trên máy."
    fi
fi

# Runtime đi kèm: giải nén bằng công cụ lạ có thể mất quyền chạy; macOS gắn cờ quarantine cho file tải từ trình duyệt
# (Gatekeeper chặn chạy chương trình không ký) -> gỡ trên đúng thư mục runtime của gói.
if [ -d "$RUNTIME_DIR" ]; then
    chmod +x "$BUNDLED_PHP" "$BUNDLED_NODE" 2>/dev/null
    [ "$HOST_OS" = "darwin" ] && xattr -dr com.apple.quarantine "$RUNTIME_DIR" 2>/dev/null
fi

# ─── PHP: đi kèm gói -> của máy (chỉ để dev) ─────────────────────────────────
PHP_EXE=""
if [ -x "$BUNDLED_PHP" ] && "$BUNDLED_PHP" -r 'exit(0);' >/dev/null 2>&1; then
    PHP_EXE="$BUNDLED_PHP"
else
    PHP_EXE="$(command -v php 2>/dev/null)"
fi
[ -n "$PHP_EXE" ] || runtime_missing "Không tìm thấy PHP."
# Tiện ích bắt buộc: sqlite3 (dữ liệu), gd (ảnh), curl (link xxxx.jagame.vn), mbstring (chữ tiếng Việt).
MISSING=""
PHP_MODS="$("$PHP_EXE" -m 2>/dev/null)"
for ext in sqlite3 gd curl mbstring; do
    printf '%s\n' "$PHP_MODS" | grep -qi "^$ext\$" || MISSING="$MISSING php-$ext"
done
[ -n "$MISSING" ] && runtime_missing "PHP ($PHP_EXE) thiếu tiện ích:$MISSING"
printf '%s\n' "$PHP_MODS" | grep -qi '^zip$' || echo "[!] PHP thiếu php-zip: không tải được nhiều ảnh dạng .zip."

# ─── Node: đi kèm gói -> của máy (chỉ để dev); cần ≥ 22.13 (node:sqlite có sẵn) ───
node_ok() {  # node_ok <đường dẫn>: chạy được và đủ phiên bản
    [ -n "$1" ] && [ -x "$1" ] || return 1
    "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' >/dev/null 2>&1
}
NODE_EXE=""
if node_ok "$BUNDLED_NODE"; then
    NODE_EXE="$BUNDLED_NODE"
elif node_ok "$(command -v node 2>/dev/null)"; then
    NODE_EXE="$(command -v node)"
fi
if [ -z "$NODE_EXE" ]; then
    SYS_NODE_VER="$(node -v 2>/dev/null)"
    runtime_missing "Không tìm thấy Node.js ≥ 22.13${SYS_NODE_VER:+ (máy đang có $SYS_NODE_VER)}."
fi
[ -f "$RT_DIR/server.js" ] || runtime_missing "Thiếu thư mục Realtime/ (cổng realtime)."
# Thư viện của cổng realtime: bản phát hành đóng gói sẵn Realtime/node_modules; chỉ bản DEV mới tự cài khi thiếu.
if [ ! -f "$RT_DIR/node_modules/socket.io/package.json" ]; then
    if [ "$LAYOUT" = "dev" ] && command -v npm >/dev/null 2>&1; then
        echo "  Cài thư viện cho Realtime/ (lần đầu)..."
        (cd "$RT_DIR" && npm install --omit=dev --no-audit --no-fund) || { echo "[LỖI] npm install trong Realtime/ thất bại."; exit 1; }
    else
        runtime_missing "Thiếu Realtime/node_modules."
    fi
fi

# ─── Giám sát + Cập nhật 1 nút (RB-03, Web/application/libraries/Selfupdate.php) ───────────────────────────────
# Lần chạy này là CHA: chạy chính script ở chế độ CON (JAGAME_CHILD=1, phần dưới: PHP + Node). Con thoát mã 75 (Node nhận
# database/.restart) = khởi động lại: đổi mã bản mới đang chờ (php update/apply.php apply — bản apply của BẢN CŨ), chạy lại con,
# gõ /health?update=<nonce> tối đa 90 s; không đạt -> trả mã cũ (rollback) + chạy lại. Cha đã mở sẵn tệp script nên thay run_mac.sh
# trên đĩa không ảnh hưởng nó; con mỗi lần chạy đọc bản mới. JAGAME_SUPERVISOR=1 báo PHP/Node là có giám sát (không có = tắt tính năng).
if [ -z "$JAGAME_CHILD" ]; then
    UP_DIR="$WEB_ROOT/update"
    upd() {  # upd <apply|check|rollback|phase> [tham số]
        local cmd="$1"; shift
        [ -f "$UP_DIR/apply.php" ] || return 3
        "$PHP_EXE" "$UP_DIR/apply.php" "$cmd" "$WEB_ROOT" "$@"
    }
    CHILD=""
    SUP_QUIT=""
    # Con chạy nền (bash bỏ qua SIGINT ở tiến trình nền) -> cha chuyển Ctrl+C / đóng cửa sổ thành TERM cho con (con tự dọn PHP + Node).
    trap 'SUP_QUIT=1; [ -n "$CHILD" ] && kill -TERM "$CHILD" 2>/dev/null' INT TERM HUP
    while true; do
        upd apply >/dev/null 2>&1   # không có bản chờ -> không làm gì
        JAGAME_CHILD=1 JAGAME_SUPERVISOR=1 bash "$SCRIPT_DIR/run_mac.sh" "$@" &
        CHILD=$!
        if [ "$(upd phase 2>/dev/null)" = "verifying" ]; then
            echo "  Đang chạy thử bản mới (tối đa 90 giây)..."
            UP_OK=""
            UP_WHY="timeout"   # lý do quay về: mã thay chữ (update_apply.php dịch ra câu cho chủ nhà)
            for _ in $(seq 1 90); do
                sleep 1
                [ -n "$SUP_QUIT" ] && break
                if ! kill -0 "$CHILD" 2>/dev/null; then   # bản mới dừng ngay: quay về luôn, không chờ đủ 90 s
                    wait "$CHILD" 2>/dev/null
                    UP_WHY="exit:$?"
                    break
                fi
                upd check >/dev/null 2>&1 && { UP_OK=1; break; }
            done
            if [ -z "$UP_OK" ] && [ -z "$SUP_QUIT" ]; then
                echo "[!] Bản mới chưa chạy được ($UP_WHY) — đang quay về bản cũ (dữ liệu giữ nguyên)..."
                kill -TERM "$CHILD" 2>/dev/null
                wait "$CHILD" 2>/dev/null
                upd rollback "$UP_WHY" >/dev/null 2>&1
                export JAGAME_NO_BROWSER=1
                continue
            fi
            [ -n "$UP_OK" ] && echo "  Đã cập nhật xong."
        fi
        RC=0
        while :; do
            wait "$CHILD" 2>/dev/null
            RC=$?
            kill -0 "$CHILD" 2>/dev/null || break
        done
        [ -n "$SUP_QUIT" ] && exit 0
        [ "$RC" -eq 75 ] || exit "$RC"
        export JAGAME_NO_BROWSER=1   # chạy lại không mở thêm tab
        echo "  Đang khởi động lại hội quán..."
    done
fi

# ─── Dọn tiến trình mồ côi CỦA ĐÚNG THƯ MỤC NÀY (R5-04) ─────────────────────
# php -S nhiều tiến trình: tiến trình chính chết (kill -9, hết RAM) thì các worker vẫn giữ cổng (PPID 1) -> lần chạy
# lại phải lùi cổng, 3 lần là hết cổng. Chỉ giết "php … -S … router.php" có thư mục làm việc = web root này VÀ đã mất
# cha (cha không còn là php / run_mac.sh / một shell). PHP của chương trình khác, hay Jagame đang chạy ở cửa sổ
# khác cùng thư mục, không bị đụng (BL-13). Node gateway mồ côi (run_mac.sh bị kill -9) dọn theo cùng luật, nhận
# ra bằng đường dẫn tuyệt đối tới Realtime/server.js của đúng bản này.
WEB_REAL="$(cd "$WEB_ROOT" && pwd -P)"
RT_REAL="$(cd "$RT_DIR" && pwd -P)"
parent_alive() {  # parent_alive <pid>: còn cha "thật" (không phải init) là php / script chạy / một shell
    local ppid pcmd
    ppid="$(ps -o ppid= -p "$1" 2>/dev/null | tr -d ' ')"
    [ -n "$ppid" ] || return 0
    [ "$ppid" = "1" ] && return 1
    pcmd="$(ps -o command= -p "$ppid" 2>/dev/null)"
    case "$pcmd" in
        *php*|*run_mac.sh*|*keepalive_mac.sh*) return 0 ;;
        -*|*/sh|*/bash|*/zsh|*/fish|*/dash|sh|bash|zsh|fish|dash|"sh "*|"bash "*|"zsh "*|"dash "*|*"/sh "*|*"/bash "*|*"/zsh "*|*"/dash "*) return 0 ;;
    esac
    return 1
}
orphan_php_pids() {
    local pid cands=""
    for pid in $(pgrep -f 'php.* -S [^ ]*:[0-9]+ router\.php' 2>/dev/null); do
        # Phải đúng là chương trình php (không phải shell có chữ "php -S" trong dòng lệnh).
        case "$(ps -o comm= -p "$pid" 2>/dev/null)" in *php*) ;; *) continue ;; esac
        # Xét cha trước (ps nhanh); thư mục làm việc xét 1 lần cho cả nhóm (lsof chậm ~1 s mỗi lần gọi trên macOS).
        parent_alive "$pid" && continue
        cands="$cands $pid"
    done
    [ -n "$cands" ] || return 0
    if [ -d /proc/self ]; then
        for pid in $cands; do
            [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$WEB_REAL" ] && echo "$pid"
        done
    elif command -v lsof >/dev/null 2>&1; then
        # -Fpn: dòng "p<pid>" rồi "n<thư mục>"
        lsof -a -p "$(echo $cands | tr ' ' ',')" -d cwd -Fpn 2>/dev/null | awk -v want="$WEB_REAL" '
            /^p/ { pid = substr($0, 2) } /^n/ { if (substr($0, 2) == want) print pid }'
    fi
}
orphan_node_pids() {
    local pid
    for pid in $(pgrep -f 'server\.js' 2>/dev/null); do
        case "$(ps -o comm= -p "$pid" 2>/dev/null)" in *node*) ;; *) continue ;; esac
        case " $(ps -o command= -p "$pid" 2>/dev/null) " in *" $RT_REAL/server.js "*) ;; *) continue ;; esac
        parent_alive "$pid" || echo "$pid"
    done
}
kill_pids() {  # kill_pids <pid...>: TERM, chờ tối đa 3 s, còn sống thì KILL
    local pids="$*" i
    [ -n "$pids" ] || return 0
    kill $pids 2>/dev/null
    for i in 1 2 3 4 5 6 7 8 9 10; do
        sleep 0.3
        pids="$(for p in $pids; do kill -0 "$p" 2>/dev/null && echo "$p"; done)"
        [ -z "$pids" ] && return 0
    done
    kill -9 $pids 2>/dev/null
    return 0
}
# Kèm các worker của PHP mồ côi: cha của chúng là php (chưa "mất cha") nên orphan_php_pids bỏ qua, mà giết php chính
# bằng TERM không kéo worker theo -> chúng thành mồ côi mới, vẫn giữ cổng PHP tới lần dọn sau (đã gặp khi thử kill -9).
kill_orphan_php() {
    local pids p
    pids="$(orphan_php_pids)"
    [ -n "$pids" ] || return 0
    kill_pids $pids $(for p in $pids; do pgrep -P "$p" 2>/dev/null; done)
}
kill_orphan_node() { kill_pids $(orphan_node_pids); }
STALE="$(orphan_php_pids) $(orphan_node_pids)"
STALE_N="$(printf '%s\n' $STALE | grep -c .)"
if [ "$STALE_N" -gt 0 ]; then
    echo "[!] Dọn $STALE_N tiến trình cũ của Jagame còn giữ cổng (lần chạy trước bị tắt đột ngột)."
    kill_orphan_node
    kill_orphan_php
fi

# ─── Chọn cổng: 6969 bận thì lùi 6970/6971 ───────────────────────────────────
port_busy() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
        return $?
    fi
    "$PHP_EXE" -r '$c=@fsockopen("127.0.0.1",(int)$argv[1],$e,$s,0.5); if($c){fclose($c); exit(0);} exit(1);' "$1" >/dev/null 2>&1
}
# JAGAME_PORT=<cổng>: đổi cổng gốc (vd máy đã có chương trình khác ở 6969); lùi tối đa 2 cổng kế tiếp.
BASE_PORT="${JAGAME_PORT:-6969}"
case "$BASE_PORT" in ''|*[!0-9]*) BASE_PORT=6969 ;; esac
PORTS="$BASE_PORT $((BASE_PORT + 1)) $((BASE_PORT + 2))"
PORT=""
for CAND in $PORTS; do
    if port_busy "$CAND"; then
        echo "[!] Cổng $CAND đang bận (có thể Jagame đang chạy ở cửa sổ khác), thử cổng khác..."
        continue
    fi
    PORT="$CAND"
    break
done
if [ -z "$PORT" ]; then
    echo "[LỖI] Cả 3 cổng $(echo "$PORTS" | sed 's/ /, /g') đều bận. Đóng bớt cửa sổ Jagame cũ rồi mở lại."
    exit 1
fi
# Cổng nội bộ cho PHP (chỉ 127.0.0.1): cổng trống đầu tiên trong PORT+1000..PORT+1010.
PHP_PORT=""
for CAND in $(seq $((PORT + 1000)) $((PORT + 1010))); do
    port_busy "$CAND" || { PHP_PORT="$CAND"; break; }
done
if [ -z "$PHP_PORT" ]; then
    echo "[LỖI] Không còn cổng trống cho PHP ($((PORT + 1000))–$((PORT + 1010)))."
    exit 1
fi
# .app_port = cổng CÔNG KHAI (gateway): cloudflared/Tunnelrunner trỏ vào đây.
printf '%s' "$PORT" > "$DB_DIR/.app_port" 2>/dev/null

# ─── Cấu hình tunnel ─────────────────────────────────────────────────────────
json_get() {  # json_get <file> <key>
    "$PHP_EXE" -r '$p=json_decode((string)@file_get_contents($argv[1]),true); echo is_array($p)?(string)($p[$argv[2]]??""):"";' "$1" "$2" 2>/dev/null
}
TUN_FILE="$CF_CONF_DIR/tunnel.json"
rm -f "$DB_DIR/.public_url" 2>/dev/null
# R3-07: lần chạy trước (vd keepalive chạy lại sau 5 s) để lại dấu .ensure_at còn mới -> nhịp /health đầu tiên bị
# bỏ qua và link chết thêm ~1 phút. Mới khởi động thì luôn cho web bật tunnel ngay.
rm -f "$CF_CONF_DIR/.ensure_at" 2>/dev/null

# ─── cloudflared: WEB tự bật/giám sát tunnel (Tunnelrunner.php); script chỉ bảo đảm có sẵn chương trình ───
if [ ! -x "$CF_TOOL_DIR/cloudflared" ] && ! command -v cloudflared >/dev/null 2>&1; then
    echo "  Đang tải cloudflared để có link Internet (lần đầu, phần cuối của ~90 MB)..."
    CF_CURL_P="-sS"; [ -t 2 ] && CF_CURL_P="--progress-bar"
    mkdir -p "$CF_TOOL_DIR"
    OS="$(uname -s)"; ARCH="$(uname -m)"
    case "$ARCH" in arm64|aarch64) A=arm64 ;; *) A=amd64 ;; esac
    TMPF="$(mktemp /tmp/cf_dl_XXXXXX)"
    if [ "$OS" = "Darwin" ]; then
        curl -fL $CF_CURL_P "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$A.tgz" -o "$TMPF" \
            && tar xzf "$TMPF" -C "$CF_TOOL_DIR/" 2>/dev/null
    else
        curl -fL $CF_CURL_P "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$A" -o "$CF_TOOL_DIR/cloudflared"
    fi
    rm -f "$TMPF"
    chmod +x "$CF_TOOL_DIR/cloudflared" 2>/dev/null
    [ -x "$CF_TOOL_DIR/cloudflared" ] || echo "  [!] Không tải được cloudflared — trang chỉ mở được trong máy/mạng nhà."
fi

echo "========================================"
echo "  Jagame"
echo "  Máy này : http://localhost:$PORT      (quản trị: /admin)"
[ "$BIND" = "0.0.0.0" ] && echo "  Mạng nhà: http://<địa-chỉ-IP-máy-này>:$PORT"
# QA64 L10: câu "sau khi cài đặt xong" chỉ khi CHƯA có tài khoản nào (chưa qua /setup).
SETUP_DONE="$("$PHP_EXE" -r '$f=$argv[1]; if(!is_file($f)||!class_exists("SQLite3")){echo 0;exit;} try{$d=new SQLite3($f,SQLITE3_OPEN_READONLY); $d->busyTimeout(2000); echo (int)@$d->querySingle("SELECT COUNT(*) FROM users")>0?1:0;}catch(Throwable $e){echo 0;}' "$DB_DIR/jagame.db" 2>/dev/null)"
if [ "$SETUP_DONE" = "1" ]; then
    echo "  Internet: link xxxx.jagame.vn hiện bên dưới khi kết nối xong (và ở Quản trị → Mời bạn bè)"
else
    echo "  Lần đầu: mở trang trên để tạo hội quán — link xxxx.jagame.vn tự tạo ngay sau đó"
fi
echo "  Nhấn Ctrl+C để dừng"
echo "========================================"

# ─── Dọn dẹp khi thoát: tắt nhịp gõ + Node + PHP + tunnel do web bật (nhận ra qua file cấu hình riêng) ───
# Chỉ bẫy EXIT (chạy đúng 1 lần); Ctrl+C/TERM chỉ "exit 130" để đi vào EXIT. Tiến trình nền trong script
# không tương tác bỏ qua SIGINT, nên phải tự tắt cả con của chúng (sleep/curl), không để mồ côi (R2-31).
BEAT_PID=""
OPEN_PID=""
stop_tree() {  # stop_tree <pid>: tắt tiến trình và các con trực tiếp của nó
    [ -n "$1" ] || return 0
    local kids
    kids="$(pgrep -P "$1" 2>/dev/null)"
    kill "$1" 2>/dev/null
    [ -n "$kids" ] && kill $kids 2>/dev/null
    return 0
}
PHP_PID=""
NODE_PID=""
FILTER_PIDS=""
FIFO_DIR=""
cleanup() {
    trap - EXIT INT TERM
    stop_tree "$BEAT_PID"
    stop_tree "$OPEN_PID"
    [ -n "$CAFF_PID" ] && kill "$CAFF_PID" 2>/dev/null
    # Node trước (SIGTERM -> ngắt êm mọi socket, ghi last_seen_at; tự thoát sau tối đa 3 s), rồi PHP.
    stop_tree "$NODE_PID"
    # PHP + các worker của nó (R5-04). PHP chính đã chết trước (kill -9) thì worker thành mồ côi: dọn theo thư mục.
    stop_tree "$PHP_PID"
    # Thu hồi job NGAY (stderr tắt): bash chỉ in "Terminated: 15 …php…" khi job chết vì tín hiệu mà chưa được
    # wait trước lệnh ngoài kế tiếp (pgrep/ps trong kill_orphan_*) — S1-FREE-04.
    [ -n "$PHP_PID" ] && wait "$PHP_PID" 2>/dev/null
    [ -n "$NODE_PID" ] && wait "$NODE_PID" 2>/dev/null
    kill_orphan_php
    kill_orphan_node
    pkill -f "cloudflared.*$CF_CONF_DIR/jagame-tunnel.yml" 2>/dev/null
    [ -n "$FILTER_PIDS" ] && kill $FILTER_PIDS 2>/dev/null
    [ -n "$FIFO_DIR" ] && rm -rf "$FIFO_DIR" 2>/dev/null
    rm -f "$CF_CONF_DIR/web_tunnel.pid" "$DB_DIR/.public_url" 2>/dev/null
    echo ""
    echo "Đã dừng."
}
trap cleanup EXIT
# HUP = đóng cửa sổ Terminal (QA64 L10): dọn như Ctrl+C, không báo "dừng bất thường".
STOPPING=""
trap 'STOPPING=1; exit 130' INT TERM
trap 'STOPPING=1; exit 129' HUP

# ─── Giữ máy thức (macOS): máy ngủ = link hội quán chết cả đêm (HOME-SERVER-RELIABILITY #8) ───
# caffeinate -i chặn ngủ khi rảnh (màn hình vẫn tắt được, gập nắp vẫn ngủ theo macOS); -w $$ tự thoát khi script này dừng.
# Tắt: JAGAME_NO_CAFFEINATE=1. Linux: không có caffeinate -> bỏ qua (tùy distro dùng systemd-inhibit).
CAFF_PID=""
if [ -z "$JAGAME_NO_CAFFEINATE" ] && [ "$HOST_OS" = "darwin" ] && command -v caffeinate >/dev/null 2>&1; then
    caffeinate -i -w $$ >/dev/null 2>&1 &
    CAFF_PID=$!
    disown "$CAFF_PID" 2>/dev/null
fi

# Chờ trang sẵn sàng qua gateway (tối đa ~10 s). -f: gateway lên trước PHP thì trả 502 -> chưa tính là sẵn sàng.
wait_ready() {
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
        sleep 0.5
        curl -sf -o /dev/null --max-time 2 "http://localhost:$PORT/health" && break
    done
}

# ─── Nhịp gõ: /health mỗi phút -> web tự xin link / bật lại tunnel (kể cả chưa ai mở trang quản trị) ───
(
    # Gõ ngay khi sẵn sàng: chạy lại sau sự cố thì tunnel bật lại sớm nhất có thể (R3-07, R5-04).
    wait_ready
    LAST=""
    while true; do
        curl -s -o /dev/null --max-time 60 "http://localhost:$PORT/health?beat=1"
        H="$("$PHP_EXE" -r '$p=json_decode((string)@file_get_contents($argv[1]),true); echo is_array($p)&&($p["mode"]??"")==="token"?(string)($p["hostname"]??""):"";' "$TUN_FILE" 2>/dev/null)"
        [ -z "$H" ] && H="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_CONF_DIR/tunnel.log" 2>/dev/null | grep -v '//api\.' | tail -1 | sed 's#https://##')"
        if [ -n "$H" ] && [ "$H" != "$LAST" ]; then
            LAST="$H"
            echo ""
            echo "  >>> Link cho bạn bè/người thân: https://$H   (mã QR: Quản trị → Tổng quan)"
        fi
        sleep 60
    done
) &
BEAT_PID=$!
disown "$BEAT_PID" 2>/dev/null   # không in "Terminated … ( sleep …" khi tắt (vẫn tự tắt trong cleanup)

# ─── Tự mở trình duyệt khi trang đã sẵn sàng (JAGAME_NO_BROWSER=1 để tắt; lỗi thì bỏ qua) ───
if [ -z "$JAGAME_NO_BROWSER" ]; then
    (
        wait_ready
        if [ "$(uname -s)" = "Darwin" ]; then
            open "http://localhost:$PORT/" >/dev/null 2>&1
        elif command -v xdg-open >/dev/null 2>&1; then
            xdg-open "http://localhost:$PORT/" >/dev/null 2>&1
        fi
    ) &
    OPEN_PID=$!
    disown "$OPEN_PID" 2>/dev/null
fi

# ─── PHP ─────────────────────────────────────────────────────────────────────
# Ảnh điện thoại 5–20 MB, ảnh máy ảnh RAW→JPEG có thể 30–60 MB; GD cần RAM cỡ 4 byte/điểm ảnh.
# Số tiến trình PHP (R5-05, số đo ở Docs/logs/r5-05-php-workers.md): PHP 8.1 trên Linux với 4 worker treo ~0,5% yêu cầu
# song song tới 10 s; PHP ≥ 8.2 (macOS, Docker 8.3, gói NAS 8.3) không treo -> PHP < 8.2 chỉ chạy 1 tiến trình.
if [ -z "$PHP_CLI_SERVER_WORKERS" ] && "$PHP_EXE" -r 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);' 2>/dev/null; then
    PHP_CLI_SERVER_WORKERS=4
fi
# 1 tiến trình = không đặt biến (PHP báo "number of workers must be larger than 1" nếu đặt 1).
if [ "${PHP_CLI_SERVER_WORKERS:-0}" -gt 1 ] 2>/dev/null; then
    export PHP_CLI_SERVER_WORKERS
else
    unset PHP_CLI_SERVER_WORKERS
fi
cd "$WEB_ROOT" || exit 1

# ─── Nhật ký (S1-FREE-04): php -S mỗi kết nối 2 dòng "Accepted/Closing" + 1 dòng "[200]: GET …" làm trôi dòng link cho
# bạn bè. Đầy đủ ghi vào database/server.log (PHP) và database/realtime.log (Node), cắt khi > 5 MB (router chặn
# database/ nên không lộ ra web); ra màn hình chỉ dòng có ích: PHP = lỗi, yêu cầu 4xx/5xx, "started"…; Node = [LỖI] và
# dòng lạ (vết lỗi khi sập). Qua FIFO ở thư mục tạm (USB exFAT không tạo được FIFO -> PHP in thẳng như cũ, Node chỉ
# ghi file). PHP/Node vẫn là con trực tiếp của script (R5-04 cần PID).
PHP_LOG="$DB_DIR/server.log"
RT_LOG="$DB_DIR/realtime.log"
log_filter() {  # log_filter <php|node> <file log>
    local kind="$1" logf="$2" line n=0
    : > "$logf" 2>/dev/null
    while IFS= read -r line; do
        printf '%s\n' "$line" >> "$logf" 2>/dev/null
        if [ "$kind" = "php" ]; then
            case "$line" in
                *" Accepted"|*" Closing"|*" [2"[0-9][0-9]"]: "*|*" [3"[0-9][0-9]"]: "*) ;;
                *) printf '%s\n' "$line" ;;
            esac
        else
            case "$line" in
                *"[LỖI]"*) printf '[realtime] %s\n' "$line" ;;
                "["[0-9][0-9][0-9][0-9]-*) ;;
                *) printf '[realtime] %s\n' "$line" ;;
            esac
        fi
        n=$((n + 1))
        if [ $((n % 2000)) -eq 0 ] && [ "$(wc -c < "$logf" 2>/dev/null || echo 0)" -gt 5000000 ]; then
            : > "$logf" 2>/dev/null
        fi
    done
}
PHP_ERR="/dev/stderr"
NODE_OUT="$RT_LOG"
FIFO_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jagame_log_XXXXXX" 2>/dev/null)"
if [ -n "$FIFO_DIR" ] && mkfifo "$FIFO_DIR/php.fifo" "$FIFO_DIR/node.fifo" 2>/dev/null; then
    log_filter php "$PHP_LOG" < "$FIFO_DIR/php.fifo" &
    FILTER_PIDS="$!"
    disown $! 2>/dev/null
    log_filter node "$RT_LOG" < "$FIFO_DIR/node.fifo" &
    FILTER_PIDS="$FILTER_PIDS $!"
    disown $! 2>/dev/null
    PHP_ERR="$FIFO_DIR/php.fifo"
    NODE_OUT="$FIFO_DIR/node.fifo"
else
    [ -n "$FIFO_DIR" ] && rm -rf "$FIFO_DIR" 2>/dev/null
    FIFO_DIR=""
    [ "$(wc -c < "$RT_LOG" 2>/dev/null || echo 0)" -gt 5000000 ] && : > "$RT_LOG" 2>/dev/null
fi

# Chạy NỀN rồi chờ (không exec): script biết PID để khi PHP/Node chết hay Ctrl+C thì tắt hết (R5-04).
# PHP chỉ nghe 127.0.0.1 — mọi truy cập từ ngoài đi qua gateway (gateway đặt X-Jagame-Client-IP = IP thật).
# display_errors=0: php.ini Homebrew mặc định display_errors=STDOUT -> cảnh báo "POST Content-Length exceeds…" in vào
# thân phản hồi TRƯỚC khi index.php kịp tắt (S1-SEC-01); lỗi vẫn ghi log (stderr -> server.log).
"$PHP_EXE" \
    -d upload_max_filesize=64M \
    -d post_max_size=70M \
    -d memory_limit=768M \
    -d max_file_uploads=50 \
    -d max_execution_time=300 \
    -d max_input_vars=5000 \
    -d date.timezone=Asia/Ho_Chi_Minh \
    -d expose_php=Off \
    -d display_errors=0 \
    -d log_errors=1 \
    -S "127.0.0.1:$PHP_PORT" router.php 2>"$PHP_ERR" &
PHP_PID=$!

JAGAME_PORT="$PORT" JAGAME_BIND="$BIND" JAGAME_PHP_PORT="$PHP_PORT" JAGAME_WEB_ROOT="$WEB_ROOT" \
    "$NODE_EXE" "$RT_REAL/server.js" >>"$NODE_OUT" 2>&1 &
NODE_PID=$!

# bash 3.2 (macOS) không có "wait -n": hỏi thăm mỗi giây, một trong hai chết thì dọn cái còn lại (cleanup) và thoát.
# 2>/dev/null cho cả vòng: không in "Killed: 9 … node …" của bash khi 1 tiến trình bị giết (đã có thông báo riêng bên dưới).
while kill -0 "$PHP_PID" 2>/dev/null && kill -0 "$NODE_PID" 2>/dev/null; do
    sleep 1
done 2>/dev/null
if ! kill -0 "$PHP_PID" 2>/dev/null; then
    wait "$PHP_PID" 2>/dev/null
    RC=$?
    WHO="PHP"; WHO_LOG="database/server.log"
else
    wait "$NODE_PID" 2>/dev/null
    RC=$?
    WHO="Cổng realtime (Node)"; WHO_LOG="database/realtime.log"
fi
# Đang tắt (Ctrl+C / đóng cửa sổ — tín hiệu tới cả nhóm tiến trình, Node/PHP có thể thoát trước khi bẫy của script chạy) hoặc
# tiến trình con thoát êm vì nhận lệnh tắt (mã 0 / 129 HUP / 130 INT / 143 TERM): không phải lỗi.
if [ -n "$STOPPING" ] || [ "$RC" -eq 0 ] || [ "$RC" -eq 129 ] || [ "$RC" -eq 130 ] || [ "$RC" -eq 143 ]; then
    exit 0
fi
# 75 = Node khởi động lại theo yêu cầu (Cập nhật 1 nút / database/.restart): cha (giám sát ở trên) đổi mã nếu có rồi chạy lại.
[ "$RC" -eq 75 ] && [ -n "$JAGAME_SUPERVISOR" ] && exit 75
echo "[!] $WHO dừng bất thường (mã $RC) — xem $WHO_LOG."
exit "$RC"
