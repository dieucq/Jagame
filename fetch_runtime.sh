#!/bin/bash
# Tải runtime đi kèm gói (người dùng bật lên là chạy, không cài PHP/Node):
#   bash Script/fetch_runtime.sh                 # đúng máy đang chạy
#   bash Script/fetch_runtime.sh darwin arm64    # os = darwin|linux, arch = arm64|x64
#   bash Script/fetch_runtime.sh windows x64     # đóng gói bản Windows từ mac/Linux: node/node.exe + php/ (NTS x64) + php.ini
# Kết quả: Tools/runtime/<os>-<arch>/
#   php            PHP CLI tĩnh (static-php-cli, bộ "common": sqlite3, gd, curl, mbstring, zip, openssl, fileinfo...)
#   node/bin/node  Node.js bản chính thức nodejs.org (LTS) + node/LICENSE
# Đổi phiên bản: PHP_VER=8.3.32 NODE_VER=24.21.0 bash Script/fetch_runtime.sh ...  (PHP cùng nguồn/phiên bản với synology/build.sh)
# File tải về giữ ở Tools/runtime/.cache (chạy lại không tải lại). Node được kiểm SHA-256 theo SHASUMS256.txt chính thức.
set -euo pipefail

SDIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SDIR/.." && pwd)"
PHP_VER="${PHP_VER:-8.3.32}"
PHP_FLAVOR="${PHP_FLAVOR:-common}"
NODE_VER="${NODE_VER:-24.21.0}"
NODE_MIN="22.13"

host_os() { case "$(uname -s)" in Darwin) echo darwin ;; Linux) echo linux ;; *) echo unknown ;; esac; }
host_arch() { case "$(uname -m)" in arm64|aarch64) echo arm64 ;; x86_64|amd64) echo x64 ;; *) echo unknown ;; esac; }
OS="${1:-$(host_os)}"
ARCH="${2:-$(host_arch)}"
case "$OS" in darwin) PHP_OS=macos ;; linux) PHP_OS=linux ;; windows) PHP_OS=windows ;; *) echo "[LỖI] os phải là darwin|linux|windows (nhận: $OS)"; exit 1 ;; esac
[ "$OS" = "windows" ] && [ "$ARCH" != "x64" ] && { echo "[LỖI] Windows chỉ có x64"; exit 1; }
case "$ARCH" in arm64) PHP_ARCH=aarch64 ;; x64) PHP_ARCH=x86_64 ;; *) echo "[LỖI] arch phải là arm64|x64 (nhận: $ARCH)"; exit 1 ;; esac

# Node phải ≥ 22.13 (node:sqlite không cần cờ).
ver_ge() {  # ver_ge <a> <b>: a >= b (so major.minor)
    local a1 a2 b1 b2
    IFS=. read -r a1 a2 _ <<< "$1"; IFS=. read -r b1 b2 _ <<< "$2"
    [ "$a1" -gt "$b1" ] || { [ "$a1" -eq "$b1" ] && [ "$a2" -ge "$b2" ]; }
}
ver_ge "$NODE_VER" "$NODE_MIN" || { echo "[LỖI] NODE_VER=$NODE_VER < $NODE_MIN"; exit 1; }

if [ -f "$SDIR/router.php" ]; then
    # Bản phát hành (phẳng, router.php cùng cấp): runtime/ cạnh run_mac.sh — run_mac.sh tự gọi lần chạy đầu nếu gói chưa kèm.
    DEST="$SDIR/runtime"
    CACHE="$SDIR/runtime/.cache"
else
    DEST="$ROOT/Tools/runtime/$OS-$ARCH"
    CACHE="$ROOT/Tools/runtime/.cache"
fi
mkdir -p "$DEST" "$CACHE"

# QA64 L4: lần chạy đầu trên máy người dùng phải THẤY tiến độ (cửa sổ đứng im vài phút = tưởng treo). Có màn hình -> thanh %
# của curl; chạy trong script/log (không tty) -> im lặng như cũ. FETCH_LABEL = tên hiển thị của tệp đang tải.
CURL_P="-sS"
[ -t 2 ] && CURL_P="--progress-bar"
fetch() {  # fetch <file> <url> [url dự phòng...]: tải nếu chưa có (qua .part: lần lỗi không để lại file hỏng)
    local out="$1" url
    shift
    [ -s "$out" ] && return 0
    for url in "$@"; do
        if [ -n "${FETCH_LABEL:-}" ]; then echo "  Đang tải $FETCH_LABEL ..."; else echo "  tải $url"; fi
        if curl -fL $CURL_P --retry 2 --connect-timeout 15 -o "$out.part" "$url"; then
            mv "$out.part" "$out"
            return 0
        fi
        echo "  [!] không tải được, thử nguồn khác..."
    done
    rm -f "$out.part"
    echo "[LỖI] Không tải được $(basename "$out")"
    exit 1
}
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

echo "== Runtime $OS-$ARCH -> $DEST"

