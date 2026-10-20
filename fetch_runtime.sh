#!/bin/bash
# Tải runtime đi kèm gói (người dùng bật lên là chạy, không cài PHP/Node):
#   bash Script/fetch_runtime.sh                 # đúng máy đang chạy
#   bash Script/fetch_runtime.sh darwin arm64    # os = darwin|linux, arch = arm64|x64
#   bash Script/fetch_runtime.sh windows x64     # đóng gói bản Windows từ mac/Linux: node/node.exe + php/ (NTS x64) + php.ini
# Kết quả: Tools/runtime/<os>-<arch>/
#   php            PHP CLI tĩnh (static-php-cli, bộ "common": sqlite3, gd, curl, mbstring, zip, openssl, fileinfo...)
#   node/bin/node  Node.js bản chính thức nodejs.org (LTS) + node/LICENSE
#   cloudflared/cloudflared[.exe]  (CHỈ khi đóng gói = bố cục DEV) bản CF_VER cố định, kiểm SHA-256 theo ghi chú phát hành GitHub
#   php/vcruntime140*.dll          (Windows, CHỈ khi JAGAME_BUNDLE_VCRT=1 — mặc định không kèm) Microsoft VC++ Runtime đặt cạnh php.exe — lấy từ gói embeddable python.org (sha256 theo
#                                  API python.org + chữ ký Authenticode của Microsoft), kèm VCRUNTIME-NOTICE.txt
#   runtime.json                   nguồn + sha256 từng tệp (release.py đối chiếu gói zip; không vào gói)
# Đổi phiên bản: PHP_VER=8.3.32 NODE_VER=24.21.0 CF_VER=2026.10.1 bash Script/fetch_runtime.sh ...  (PHP cùng nguồn/phiên bản với synology/build.sh)
# File tải về giữ ở Tools/runtime/.cache (chạy lại không tải lại). Node được kiểm SHA-256 theo SHASUMS256.txt chính thức.
set -euo pipefail

SDIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SDIR/.." && pwd)"
PHP_VER="${PHP_VER:-8.3.32}"
PHP_FLAVOR="${PHP_FLAVOR:-common}"
NODE_VER="${NODE_VER:-24.21.0}"
NODE_MIN="22.13"
CF_VER="${CF_VER:-2026.10.1}"      # cloudflared (github.com/cloudflare/cloudflared) — cố định để gói tái lập được
PY_EMBED_VER="${PY_EMBED_VER:-3.15.0}"   # nguồn vcruntime140*.dll (python-<ver>-embed-amd64.zip, python.org)

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

# Đóng gói (bố cục DEV, DEST = Tools/runtime/<os>-<arch>) thì kèm cloudflared; bản phát hành tự tải cloudflared ở run_mac.sh như cũ.
PACKAGING=0
[ "$DEST" = "$ROOT/Tools/runtime/$OS-$ARCH" ] && PACKAGING=1

fetch_cloudflared() {  # cloudflared CF_VER đúng hệ điều hành -> $DEST/cloudflared/, kiểm sha256 theo ghi chú phát hành (dòng "<tệp>: <sha>")
    local asset bin rel want
    case "$OS-$ARCH" in
        windows-x64) asset=cloudflared-windows-amd64.exe ;;
        darwin-arm64) asset=cloudflared-darwin-arm64.tgz ;;
        darwin-x64) asset=cloudflared-darwin-amd64.tgz ;;
        linux-x64) asset=cloudflared-linux-amd64 ;;
        linux-arm64) asset=cloudflared-linux-arm64 ;;
    esac
    rel="$CACHE/cloudflared-$CF_VER.release.json"
    CURL_P="-sS" fetch "$rel" "https://api.github.com/repos/cloudflare/cloudflared/releases/tags/$CF_VER"
    want="$(python3 -I -c 'import json,re,sys; b=json.load(open(sys.argv[1])).get("body") or ""; m=re.search(r"^"+re.escape(sys.argv[2])+r":\s*([0-9a-f]{64})\s*$", b, re.M); print(m.group(1) if m else "")' "$rel" "$asset")"
    [ -n "$want" ] || { rm -f "$rel"; echo "[LỖI] ghi chú phát hành cloudflared $CF_VER không có sha256 của $asset"; exit 1; }
    # GitHub cũng ghi "digest" (sha256 của tệp tải về) cho từng asset: có thì kiểm thêm
    local dig
    dig="$(python3 -I -c 'import json,sys; print(next(((a.get("digest") or "").replace("sha256:","") for a in json.load(open(sys.argv[1])).get("assets",[]) if a["name"]==sys.argv[2]), ""))' "$rel" "$asset")"
    FETCH_LABEL="cloudflared $CF_VER ($asset)" fetch "$CACHE/cf-$CF_VER-$asset" "https://github.com/cloudflare/cloudflared/releases/download/$CF_VER/$asset"
    if [ -n "$dig" ] && [ "$dig" != "$(sha256_of "$CACHE/cf-$CF_VER-$asset")" ]; then
        rm -f "$CACHE/cf-$CF_VER-$asset"; echo "[LỖI] SHA-256 của $asset không khớp digest GitHub"; exit 1
    fi
    rm -rf "$DEST/cloudflared"; mkdir -p "$DEST/cloudflared"
    bin="cloudflared"; [ "$OS" = "windows" ] && bin="cloudflared.exe"
    case "$asset" in
        *.tgz) tar -xzf "$CACHE/cf-$CF_VER-$asset" -C "$DEST/cloudflared" cloudflared ;;
        *) cp "$CACHE/cf-$CF_VER-$asset" "$DEST/cloudflared/$bin" ;;
    esac
    # Ghi chú phát hành: với .tgz (macOS) sha256 là của CHƯƠNG TRÌNH bên trong, với tệp trần là của chính tệp -> kiểm trên tệp đã đặt
    if [ "$want" != "$(sha256_of "$DEST/cloudflared/$bin")" ]; then
        rm -rf "$DEST/cloudflared" "$CACHE/cf-$CF_VER-$asset"; echo "[LỖI] SHA-256 của cloudflared ($asset) không khớp ghi chú phát hành"; exit 1
    fi
    chmod 0755 "$DEST/cloudflared/$bin"
    echo "  cloudflared $CF_VER $asset (sha256 ok)"
}

