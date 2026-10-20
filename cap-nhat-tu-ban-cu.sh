#!/bin/bash
# Cập nhật Jagame (macOS / Linux): chép DỮ LIỆU từ thư mục jagame CŨ sang thư mục jagame MỚI (thư mục chứa tệp này), rồi chạy
# bản mới. Thư mục cũ KHÔNG bị xóa hay sửa — chạy ổn vài hôm rồi tự xóa nếu muốn.
#   macOS : bấm đúp cap-nhat-tu-ban-cu.command (gọi tệp này)
#   Linux : bash cap-nhat-tu-ban-cu.sh
#   Không hỏi: bash cap-nhat-tu-ban-cu.sh <thư mục cũ> [--yes] [--khong-chay]
# Dữ liệu = database/ (tài khoản, tin nhắn, cài đặt, bản sao lưu), uploads/ (ảnh, nhạc, tệp), games/ (game đã cài),
# cloudflared/ (link xxxx.jagame.vn); thêm runtime/ (PHP + Node đã tải) nếu bản mới chưa có -> khỏi tải lại.

NEW="$(cd "$(dirname "$0")" && pwd -P)"
# Locale không phải UTF-8 -> đặt UTF-8 có sẵn (chỉ cho chữ in ra; việc nhận tiến trình bản cũ KHÔNG so chuỗi đường dẫn — xem mục 2)
case "$(locale charmap 2>/dev/null)" in
    UTF-8|utf8) ;;
    *) L="$(locale -a 2>/dev/null | grep -iE '^(C\.utf-?8|en_US\.utf-?8)$' | head -1)"
       [ -n "$L" ] && export LC_ALL="$L" ;;
esac
DATA_DIRS="database uploads games cloudflared"
OLD_ARG=""
YES=""
NO_RUN=""
for a in "$@"; do
    case "$a" in
        --yes|-y) YES=1 ;;
        --khong-chay|--no-run) NO_RUN=1 ;;
        *) [ -z "$OLD_ARG" ] && OLD_ARG="$a" ;;
    esac
done

say() { printf '%s\n' "$*"; }
die() {
    say ""
    say "[LỖI] $*"
    say "Chưa thay đổi gì ở thư mục cũ."
    exit 1
}
ask_yes() {  # ask_yes <câu hỏi>: Có = 0. --yes -> luôn có.
    [ -n "$YES" ] && return 0
    local ans
    read -r -p "$1 [c/K] " ans
    case "$ans" in c|C|co|có|Có|y|Y|yes) return 0 ;; esac
    return 1
}

say "=============================================="
say "  Jagame — cập nhật từ bản cũ (giữ nguyên dữ liệu)"
say "  Bản MỚI: $NEW"
say "=============================================="
[ -f "$NEW/router.php" ] && [ -f "$NEW/run_mac.sh" ] || die "Tệp này phải nằm trong thư mục jagame MỚI vừa giải nén (cạnh run_mac.sh)."

# ─── 1. Thư mục cũ ───────────────────────────────────────────────────────────
clean_path() {  # bỏ dấu nháy / khoảng trắng thừa / "\ " do kéo thả vào Terminal
    local p="$1"
    p="${p#"${p%%[![:space:]]*}"}"; p="${p%"${p##*[![:space:]]}"}"
    case "$p" in \'*\') p="${p#\'}"; p="${p%\'}" ;; \"*\") p="${p#\"}"; p="${p%\"}" ;; esac
    p="$(printf '%s' "$p" | sed 's/\\\(.\)/\1/g')"
    case "$p" in "~/"*) p="$HOME/${p#\~/}" ;; esac
    printf '%s' "${p%/}"
}
OLD="$OLD_ARG"
while :; do
    if [ -z "$OLD" ]; then
        say ""
        say "Kéo thư mục jagame CŨ (bản đang dùng) vào cửa sổ này rồi nhấn Enter"
        say "(hoặc gõ đường dẫn, ví dụ ~/Downloads/jagame):"
        read -r -p "> " OLD || die "Không đọc được đường dẫn."
    fi
    OLD="$(clean_path "$OLD")"
    if [ -d "$OLD" ] && [ -f "$OLD/router.php" ] && [ -d "$OLD/database" ]; then
        OLD="$(cd "$OLD" && pwd -P)"
        break
    fi
    say "  Không phải thư mục jagame (không thấy router.php + database/ trong: $OLD)."
    [ -n "$OLD_ARG" ] && die "Đường dẫn thư mục cũ không đúng."
    OLD=""