# ─── Windows (đóng gói từ máy khác): node/node.exe + php/ (NTS x64, windows.php.net) ───────────────────────
# Cùng bố cục run_window.ps1 tự tải trên máy Windows: runtime/node/node.exe, runtime/php/{php.exe,*.dll,ext/,php.ini,extras/ssl/cacert.pem}.
if [ "$OS" = "windows" ]; then
    command -v unzip >/dev/null 2>&1 || { echo "[LỖI] cần lệnh unzip"; exit 1; }
    PHP_WIN_SERIES="${PHP_WIN_SERIES:-8.3}"
    WNAME="node-v$NODE_VER-win-x64"
    NODE_ZIP="$CACHE/$WNAME.zip"
    NODE_SUMS="$CACHE/node-v$NODE_VER-SHASUMS256.txt"
    fetch "$NODE_SUMS" "https://nodejs.org/dist/v$NODE_VER/SHASUMS256.txt"
    fetch "$NODE_ZIP" "https://nodejs.org/dist/v$NODE_VER/$WNAME.zip"
    WANT="$(awk -v f="$WNAME.zip" '$2 == f { print $1 }' "$NODE_SUMS")"
    if [ -z "$WANT" ] || [ "$WANT" != "$(sha256_of "$NODE_ZIP")" ]; then
        rm -f "$NODE_ZIP"; echo "[LỖI] SHA-256 của $WNAME.zip không khớp (chạy lại để tải lại)."; exit 1
    fi
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    unzip -q -o "$NODE_ZIP" "$WNAME/node.exe" "$WNAME/LICENSE" -d "$TMP"
    rm -rf "$DEST/node"; mkdir -p "$DEST/node"
    mv "$TMP/$WNAME/node.exe" "$TMP/$WNAME/LICENSE" "$DEST/node/"
    echo "  node v$NODE_VER win-x64 (sha256 ok)"

    # PHP: releases.json của windows.php.net cho tên file + sha256 của bản mới nhất trong dòng $PHP_WIN_SERIES
    REL_JSON="$CACHE/php-win-releases.json"
    rm -f "$REL_JSON"
    fetch "$REL_JSON" "https://windows.php.net/downloads/releases/releases.json"
    PHP_INFO="$(python3 -I - "$REL_JSON" "$PHP_WIN_SERIES" <<'PY'