fetch_vcruntime() {  # Windows: vcruntime140.dll + vcruntime140_1.dll cạnh php.exe (PHP vs16/vs17 cần; Node đã liên kết tĩnh CRT)
    local z="python-$PY_EMBED_VER-embed-amd64.zip" meta want
    meta="$CACHE/python-$PY_EMBED_VER-files.json"
    CURL_P="-sS" fetch "$CACHE/python-$PY_EMBED_VER-release.json" "https://www.python.org/api/v2/downloads/release/?name=Python%20$PY_EMBED_VER"
    if [ ! -s "$meta" ]; then
        local id
        id="$(python3 -I -c 'import json,sys; r=json.load(open(sys.argv[1])); print(r[0]["resource_uri"].rstrip("/").rsplit("/",1)[1] if r else "")' "$CACHE/python-$PY_EMBED_VER-release.json")"
        [ -n "$id" ] || { echo "[LỖI] python.org không có bản Python $PY_EMBED_VER"; exit 1; }
        CURL_P="-sS" fetch "$meta" "https://www.python.org/api/v2/downloads/release_file/?release=$id"
    fi
    want="$(python3 -I -c 'import json,sys; print(next((f["sha256_sum"] for f in json.load(open(sys.argv[1])) if f["url"].endswith("/"+sys.argv[2])), ""))' "$meta" "$z")"
    [ -n "$want" ] || { echo "[LỖI] python.org không công bố sha256 cho $z"; exit 1; }
    FETCH_LABEL="VC++ runtime (từ $z)" fetch "$CACHE/$z" "https://www.python.org/ftp/python/$PY_EMBED_VER/$z"
    if [ "$want" != "$(sha256_of "$CACHE/$z")" ]; then rm -f "$CACHE/$z"; echo "[LỖI] SHA-256 của $z không khớp python.org"; exit 1; fi
    unzip -q -o "$CACHE/$z" vcruntime140.dll vcruntime140_1.dll -d "$DEST/php"
    # Chữ ký Authenticode: chứng chỉ ký phải của Microsoft Corporation (đọc PKCS#7 trong bảng chứng chỉ PE bằng openssl)
    local d
    for d in vcruntime140.dll vcruntime140_1.dll; do
        python3 -I - "$DEST/php/$d" <<'PY' || { echo "[LỖI] $d không mang chữ ký Microsoft"; exit 1; }
import struct, subprocess, sys
b = open(sys.argv[1], 'rb').read()
pe = struct.unpack_from('<I', b, 0x3C)[0]; opt = pe + 24
dd = opt + (112 if struct.unpack_from('<H', b, opt)[0] == 0x20B else 96)
off, size = struct.unpack_from('<II', b, dd + 8 * 4)
r = subprocess.run(['openssl', 'pkcs7', '-inform', 'DER', '-print_certs', '-noout'], input=b[off + 8:off + size], capture_output=True)
sys.exit(0 if r.returncode == 0 and b'O=Microsoft Corporation' in r.stdout.replace(b' = ', b'=') else 1)
PY
    done
    local vcver
    vcver="$(python3 -I -c 'import sys; b=open(sys.argv[1],"rb").read(); i=b.find("FileVersion".encode("utf-16-le")); print(b[i+24:i+120].decode("utf-16-le","ignore").split(chr(0))[1] if i>0 else "?")' "$DEST/php/vcruntime140.dll")"
    # QA68: KHÔNG tự diễn đạt quyền phân phối lại — chỉ ghi sự thật (nguồn, sha, chữ ký, phiên bản) + trích NGUYÊN VĂN Microsoft Learn
    cat > "$DEST/php/VCRUNTIME-NOTICE.txt" <<TXT
vcruntime140.dll, vcruntime140_1.dll - Microsoft Visual C++ Runtime, x64, file version $vcver
Copyright (c) Microsoft Corporation. All rights reserved.

These two files are unmodified Microsoft binaries, placed next to php.exe because PHP for
Windows is built with Microsoft Visual C++ and loads them at start-up.
  Obtained from : python-$PY_EMBED_VER-embed-amd64.zip (https://www.python.org/ftp/python/$PY_EMBED_VER/), SHA-256 $want
  Signed by     : Microsoft Corporation (Authenticode, checked at packaging time)

Microsoft's terms for these files, quoted verbatim from "Redistribute Visual C++ Files"
(https://learn.microsoft.com/cpp/windows/redistributing-visual-cpp-files):

  "Distribution of the Visual C++ Runtime Redistributable package, merge modules, and
   individual binaries is limited to licensed Visual Studio users and is subject to
   Microsoft Software License Terms."

  "It's also possible to directly install the Redistributable DLLs in the application
   local folder. The application local folder is the folder that contains your executable
   application file."

The applicable Microsoft Software License Terms ("Distributable Code" section and its
REDIST list) are published at:
  https://visualstudio.microsoft.com/license-terms/
  https://learn.microsoft.com/visualstudio/releases/2022/redistribution#-distributable-code-files-for-visual-studio-2022
TXT
    sed -i.bak 's/$/\r/' "$DEST/php/VCRUNTIME-NOTICE.txt" && rm -f "$DEST/php/VCRUNTIME-NOTICE.txt.bak"
    echo "  vcruntime140.dll + vcruntime140_1.dll (python.org $PY_EMBED_VER, sha256 + chữ ký Microsoft ok)"
}

write_runtime_json() {  # write_runtime_json <khóa=giá trị>...: nguồn + sha256 từng tệp trong $DEST (trừ runtime.json, .unblocked)
    python3 -I - "$DEST" "$@" <<'PY'
import hashlib, json, os, sys
d = sys.argv[1]
info = dict(a.split('=', 1) for a in sys.argv[2:])
files = {}
for dp, dn, fn in os.walk(d):
    dn.sort()
    for f in sorted(fn):
        p = os.path.join(dp, f)
        r = os.path.relpath(p, d).replace(os.sep, '/')
        if r in ('runtime.json',) or f in ('.DS_Store', '.unblocked'):
            continue
        files[r] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
info['files'] = files
json.dump(info, open(os.path.join(d, 'runtime.json'), 'w'), indent=1, sort_keys=True)
PY
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

    # PHP: releases.json của windows.php.net cho tên file + sha256 của bản mới nhất trong dòng $PHP_WIN_SERIES.
    # Mỗi lần dựng thử lấy bản mới (bản vá bảo mật); mất mạng mà đệm còn -> dùng đệm (gói zip PHP cũng nằm trong đệm, không tải lại).
    REL_JSON="$CACHE/php-win-releases.json"
    if curl -fsSL --retry 2 --connect-timeout 15 -o "$REL_JSON.part" https://windows.php.net/downloads/releases/releases.json; then
        mv "$REL_JSON.part" "$REL_JSON"
    else
        rm -f "$REL_JSON.part"
        [ -s "$REL_JSON" ] || { echo "[LỖI] không tải được releases.json của windows.php.net"; exit 1; }
        echo "  [!] không tải được releases.json — dùng bản đệm"
    fi
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
    # cacert.pem (curl/openssl gọi HTTPS tới api.jagame.vn): kiểm sha256 theo curl.se; đệm ở $CACHE (mất mạng -> bản đệm đã kiểm)
    CA="$DEST/php/extras/ssl/cacert.pem"
    CA_C="$CACHE/cacert.pem"
    if curl -fsSL --retry 2 --connect-timeout 15 -o "$CA_C.part" https://curl.se/ca/cacert.pem \
        && CA_WANT="$(curl -fsSL --retry 2 --connect-timeout 15 https://curl.se/ca/cacert.pem.sha256 | awk '{print $1}')" \
        && [ -n "$CA_WANT" ] && [ "$CA_WANT" = "$(sha256_of "$CA_C.part")" ]; then
        mv "$CA_C.part" "$CA_C"
    else
        rm -f "$CA_C.part"
        [ -s "$CA_C" ] || { echo "[LỖI] không tải được cacert.pem (hoặc SHA-256 không khớp)"; exit 1; }
        echo "  [!] không tải/kiểm được cacert.pem mới — dùng bản đệm đã kiểm"
    fi
    cp "$CA_C" "$CA"
    {
        echo 'extension_dir = "ext"'
        for x in $WEXTS; do echo "extension=$x"; done
        printf '%s\n' 'date.timezone = Asia/Ho_Chi_Minh' 'upload_max_filesize = 64M' 'post_max_size = 70M' 'memory_limit = 768M' \
            'max_file_uploads = 50' 'max_input_vars = 5000' 'max_execution_time = 300' 'expose_php = Off' 'display_errors = Off' 'log_errors = On'
    } | sed 's/$/\r/' > "$DEST/php/php.ini"
    echo "  php $PHP_ZNAME (NTS x64, sha256 ok; chưa chạy thử được — cần Windows)"
    # runtime.json: nguồn gốc + sha256 của node.exe theo SHASUMS256.txt chính thức (dòng win-x64/node.exe) — release.py đối chiếu
    # với node.exe TRONG gói zip (cổng goi-tai-ve). Gói tải về không mang tệp này (build_zip chỉ lấy node/ + php/).
    NODE_EXE_SHA="$(awk '$2 == "win-x64/node.exe" { print $1 }' "$NODE_SUMS")"
    [ -n "$NODE_EXE_SHA" ] && [ "$NODE_EXE_SHA" = "$(sha256_of "$DEST/node/node.exe")" ] \
        || { echo "[LỖI] node.exe không khớp dòng win-x64/node.exe trong SHASUMS256.txt"; exit 1; }
    # VC++ DLL kèm gói CHỈ khi JAGAME_BUNDLE_VCRT=1 (lead 20/10: chưa xác nhận giấy phép Visual Studio của người phát hành ->
    # mặc định KHÔNG kèm; run_window.ps1 tự cài VC++ Redistributable chính thức của Microsoft khi máy chưa có)
    if [ "${JAGAME_BUNDLE_VCRT:-0}" = 1 ]; then
        fetch_vcruntime
        VCRT=bundled
    else
        rm -f "$DEST/php/vcruntime140.dll" "$DEST/php/vcruntime140_1.dll" "$DEST/php/VCRUNTIME-NOTICE.txt"
        VCRT=no
        echo "  VC++ DLL: KHÔNG kèm (JAGAME_BUNDLE_VCRT=1 để kèm) — máy thiếu thì run_window.ps1 tự cài vc_redist của Microsoft"
    fi
    [ "$PACKAGING" = 1 ] && fetch_cloudflared
    write_runtime_json "platform=windows-x64" "node=$NODE_VER" "node_exe_sha256=$NODE_EXE_SHA" "php_zip=$PHP_ZNAME" \
        "php_zip_sha256=$PHP_ZSHA" "cloudflared=$([ "$PACKAGING" = 1 ] && echo "$CF_VER")" "vcruntime=$VCRT" \
        "vcruntime_from=$([ "$VCRT" = bundled ] && echo "python-$PY_EMBED_VER-embed-amd64.zip")"
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
if [ "$PACKAGING" = 1 ]; then
    fetch_cloudflared
    # sha256 của bin/node lấy từ CHÍNH tarball đã kiểm theo SHASUMS256.txt (release.py đối chiếu với node trong gói)
    NODE_BIN_SHA="$(tar -xzOf "$NODE_TGZ" "$NODE_NAME/bin/node" | { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; } | cut -d' ' -f1)"
    [ "$NODE_BIN_SHA" = "$(sha256_of "$DEST/node/bin/node")" ] || { echo "[LỖI] node/bin/node khác bản trong $NODE_NAME.tar.gz"; exit 1; }
    write_runtime_json "platform=$OS-$ARCH" "node=$NODE_VER" "node_tgz=$NODE_NAME.tar.gz" "node_tgz_sha256=$WANT" \
        "node_bin_sha256=$NODE_BIN_SHA" "php=$PHP_VER" "php_tgz=$(basename "$PHP_TGZ")" "cloudflared=$CF_VER"
fi
du -sh "$DEST" | awk '{ print "  dung lượng: " $1 }'