done
[ "$OLD" = "$NEW" ] && die "Đây chính là thư mục MỚI. Hãy kéo thư mục jagame CŨ (bản đang chứa dữ liệu) vào."
case "$NEW/" in "$OLD/"*) die "Thư mục mới đang nằm BÊN TRONG thư mục cũ — hãy giải nén bản mới ra chỗ khác (vd Downloads/jagame-moi)." ;; esac
case "$OLD/" in "$NEW/"*) die "Thư mục cũ nằm bên trong thư mục mới — chọn đúng thư mục jagame cũ." ;; esac
[ -f "$OLD/database/jagame.db" ] || die "Thư mục cũ không có dữ liệu (database/jagame.db) — có thể chọn nhầm thư mục."

ver_of() {  # phiên bản: update.json của gói (app.php đã mã hóa ở bản phát hành), không có thì app.php
    local v
    v="$(sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$1/update.json" 2>/dev/null | head -1)"
    [ -n "$v" ] || v="$(sed -n "s/.*'app_version'[^']*'\([^']*\)'.*/\1/p" "$1/application/config/app.php" 2>/dev/null | head -1)"
    printf '%s' "$v"
}
OLD_VER="$(ver_of "$OLD")"; NEW_VER="$(ver_of "$NEW")"
say ""
say "  Bản cũ : $OLD${OLD_VER:+  (phiên bản $OLD_VER)}"
say "  Bản mới: $NEW${NEW_VER:+  (phiên bản $NEW_VER)}"

# Bản mới đã từng chạy + tạo hội quán riêng -> cất dữ liệu đó sang bên (không xóa) trước khi chép dữ liệu cũ vào.
if [ -f "$NEW/database/jagame.db" ]; then
    say ""
    say "  [!] Bản MỚI đã có dữ liệu riêng (đã chạy thử trước đó)."
    ask_yes "  Thay bằng dữ liệu của bản cũ? (dữ liệu bản mới được cất vào thư mục _du-lieu-ban-moi-<giờ>)" || die "Đã hủy theo yêu cầu."
fi

# ─── 2. Dừng hội quán đang chạy (bản cũ, và bản mới nếu lỡ mở) ─────────────────
# QA68 BUG-01: KHÔNG so chuỗi đường dẫn (locale C: ps/lsof mã hóa byte UTF-8 -> "Bản" thành "BM-aM-:M-#n", không bao giờ khớp ->
# không dừng được bản cũ rồi chép CSDL đang ghi). Nhận ra tiến trình của thư mục bằng:
#   - ai đang MỞ database/jagame.db (lsof <tệp> / /proc/*/fd so thiết bị:inode) — node luôn giữ CSDL mở;
#   - thư mục làm việc = web root, so thiết bị:inode (php -S + node chạy với cwd = web root);
#   - database/.run.pids do run_mac.sh ghi (PID giám sát/con/php/node/cổng).
IS_DARWIN=""; [ "$(uname -s)" = "Darwin" ] && IS_DARWIN=1
path_id() {  # path_id <đường dẫn>: "thiết bị:inode" (theo symlink)
    if [ -n "$IS_DARWIN" ]; then stat -L -f '%d:%i' "$1" 2>/dev/null; else stat -L -c '%d:%i' "$1" 2>/dev/null; fi
}
cwd_id() {  # cwd_id <pid>: thiết bị:inode thư mục làm việc của tiến trình
    if [ -d "/proc/$1" ]; then stat -L -c '%d:%i' "/proc/$1/cwd" 2>/dev/null; return; fi
    command -v lsof >/dev/null 2>&1 || return
    LC_ALL=C lsof -a -p "$1" -d cwd -FDi 2>/dev/null | awk '/^D/{d=substr($0,2)} /^i/{i=substr($0,2)} END{ if (i != "") print d " " i }' |
        { read -r d i && [ -n "$i" ] && printf '%d:%s\n' "$d" "$i"; }
}
file_users() {  # file_users <tệp...>: PID đang mở tệp (so thiết bị:inode — không so chuỗi)
    local f want p fd
    if command -v lsof >/dev/null 2>&1; then
        for f in "$@"; do [ -e "$f" ] && LC_ALL=C lsof -t -- "$f" 2>/dev/null; done | sort -u
        return
    fi
    for f in "$@"; do
        [ -e "$f" ] || continue
        want="$(path_id "$f")"
        for p in /proc/[0-9]*; do
            for fd in "$p"/fd/*; do
                [ "$(stat -L -c '%d:%i' "$fd" 2>/dev/null)" = "$want" ] && { echo "${p#/proc/}"; break; }
            done
        done
    done | sort -u
}
alive() { kill -0 "$1" 2>/dev/null; }
jagame_pids() {  # jagame_pids <thư mục>: PID node + php -S (cwd = thư mục, hoặc đang mở CSDL) + "S<run_mac.sh>" + "K<keepalive>"
    local dir="$1" want pid pp gp pcmd cand="" k v
    want="$(path_id "$dir")"
    [ -n "$want" ] || return 0
    cand="$(file_users "$dir/database/jagame.db" "$dir/database/jagame.db-wal")"
    for pid in $(pgrep -f 'server\.js' 2>/dev/null) $(pgrep -f 'php.* -S [^ ]*:[0-9]+ router\.php' 2>/dev/null); do
        [ "$(cwd_id "$pid")" = "$want" ] && cand="$cand $pid"
    done
    if [ -f "$dir/database/.run.pids" ]; then
        while IFS='=' read -r k v; do
            case "$k" in sup|child) alive "$v" && echo "S$v" ;; php|node) alive "$v" && [ "$(cwd_id "$v")" = "$want" ] && cand="$cand $v" ;; esac
        done < "$dir/database/.run.pids"
    fi
    for pid in $(printf '%s\n' $cand | sort -u); do
        [ "$pid" = "$$" ] && continue
        case "$(ps -o comm= -p "$pid" 2>/dev/null)" in *node*|*php*) ;; *) continue ;; esac
        echo "$pid"
        pp="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
        [ -n "$pp" ] && [ "$pp" != "1" ] || continue
        pcmd="$(LC_ALL=C ps -o command= -p "$pp" 2>/dev/null)"
        case "$pcmd" in *run_mac.sh*) echo "S$pp"
            gp="$(ps -o ppid= -p "$pp" 2>/dev/null | tr -d ' ')"
            case "$(LC_ALL=C ps -o command= -p "$gp" 2>/dev/null)" in
                *run_mac.sh*) echo "S$gp"   # cha giám sát (Cập nhật 1 nút) của run_mac.sh con
                    gp="$(ps -o ppid= -p "$gp" 2>/dev/null | tr -d ' ')"
                    case "$(LC_ALL=C ps -o command= -p "$gp" 2>/dev/null)" in *keepalive_mac.sh*) echo "K$gp" ;; esac ;;
                *keepalive_mac.sh*) echo "K$gp" ;;
            esac ;;
        esac
    done
}
regex_quote() { printf '%s' "$1" | sed 's/[][\.*^$()+?{}|]/\\&/g'; }
stop_tunnel() {  # cloudflared của thư mục: theo web_tunnel.pid (Tunnelrunner ghi), rồi theo dòng lệnh (đường dẫn đã thoát ký tự regex)
    local dir="$1" p
    p="$(cat "$dir/cloudflared/web_tunnel.pid" 2>/dev/null | tr -cd '0-9')"
    if [ -n "$p" ] && alive "$p"; then
        case "$(ps -o comm= -p "$p" 2>/dev/null)" in *cloudflared*) kill "$p" 2>/dev/null ;; esac
    fi
    pkill -f "cloudflared.*$(regex_quote "$dir/cloudflared/jagame-tunnel.yml")" 2>/dev/null
}
still_running() {  # còn tiến trình nào giữ CSDL / đúng thư mục -> in PID
    jagame_pids "$1" | grep -v '^[KS]' | sort -u | tr '\n' ' '
}
stop_dir() {  # stop_dir <thư mục>
    local dir="$1" list k s p i left
    list="$(jagame_pids "$dir")"
    [ -n "$list" ] || { stop_tunnel "$dir"; return 0; }
    say "  Đang dừng hội quán ở $dir ..."
    k="$(printf '%s\n' $list | sed -n 's/^K//p' | sort -u)"
    s="$(printf '%s\n' $list | sed -n 's/^S//p' | sort -u)"
    [ -n "$k" ] && kill $k 2>/dev/null          # keepalive trước (không cho tự bật lại)
    [ -n "$s" ] && kill $s 2>/dev/null          # run_mac.sh tự dọn Node + PHP + cloudflared
    for i in $(seq 1 30); do
        sleep 0.5
        left="$(still_running "$dir")"
        [ -z "${left// /}" ] && break
        [ "$i" -eq 10 ] && kill $left 2>/dev/null
    done
    left="$(still_running "$dir")"
    [ -n "${left// /}" ] && kill -9 $left 2>/dev/null
    stop_tunnel "$dir"
    sleep 0.5
    left="$(still_running "$dir")"
    [ -z "${left// /}" ] || { say "  [!] Vẫn còn tiến trình giữ CSDL: PID $left"; return 1; }
    say "  Đã dừng."
}
say ""
say "1/3  Dừng hội quán đang chạy (nếu có)"
stop_dir "$OLD" || die "Không dừng được hội quán cũ. Đóng cửa sổ Terminal đang chạy Jagame rồi chạy lại tệp này."
stop_dir "$NEW" || die "Không dừng được bản mới đang chạy. Đóng cửa sổ Terminal của nó rồi chạy lại tệp này."
# Chốt chặn: CSDL cũ còn bị mở (bản cũ vẫn chạy / ghi dở) hoặc cổng cũ còn nghe -> TUYỆT ĐỐI không chép (2 hội quán rẽ nhánh dữ liệu).
LEFT="$(file_users "$OLD/database/jagame.db" "$OLD/database/jagame.db-wal" | tr '\n' ' ')"
[ -n "${LEFT// /}" ] && die "Bản cũ VẪN đang chạy (PID ${LEFT% } đang mở database/jagame.db). Đóng cửa sổ Terminal/keepalive của bản cũ rồi chạy lại tệp này. Chưa chép gì."
OLD_PORT="$(tr -cd '0-9' < "$OLD/database/.app_port" 2>/dev/null)"
if [ -n "$OLD_PORT" ] && command -v lsof >/dev/null 2>&1; then
    for pid in $(LC_ALL=C lsof -nP -t -iTCP:"$OLD_PORT" -sTCP:LISTEN 2>/dev/null); do
        [ "$(cwd_id "$pid")" = "$(path_id "$OLD")" ] && die "Bản cũ VẪN đang nghe cổng $OLD_PORT (PID $pid). Đóng cửa sổ của nó rồi chạy lại tệp này. Chưa chép gì."
    done
fi

# ─── 3. Chép dữ liệu (giữ quyền + giờ sửa tệp; cp -R -p trên cả macOS lẫn Linux) ───
say ""
say "2/3  Chép dữ liệu sang bản mới"
STAMP="$(date +%Y%m%d-%H%M%S)"
SIDE="$NEW/_du-lieu-ban-moi-$STAMP"
count_files() { [ -d "$1" ] && find "$1" -type f 2>/dev/null | wc -l | tr -d ' ' || echo 0; }
size_kb() { [ -d "$1" ] && du -sk "$1" 2>/dev/null | awk '{print $1}' || echo 0; }
# Gói theo kiến trúc kèm sẵn cloudflared (bản mới hơn): giữ chương trình CỦA GÓI MỚI, không để bản trong cloudflared/ cũ đè lên.
CF_NEW=""
if [ -f "$NEW/cloudflared/cloudflared" ]; then
    CF_NEW="$NEW/.cloudflared-goi-moi.$$"
    cp -p "$NEW/cloudflared/cloudflared" "$CF_NEW" || CF_NEW=""
fi
# Bản mới có dữ liệu riêng hay không: chốt 1 lần TRƯỚC vòng chép (chép database/ xong thì jagame.db đã có -> các thư mục sau
# từng bị coi nhầm là "dữ liệu bản mới" và bị cất đi — QA68 BUG-07)
HAS_NEW_DB=""; [ -f "$NEW/database/jagame.db" ] && HAS_NEW_DB=1
for d in $DATA_DIRS; do
    [ -d "$OLD/$d" ] || continue
    if [ -n "$HAS_NEW_DB" ] && [ -d "$NEW/$d" ] && [ -n "$(find "$NEW/$d" -type f ! -name .gitkeep ! -name index.html ! -name .htaccess 2>/dev/null | head -1)" ]; then
        mkdir -p "$SIDE" && mv "$NEW/$d" "$SIDE/$d" || die "Không cất được $NEW/$d."
    fi
    mkdir -p "$NEW/$d"
    printf '  %-12s %6s tệp ... ' "$d/" "$(count_files "$OLD/$d")"
    cp -R -p "$OLD/$d/." "$NEW/$d/" || die "Chép $d/ lỗi (ổ đầy hoặc không có quyền?). Thư mục cũ vẫn nguyên."
    say "xong"
done
[ -n "$CF_NEW" ] && mv -f "$CF_NEW" "$NEW/cloudflared/cloudflared"
# runtime/ (PHP + Node đã tải lần trước): chỉ khi gói mới chưa kèm sẵn -> khỏi tải lại ~70 MB.
if [ -d "$OLD/runtime" ] && [ ! -e "$NEW/runtime/node" ]; then
    printf '  %-12s %6s ... ' "runtime/" "PHP+Node"
    mkdir -p "$NEW/runtime"
    cp -R -p "$OLD/runtime/." "$NEW/runtime/" 2>/dev/null && rm -rf "$NEW/runtime/.cache" && say "xong" || say "bỏ qua (bản mới tự tải lại)"
fi
chmod 0700 "$NEW/database" "$NEW/cloudflared" 2>/dev/null

# ─── 4. Kiểm ─────────────────────────────────────────────────────────────────
say ""
say "3/3  Kiểm tra"
BAD=""
for d in $DATA_DIRS; do
    [ -d "$OLD/$d" ] || continue
    a="$(count_files "$OLD/$d")"; b="$(count_files "$NEW/$d")"
    if [ "$b" -lt "$a" ]; then
        say "  [!] $d/: bản cũ $a tệp, bản mới chỉ có $b"
        BAD=1
    else
        say "  $d/: $b tệp, $(size_kb "$NEW/$d") KB — khớp"
    fi
done
cmp -s "$OLD/database/jagame.db" "$NEW/database/jagame.db" || { say "  [!] database/jagame.db khác bản cũ"; BAD=1; }
PHP_CHK=""
for c in "$NEW/runtime/php" "$NEW/runtime/php/php" "$OLD/runtime/php" "$OLD/runtime/php/php" "$(command -v php 2>/dev/null)"; do
    [ -n "$c" ] && [ -f "$c" ] && [ -x "$c" ] && { PHP_CHK="$c"; break; }
done
if [ -n "$PHP_CHK" ]; then
    R="$("$PHP_CHK" -r '$d=new SQLite3($argv[1],SQLITE3_OPEN_READONLY); echo $d->querySingle("PRAGMA integrity_check"), "|", (int)$d->querySingle("SELECT COUNT(*) FROM users");' "$NEW/database/jagame.db" 2>/dev/null)"
    case "$R" in
        ok\|*) say "  Cơ sở dữ liệu: nguyên vẹn, ${R#ok|} tài khoản" ;;
        *) say "  [!] Cơ sở dữ liệu kiểm không đạt: ${R:-không mở được}"; BAD=1 ;;
    esac
elif command -v sqlite3 >/dev/null 2>&1; then
    R="$(sqlite3 -readonly "$NEW/database/jagame.db" 'PRAGMA integrity_check;' 2>/dev/null)"
    [ "$R" = "ok" ] && say "  Cơ sở dữ liệu: nguyên vẹn" || { say "  [!] Cơ sở dữ liệu kiểm không đạt: $R"; BAD=1; }
fi
[ -d "$SIDE" ] && say "  Dữ liệu cũ của bản mới đã cất ở: $SIDE"
if [ -n "$BAD" ]; then
    say ""
    say "[LỖI] Chép chưa trọn vẹn. ĐỪNG xóa thư mục cũ; bản cũ vẫn chạy được như trước (bash \"$OLD/run_mac.sh\")."
    exit 1
fi
say ""
say "Xong! Dữ liệu đã sang bản mới. Thư mục cũ vẫn để nguyên ở:"
say "  $OLD"
say "Dùng bản mới vài hôm thấy ổn rồi hãy xóa thư mục cũ (nhớ: từ nay luôn chạy từ thư mục MỚI)."
if [ -n "$NO_RUN" ]; then
    exit 0
fi
say ""
say "Đang chạy bản mới..."
exec bash "$NEW/run_mac.sh"