import json, sys
s = json.load(open(sys.argv[1]))[sys.argv[2]]
b = s.get('nts-vs16-x64') or s['nts-vs17-x64']
print(b['zip']['path'], b['zip']['sha256'])
PY
)"
    PHP_ZNAME="${PHP_INFO%% *}"; PHP_ZSHA="${PHP_INFO##* }"
    [ -n "$PHP_ZNAME" ] || { echo "[LỖI] không đọc được releases.json"; exit 1; }
    PHP_ZIP="$CACHE/$PHP_ZNAME"
    fetch "$PHP_ZIP" "https://windows.php.net/downloads/releases/$PHP_ZNAME" "https://windows.php.net/downloads/releases/archives/$PHP_ZNAME"
    if [ "$PHP_ZSHA" != "$(sha256_of "$PHP_ZIP")" ]; then
        rm -f "$PHP_ZIP"; echo "[LỖI] SHA-256 của $PHP_ZNAME không khớp (chạy lại để tải lại)."; exit 1
    fi
    WEXTS="curl exif fileinfo gd mbstring openssl pdo_sqlite sqlite3 zip"
    PHP_X="$TMP/phpx"; mkdir -p "$PHP_X"
    unzip -q -o "$PHP_ZIP" '*.dll' php.exe license.txt -d "$PHP_X"
    rm -rf "$DEST/php"; mkdir -p "$DEST/php/ext" "$DEST/php/extras/ssl"
    cp "$PHP_X"/*.dll "$PHP_X/php.exe" "$PHP_X/license.txt" "$DEST/php/"
    # DLL không extension nào ở trên cần (intl/enchant/pgsql/sodium/phpdbg + glib kéo theo)
    (cd "$DEST/php" && rm -f icu*.dll php8phpdbg.dll libenchant2.dll libpq.dll libsodium.dll glib-2.dll gmodule-2.dll gobject-2.dll)
    for x in $WEXTS; do cp "$PHP_X/ext/php_$x.dll" "$DEST/php/ext/"; done
    # cacert.pem (curl/openssl gọi HTTPS tới api.jagame.vn): kiểm sha256 theo curl.se
    CA="$DEST/php/extras/ssl/cacert.pem"
    curl -fsSL --retry 2 -o "$CA" https://curl.se/ca/cacert.pem
    CA_WANT="$(curl -fsSL https://curl.se/ca/cacert.pem.sha256 | awk '{print $1}')"
    [ -n "$CA_WANT" ] && [ "$CA_WANT" = "$(sha256_of "$CA")" ] || { echo "[LỖI] SHA-256 cacert.pem không khớp"; exit 1; }
    {
        echo 'extension_dir = "ext"'
        for x in $WEXTS; do echo "extension=$x"; done
        printf '%s\n' 'date.timezone = Asia/Ho_Chi_Minh' 'upload_max_filesize = 64M' 'post_max_size = 70M' 'memory_limit = 768M' \
            'max_file_uploads = 50' 'max_input_vars = 5000' 'max_execution_time = 300' 'expose_php = Off' 'display_errors = Off' 'log_errors = On'
    } | sed 's/$/\r/' > "$DEST/php/php.ini"
    echo "  php $PHP_ZNAME (NTS x64, sha256 ok; chưa chạy thử được — cần Windows)"
    du -sh "$DEST" | awk '{ print "  dung lượng: " $1 }'
    exit 0
fi

# ─── Node.js ────────────────────────────────────────────────────────────────
NODE_NAME="node-v$NODE_VER-$OS-$ARCH"
NODE_TGZ="$CACHE/$NODE_NAME.tar.gz"
NODE_SUMS="$CACHE/node-v$NODE_VER-SHASUMS256.txt"
FETCH_LABEL="mã kiểm SHA-256 của Node" CURL_P="-sS" fetch "$NODE_SUMS" "https://nodejs.org/dist/v$NODE_VER/SHASUMS256.txt"
FETCH_LABEL="[1/2] Node.js $NODE_VER (~55 MB, nodejs.org)" fetch "$NODE_TGZ" "https://nodejs.org/dist/v$NODE_VER/$NODE_NAME.tar.gz"
WANT="$(awk -v f="$NODE_NAME.tar.gz" '$2 == f { print $1 }' "$NODE_SUMS")"
GOT="$(sha256_of "$NODE_TGZ")"
if [ -z "$WANT" ] || [ "$WANT" != "$GOT" ]; then
    rm -f "$NODE_TGZ"
    echo "[LỖI] SHA-256 của $NODE_NAME.tar.gz không khớp (tải lại: chạy lại script)."
    exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Chỉ giữ bin/node + LICENSE (bỏ npm/npx/headers/man ~60 MB: gói phát hành đã có sẵn node_modules).
tar -xzf "$NODE_TGZ" -C "$TMP" "$NODE_NAME/bin/node" "$NODE_NAME/LICENSE"
rm -rf "$DEST/node"
mkdir -p "$DEST/node/bin"
mv "$TMP/$NODE_NAME/bin/node" "$DEST/node/bin/node"
mv "$TMP/$NODE_NAME/LICENSE" "$DEST/node/LICENSE"
chmod 0755 "$DEST/node/bin/node"
echo "  node v$NODE_VER (sha256 ok)"

# ─── PHP CLI tĩnh ───────────────────────────────────────────────────────────
PHP_TGZ="$CACHE/php-$PHP_FLAVOR-$PHP_VER-$PHP_OS-$PHP_ARCH.tar.gz"
# dl.static-php.dev chuyển hướng sang DigitalOcean Spaces (fra1) — một số mạng (đã gặp ở VN) không nối được; bản CDN của
# cùng bucket thì được -> thử lần lượt.
PHP_PATH="static-php-cli/$PHP_FLAVOR/php-$PHP_VER-cli-$PHP_OS-$PHP_ARCH.tar.gz"
FETCH_LABEL="[2/2] PHP $PHP_VER (~15 MB, static-php.dev)" fetch "$PHP_TGZ" "https://dl.static-php.dev/$PHP_PATH" "https://static-php-cli.fra1.cdn.digitaloceanspaces.com/$PHP_PATH"
tar -xzf "$PHP_TGZ" -C "$TMP" php
mv "$TMP/php" "$DEST/php"
chmod 0755 "$DEST/php"
# Bản Linux của static-php-cli nén UPX — chạy được nhưng hay bị antivirus báo nhầm. Có upx thì giải nén luôn.
if [ "$OS" = "linux" ] && command -v upx >/dev/null 2>&1; then
    upx -d -q "$DEST/php" >/dev/null 2>&1 || true
fi
echo "  php $PHP_VER ($PHP_FLAVOR)"

# ─── Kiểm tra (chỉ khi runtime chạy được trên máy này) ──────────────────────
if [ "$OS" = "$(host_os)" ] && [ "$ARCH" = "$(host_arch)" ]; then
    "$DEST/node/bin/node" -e 'require("node:sqlite"); console.log("  node chạy được:", process.version, "(có node:sqlite)")'
    MODS="$("$DEST/php" -n -m)"
    MISSING=""
    for ext in sqlite3 gd curl mbstring zip openssl fileinfo; do
        printf '%s\n' "$MODS" | grep -qi "^$ext\$" || MISSING="$MISSING $ext"
    done
    if [ -n "$MISSING" ]; then
        echo "[LỖI] PHP tĩnh thiếu tiện ích:$MISSING"
        exit 1
    fi
    echo "  php chạy được: $("$DEST/php" -n -r 'echo PHP_VERSION;') (đủ sqlite3 gd curl mbstring zip openssl fileinfo)"
else
    echo "  (khác máy đang chạy — bỏ qua bước chạy thử)"
fi
du -sh "$DEST" | awk '{ print "  dung lượng: " $1 }'
