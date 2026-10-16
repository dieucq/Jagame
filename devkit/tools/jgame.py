"""Thư viện dùng chung của kho game Jagame (build.py, verify.py, test_*.py).

Chứa: luật gói .jgame (giới hạn + giải nén an toàn — ĐÚNG luật máy tự host phải áp), kiểm manifest, đóng gói zip
tất định, ký / kiểm chữ ký catalog bằng openssl CLI (không cần pip package).
Chỉ dùng thư viện chuẩn Python 3.8+.
"""
import base64
import hashlib
import io
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 
REPO = os.path.dirname(ROOT)

API_VERSION = 1                       # phiên bản API game cao nhất kho này phát hành
ID_RE = re.compile(r'^[a-z][a-z0-9-]{1,31}$')
SEMVER_RE = re.compile(r'^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$')
GROUPS = {'co': 'Các loại cờ', 'dangian': 'Trò dân gian', 'vui': 'Trò vui cả nhà', 'bai': 'Bài lá'}

# ---- Giới hạn gói (máy tự host kiểm lại y hệt, không tin gói) ----
MAX_ZIP = 20 * 1024 * 1024
MAX_UNZIPPED = 60 * 1024 * 1024
MAX_FILES = 500
MAX_ICON = 200 * 1024
ALLOWED_EXT = {'json', 'js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'ogg', 'm4a', 'woff2', 'txt', 'md'}
SERVER_EXT = {'js', 'json'}
# Mục gốc được phép trong gói; mọi thứ khác trong games/<id>/ (vd test/) là đồ dev, không đóng gói.
PACKAGE_TOP = {'manifest.json', 'icon.svg', 'icon.png', 'client', 'server', 'screenshots', 'README.md', 'LICENSE.md',
               'LICENSE.txt'}
DEV_ONLY = {'store.json', 'CHANGELOG.md', 'LICENSE'}   # siêu dữ liệu kho + tài liệu dev trong games/<id>/ — KHÔNG vào gói
JUNK = {'.DS_Store', 'Thumbs.db', 'desktop.ini'}
ZIP_DATE = (1980, 1, 1, 0, 0, 0)       # mtime cố định -> zip tất định


class StoreError(Exception):
    """Lỗi kiểm tra / đóng gói (thông điệp tiếng Việt, in thẳng cho người phát hành)."""


# ---------------------------------------------------------------- tiện ích
def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def semver_tuple(v):
    m = SEMVER_RE.match(v or '')
    if not m:
        raise StoreError('phiên bản "%s" không đúng dạng semver X.Y.Z' % v)
    return tuple(int(x) for x in m.groups())


def ext_of(name):
    base = name.rsplit('/', 1)[-1]
    return base.rsplit('.', 1)[-1].lower() if '.' in base else ''


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_bytes(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


# ---------------------------------------------------------------- luật tên file trong gói
def check_member_name(name):
    """Trả về lý do từ chối (chuỗi) hoặc None nếu tên an toàn. Dùng chung cho build và giải nén."""
    if not name or '\x00' in name:
        return 'tên rỗng / có ký tự NUL'
    if '\\' in name:
        return 'có dấu \\'
    if name.startswith('/') or re.match(r'^[A-Za-z]:', name):
        return 'đường dẫn tuyệt đối'
    if len(name) > 200:
        return 'tên quá dài'
    parts = name.split('/')
    for p in parts:
        if p in ('', '.', '..'):
            return 'đoạn đường dẫn rỗng / "." / ".."'
        if p.startswith('.'):
            return 'tên ẩn (bắt đầu bằng ".")'
        if not re.match(r'^[A-Za-z0-9._@+-]+$', p):
            return 'ký tự không cho phép (chỉ A-Z a-z 0-9 . _ - @ +)'
    ext = ext_of(name)
    if ext not in ALLOWED_EXT:
        return 'đuôi ".%s" không cho phép' % ext
    if parts[0] == 'server' and ext not in SERVER_EXT:
        return 'server/ chỉ được chứa .js/.json'
    if len(parts) == 1 and name not in PACKAGE_TOP:
        return 'file gốc không thuộc danh sách cho phép'
    if len(parts) > 1 and parts[0] not in PACKAGE_TOP:
        return 'thư mục gốc "%s" không cho phép' % parts[0]
    return None


# ---------------------------------------------------------------- manifest
def validate_manifest(m, folder_id=None, need_package=True):
    """Kiểm manifest; ném StoreError. need_package=False cho game "soon" (chỉ thông tin + icon)."""
    errs = []

    def req(key, typ):
        if key not in m:
            errs.append('thiếu "%s"' % key)
            return False
        if not isinstance(m[key], typ) or isinstance(m[key], bool) and typ is not bool:
            errs.append('"%s" sai kiểu' % key)
            return False
        return True

    if req('id', str) and not ID_RE.match(m['id']):
        errs.append('id "%s" phải khớp ^[a-z][a-z0-9-]{1,31}$' % m['id'])
    if folder_id is not None and m.get('id') != folder_id:
        errs.append('id "%s" khác tên thư mục "%s"' % (m.get('id'), folder_id))
    if req('name', str) and not (1 <= len(m['name']) <= 40):
        errs.append('name dài 1–40 ký tự')
    if req('group', str) and m['group'] not in GROUPS:
        errs.append('group phải là một trong %s' % ', '.join(GROUPS))
    if 'color' in m and not (isinstance(m['color'], str) and re.fullmatch(r'#[0-9a-fA-F]{6}', m['color'])):
        errs.append('color (tùy chọn) phải dạng #rrggbb')
    if req('desc', str) and not (1 <= len(m['desc']) <= 160):
        errs.append('desc dài 1–160 ký tự')
    if req('players', dict):
        p = m['players']
        if not (isinstance(p.get('min'), int) and isinstance(p.get('max'), int) and 1 <= p['min'] <= p['max'] <= 50):
            errs.append('players phải là {"min": n, "max": n} với 1 ≤ min ≤ max ≤ 50')
    if req('age', int) and not (3 <= m['age'] <= 18):
        errs.append('age (độ tuổi tối thiểu) trong 3–18')
    if 'tags' in m and not (isinstance(m['tags'], list) and all(isinstance(t, str) and len(t) <= 24 for t in m['tags'])
                            and len(m['tags']) <= 8):
        errs.append('tags là mảng ≤ 8 chuỗi ngắn')
    if req('icon', str) and m['icon'] not in ('icon.svg', 'icon.png'):
        errs.append('icon phải là "icon.svg" hoặc "icon.png"')
    if 'howto' in m and not (isinstance(m['howto'], list) and all(isinstance(t, str) for t in m['howto'])):
        errs.append('howto là mảng chuỗi')
    for flag in ('soon', 'unlisted', 'spectators', 'bot', 'undo'):
        if flag in m and not isinstance(m[flag], bool):
            errs.append('"%s" phải là true/false' % flag)
    # Đồng hồ cờ do KHUNG giữ (khung Jagame): true = bộ mốc mặc định, hoặc mảng 1–8 mốc "phút+giây" (phút 1–180, giây 0–60).
    if 'clock' in m and m['clock'] is not True:
        ok = isinstance(m['clock'], list) and 1 <= len(m['clock']) <= 8 and len(set(m['clock'])) == len(m['clock'])
        if ok:
            for c in m['clock']:
                mm = re.fullmatch(r'(\d{1,3})\+(\d{1,2})', str(c))
                if not isinstance(c, str) or not mm or not (1 <= int(mm.group(1)) <= 180 and int(mm.group(2)) <= 60):
                    ok = False
                    break
        if not ok:
            errs.append('clock phải là true hoặc mảng 1–8 mốc "phút+giây" (vd "3+2", phút 1–180, giây 0–60)')
    if 'sdk' in m and m['sdk'] not in SDK_VERSIONS:
        errs.append('sdk phải là "2" (giao thức game v2, GAME-PROTOCOL.md) hoặc bỏ trường')
    if 'manifest' in m and m['manifest'] != 2:
        errs.append('manifest (phiên bản định dạng) chỉ nhận 2')
    if 'undo_max' in m and not (isinstance(m['undo_max'], int) and not isinstance(m['undo_max'], bool) and 1 <= m['undo_max'] <= 20):
        errs.append('undo_max trong 1..20')
    # Gợi ý nước 💡 (GAME-BENCHMARK §3.7, khung xử lý): "hint": true (+ hint_max 1..20, mặc định 3); game.js cần hint() hoặc bot() (runner.js kiểm).
    if 'hint' in m and not isinstance(m['hint'], bool):
        errs.append('"hint" phải là true/false')
    if 'hint_max' in m and not (isinstance(m['hint_max'], int) and not isinstance(m['hint_max'], bool) and 1 <= m['hint_max'] <= 20):
        errs.append('hint_max trong 1..20')
    # Hướng dẫn lần đầu (§3.5, play.js vẽ): "tutorial": [bước…] 1..8, bước = chuỗi hoặc {text (1..240), at? (selector ≤ 120), title? (≤ 60)}.
    if 'tutorial' in m:
        steps = m['tutorial'].get('steps') if isinstance(m['tutorial'], dict) else m['tutorial']
        if not (isinstance(steps, list) and 1 <= len(steps) <= 8):
            errs.append('tutorial phải là mảng 1–8 bước')
        else:
            for i, s in enumerate(steps):
                st = {'text': s} if isinstance(s, str) else s
                ok = isinstance(st, dict) and isinstance(st.get('text'), str) and 1 <= len(st['text'].strip()) <= 240
                ok = ok and ('at' not in st or (isinstance(st['at'], str) and 1 <= len(st['at'].strip()) <= 120))
                ok = ok and ('title' not in st or (isinstance(st['title'], str) and 1 <= len(st['title'].strip()) <= 60))
                if not ok:
                    errs.append('tutorial[%d]: cần {text 1–240 ký tự, at? selector ≤ 120, title? ≤ 60}' % i)
                    break

    if need_package:
        if req('version', str):
            try:
                semver_tuple(m['version'])
            except StoreError as e:
                errs.append(str(e))
        if req('api', int) and not (1 <= m['api'] <= API_VERSION):
            errs.append('api phải trong 1..%d' % API_VERSION)
        if req('app_min', str):
            try:
                semver_tuple(m['app_min'])
            except StoreError as e:
                errs.append('app_min: ' + str(e))
        if req('entry', dict):
            e = m['entry']
            if not (isinstance(e.get('client'), str) and e['client'].startswith('client/') and e['client'].endswith('.js')):
                errs.append('entry.client phải là client/….js')
            if not (isinstance(e.get('server'), str) and e['server'].startswith('server/') and e['server'].endswith('.js')):
                errs.append('entry.server phải là server/….js')
            if 'style' in e and not (isinstance(e['style'], str) and e['style'].startswith('client/')
                                     and e['style'].endswith('.css')):
                errs.append('entry.style phải là client/….css')
        if 'options' in m:
            opts = m['options']
            if not isinstance(opts, list):
                errs.append('options là mảng')
            else:
                for o in opts:
                    if not (isinstance(o, dict) and isinstance(o.get('key'), str) and isinstance(o.get('label'), str)
                            and isinstance(o.get('choices'), list) and o['choices'] and o.get('default') in o['choices']):
                        errs.append('mỗi options cần {key, label, choices[], default ∈ choices}')
                        break
        if 'tick_ms' in m and not (isinstance(m['tick_ms'], int) and 100 <= m['tick_ms'] <= 60000):
            errs.append('tick_ms trong 100..60000 (máy bỏ qua tick_ms < 100 — khung Jagame)')
        if 'bot_simultaneous' in m and not isinstance(m['bot_simultaneous'], bool):
            errs.append('"bot_simultaneous" phải là true/false')
        for k in ('changelog', 'author', 'license'):
            if k in m and not isinstance(m[k], str):
                errs.append('"%s" phải là chuỗi' % k)
        if not m.get('changelog'):
            errs.append('thiếu "changelog" (ghi thay đổi của phiên bản này)')
    if errs:
        raise StoreError('manifest %s: %s' % (folder_id or m.get('id', '?'), '; '.join(errs)))


# Máy chủ (khung Jagame ASYNC_RE) TỪ CHỐI nạp game.js có chữ async/await ở bất kỳ đâu — kể cả chú thích/chuỗi.
ASYNC_RE = re.compile(r'\b(?:async|await)\b')


def check_server_source(gdir, m):
    """Kiểm server/game.js như máy chủ thật sẽ kiểm lúc nạp; ném StoreError (gói phom 1.0.0 qua test nhưng máy không nạp)."""
    path = os.path.join(gdir, m['entry']['server'])
    if not os.path.isfile(path):
        raise StoreError('thiếu %s' % m['entry']['server'])
    src = open(path, encoding='utf-8', errors='replace').read()
    if m.get('sdk') is not None:                       # kiểm đúng file máy sẽ nạp: đã gộp SDK
        src = sdk_bundle(gdir, m)[m['entry']['server']].decode('utf-8', 'replace')
    mm = ASYNC_RE.search(src)
    if mm:
        line = src.count('\n', 0, mm.start()) + 1
        raise StoreError('%s dòng %d có chữ "%s" — máy chủ từ chối nạp (luật chơi chạy đồng bộ; bỏ cả trong chú thích)'
                         % (m['entry']['server'], line, mm.group(0)))
    if len(src.encode('utf-8')) > 1024 * 1024:
        raise StoreError('%s lớn quá 1 MB' % m['entry']['server'])


# ---------------------------------------------------------------- đóng gói tất định
def collect_package_files(game_dir, m=None):
    """Danh sách (đường dẫn trong gói, đường dẫn đĩa) đã sắp xếp. Từ chối symlink, tên ẩn, đuôi lạ.

    m (manifest) có "sdk": "2" -> mục entry.server / entry.client thành bộ 3 (rel, path, bytes đã GỘP SDK) — xem sdk_bundle().
    Không truyền m hoặc game không khai sdk -> y như cũ (bộ 2, byte gói không đổi: sổ phát hành bất biến)."""
    out = []
    for top in sorted(os.listdir(game_dir)):
        if top in JUNK or top in DEV_ONLY:
            continue
        full_top = os.path.join(game_dir, top)
        if top not in PACKAGE_TOP:
            if top == 'test' and os.path.isdir(full_top) and not os.path.islink(full_top):
                continue                                  # ca kiểm thử của dev, không đóng gói
            raise StoreError('%s: "%s" không được phép ở gốc game (chỉ %s, test/)'
                             % (os.path.basename(game_dir), top, ', '.join(sorted(PACKAGE_TOP))))
        if os.path.islink(full_top) or not os.path.isdir(full_top):
            paths = [full_top]
        else:
            paths = []
            for dirpath, dirnames, filenames in os.walk(full_top, followlinks=False):
                for d in dirnames:
                    if os.path.islink(os.path.join(dirpath, d)):
                        raise StoreError('symlink không được phép: %s' % os.path.join(dirpath, d))
                dirnames.sort()
                paths += [os.path.join(dirpath, f) for f in sorted(filenames) if f not in JUNK]
        for path in paths:
            if os.path.islink(path):
                raise StoreError('symlink không được phép: %s' % path)
            if not stat.S_ISREG(os.lstat(path).st_mode):
                raise StoreError('không phải file thường: %s' % path)
            rel = os.path.relpath(path, game_dir).replace(os.sep, '/')
            why = check_member_name(rel)
            if why:
                raise StoreError('%s: %s (%s)' % (os.path.basename(game_dir), rel, why))
            out.append((rel, path))
    out.sort(key=lambda x: x[0])
    if m is not None and m.get('sdk') is not None:
        bundled = sdk_bundle(game_dir, m)
        out = [(e[0], e[1], bundled[e[0]]) if e[0] in bundled else e for e in out]
    return out


# ---------------------------------------------------------------- SDK v2 (GAME-PROTOCOL.md mục SDK)
SDK_VERSIONS = ('2',)
SDK_DIR = os.path.join(ROOT, 'shared', 'sdk')        # = <thư mục công cụ>/../shared/sdk (devkit giữ đúng bố cục này)
SDK_SEP = '\n/* ===== %s (mã game) ===== */\n'


def _file_data(entry):
    """Nội dung 1 mục gói: bộ 3 (rel, path, bytes) dùng bytes đã gộp, bộ 2 đọc đĩa."""
    if len(entry) > 2:
        return entry[2]
    with open(entry[1], 'rb') as f:
        return f.read()


def sdk_bundle(game_dir, m, sdk_dir=None):
    """{rel: bytes} của entry.server (+ entry.client) đã chèn SDK lên đầu — ĐÚNG byte như shared/sdk/bundle.js (Node).

    server: "'use strict';\n" + jg-core.js + SDK_SEP(entry) + game.js   ·   client: jg-ui.js + SDK_SEP(entry) + index.js
    """
    sdk = m.get('sdk')
    if sdk not in SDK_VERSIONS:
        raise StoreError('manifest "sdk" phải là một trong %s' % ', '.join('"%s"' % v for v in SDK_VERSIONS))
    base = sdk_dir or SDK_DIR
    out = {}
    for key, lib, head in (('server', os.path.join(base, 'server', 'jg-core.js'), b"'use strict';\n"),
                           ('client', os.path.join(base, 'client', 'jg-ui.js'), b'')):
        rel = m['entry'][key]
        with open(lib, 'rb') as f:
            libb = f.read()
        with open(os.path.join(game_dir, *rel.split('/')), 'rb') as f:
            src = f.read()
        out[rel] = head + libb + (SDK_SEP % rel).encode('utf-8') + src
    return out


def source_hash(files):
    """sha256 của cây nguồn (tên + nội dung) — để biết mã nguồn có đổi so với bản đã phát hành."""
    h = hashlib.sha256()
    for e in files:
        rel, data = e[0], _file_data(e)
        h.update(rel.encode('utf-8') + b'\x00' + str(len(data)).encode() + b'\x00' + data)
    return h.hexdigest()


def pack(files):
    """Zip tất định: thứ tự theo tên, mtime 1980-01-01, quyền 0644, deflate mức 9, không mục thư mục."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for e in files:
            rel, data = e[0], _file_data(e)
            zi = zipfile.ZipInfo(rel, date_time=ZIP_DATE)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.create_system = 3
            zi.external_attr = (0o100644 & 0xFFFF) << 16
            zi.flag_bits |= 0x800                         # tên UTF-8
            z.writestr(zi, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return buf.getvalue()


def check_limits(files):
    total = sum(len(e[2]) if len(e) > 2 else os.path.getsize(e[1]) for e in files)
    if len(files) > MAX_FILES:
        raise StoreError('quá %d file' % MAX_FILES)
    if total > MAX_UNZIPPED:
        raise StoreError('tổng dung lượng giải nén %d B > %d B' % (total, MAX_UNZIPPED))


# ---------------------------------------------------------------- giải nén an toàn (luật của máy)
def safe_extract(zip_bytes, dest=None, expect_id=None, expect_version=None):
    """Kiểm + (tùy chọn) giải nén gói .jgame theo ĐÚNG luật máy tự host. Trả về manifest (dict).

    Luật: ≤ 20 MB nén, ≤ 500 mục, tổng giải nén THỰC TẾ ≤ 60 MB (đếm khi đọc, không tin header), chỉ phương thức
    stored/deflate, không mã hóa, không symlink / mục đặc biệt, tên theo check_member_name(), không trùng tên (kể cả
    khác hoa/thường), có manifest.json hợp lệ khớp id/version, các file entry/icon tồn tại.
    """
    if len(zip_bytes) > MAX_ZIP:
        raise StoreError('gói %d B > %d B' % (len(zip_bytes), MAX_ZIP))
    try:
        z = zipfile.ZipFile(io.BytesIO(zip_bytes))
        infos = z.infolist()
    except zipfile.BadZipFile as e:
        raise StoreError('không phải zip hợp lệ: %s' % e)
    if len(infos) > MAX_FILES:
        raise StoreError('quá %d mục' % MAX_FILES)
    seen = set()
    total = 0
    contents = {}
    for zi in infos:
        name = zi.filename
        if name.endswith('/'):
            if zi.file_size:
                raise StoreError('mục thư mục có dữ liệu: %s' % name)
            why = check_member_name(name.rstrip('/') + '/x.txt')  # chỉ kiểm phần đường dẫn
            if why and 'đuôi' not in why:
                raise StoreError('thư mục không an toàn %r: %s' % (name, why))
            continue                                      # mục thư mục: bỏ qua
        why = check_member_name(name)
        if why:
            raise StoreError('tên không an toàn %r: %s' % (name, why))
        mode = (zi.external_attr >> 16) & 0o170000
        if zi.create_system == 3 and mode not in (0, stat.S_IFREG):
            raise StoreError('mục không phải file thường (symlink/thiết bị): %s' % name)
        if zi.flag_bits & 0x1:
            raise StoreError('mục mã hóa: %s' % name)
        if zi.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise StoreError('phương thức nén không cho phép: %s' % name)
        key = name.lower()
        if key in seen:
            raise StoreError('trùng tên (không phân biệt hoa/thường): %s' % name)
        seen.add(key)
        data = bytearray()
        with z.open(zi) as f:
            while True:
                chunk = f.read(1 << 16)
                if not chunk:
                    break
                data += chunk
                total += len(chunk)
                if total > MAX_UNZIPPED:
                    raise StoreError('giải nén vượt %d B' % MAX_UNZIPPED)
        contents[name] = bytes(data)
    if 'manifest.json' not in contents:
        raise StoreError('thiếu manifest.json ở gốc gói')
    try:
        m = json.loads(contents['manifest.json'].decode('utf-8'))
    except (ValueError, UnicodeDecodeError) as e:
        raise StoreError('manifest.json không đọc được: %s' % e)
    if not isinstance(m, dict):
        raise StoreError('manifest.json phải là object')
    validate_manifest(m, folder_id=expect_id)
    if m.get('soon') or m.get('unlisted'):
        raise StoreError('gói không được đánh dấu soon/unlisted')
    if expect_version is not None and m['version'] != expect_version:
        raise StoreError('version trong gói %s khác catalog %s' % (m['version'], expect_version))
    need = [m['icon'], m['entry']['client'], m['entry']['server']] + ([m['entry']['style']] if 'style' in m['entry'] else [])
    for n in need:
        if n not in contents:
            raise StoreError('gói thiếu file %s (manifest trỏ tới)' % n)
    if len(contents[m['icon']]) > MAX_ICON:
        raise StoreError('icon > %d B' % MAX_ICON)
    if dest:
        for name, data in contents.items():
            target = os.path.realpath(os.path.join(dest, *name.split('/')))
            if not target.startswith(os.path.realpath(dest) + os.sep):
                raise StoreError('thoát khỏi thư mục đích: %s' % name)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'xb') as f:                  # 'x': không ghi đè / không đi theo file có sẵn
                f.write(data)
    return m


# ---------------------------------------------------------------- ký / kiểm chữ ký (openssl CLI)
def _openssl(args, data=None):
    p = subprocess.run(['openssl'] + args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return p.returncode, p.stdout, p.stderr


def pubkey_from_private(key_path):
    """PEM khóa công khai (bytes) suy ra từ khóa riêng; kiểm khóa là EC P-256. Không in khóa riêng."""
    rc, out, err = _openssl(['pkey', '-in', key_path, '-pubout'])
    if rc != 0:
        raise StoreError('không đọc được khóa riêng %s' % key_path)
    rc, txt, _ = _openssl(['pkey', '-pubin', '-noout', '-text'], out)
    if rc != 0 or b'prime256v1' not in txt and b'P-256' not in txt:
        raise StoreError('khóa ký phải là ECDSA P-256 (prime256v1)')
    return out


def normalize_pem(pem):
    if isinstance(pem, bytes):
        pem = pem.decode('ascii', 'replace')
    return ''.join(l.strip() for l in pem.strip().splitlines() if l.strip() and not l.startswith('-----'))


def sign(data, key_path):
    """Chữ ký ECDSA P-256/SHA-256 dạng DER, trả về chuỗi base64 một dòng."""
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, 'data')
        with open(src, 'wb') as f:
            f.write(data)
        rc, sig, err = _openssl(['dgst', '-sha256', '-sign', key_path, src])
        if rc != 0:
            raise StoreError('ký thất bại: %s' % err.decode('utf-8', 'replace').strip())
    return base64.b64encode(sig).decode('ascii')


def verify_sig(data, sig_b64, pub_path):
    """True nếu chữ ký (base64 DER) hợp lệ với khóa công khai PEM."""
    try:
        sig = base64.b64decode(sig_b64.strip(), validate=True)
    except (ValueError, TypeError):
        return False
    with tempfile.TemporaryDirectory() as td:
        src, sp = os.path.join(td, 'data'), os.path.join(td, 'sig')
        with open(src, 'wb') as f:
            f.write(data)
        with open(sp, 'wb') as f:
            f.write(sig)
        rc, out, err = _openssl(['dgst', '-sha256', '-verify', pub_path, '-signature', sp, src])
    return rc == 0 and b'Verified OK' in out


def copy_file(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)


# ---------------------------------------------------------------- MANIFEST v2: JSON Schema chung + luật chéo + icon/ảnh
# shared/sdk/manifest.schema.json là nguồn duy nhất (devkit jagame.js dùng y file này bằng bộ kiểm JS cùng tập con).
SCHEMA_PATH = os.path.join(SDK_DIR, 'manifest.schema.json')
STD_REASONS = set(read_json(os.path.join(SDK_DIR, 'reasons.json'))['reasons'])   # nguồn chung với runner/devkit
REASON_RE = re.compile(r'^[a-z][a-z0-9-]{1,23}$')
MAX_SHOT = 400 * 1024
_SCHEMA = None


def load_schema():
    global _SCHEMA
    if _SCHEMA is None:
        _SCHEMA = read_json(SCHEMA_PATH)
    return _SCHEMA


def _type_ok(v, t):
    if t == 'object':
        return isinstance(v, dict)
    if t == 'array':
        return isinstance(v, list)
    if t == 'string':
        return isinstance(v, str)
    if t == 'boolean':
        return isinstance(v, bool)
    if t == 'integer':
        return isinstance(v, int) and not isinstance(v, bool)
    if t == 'number':
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    return True


def schema_errors(v, sch=None, path='manifest', root=None):
    """Kiểm v theo tập con JSON Schema (xem description của schema). Trả danh sách lỗi tiếng Việt."""
    root = root or load_schema()
    sch = root if sch is None else sch
    if '$ref' in sch:
        sch = root['$defs'][sch['$ref'].split('/')[-1]]
    errs = []
    if 'anyOf' in sch:
        if all(schema_errors(v, s, path, root) for s in sch['anyOf']):
            errs.append('%s: sai dạng (không khớp kiểu nào cho phép)' % path)
        return errs
    if 'const' in sch and v != sch['const'] or 'const' in sch and type(v) is not type(sch['const']):
        return ['%s phải là %s' % (path, json.dumps(sch['const']))]
    if 'enum' in sch and not any(v == e and type(v) is type(e) for e in sch['enum']):
        return ['%s phải là một trong %s' % (path, ', '.join(json.dumps(e, ensure_ascii=False) for e in sch['enum']))]
    if 'type' in sch and not _type_ok(v, sch['type']):
        return ['%s phải kiểu %s' % (path, sch['type'])]
    if isinstance(v, str):
        if 'minLength' in sch and len(v) < sch['minLength'] or 'maxLength' in sch and len(v) > sch['maxLength']:
            errs.append('%s dài %d–%s ký tự' % (path, sch.get('minLength', 0), sch.get('maxLength', '∞')))
        if 'pattern' in sch and not re.search(sch['pattern'], v):
            errs.append('%s sai dạng (%s)' % (path, sch['pattern']))
    if _type_ok(v, 'number'):
        if 'minimum' in sch and v < sch['minimum'] or 'maximum' in sch and v > sch['maximum']:
            errs.append('%s trong %s..%s' % (path, sch.get('minimum', '-∞'), sch.get('maximum', '∞')))
    if isinstance(v, list):
        if 'minItems' in sch and len(v) < sch['minItems'] or 'maxItems' in sch and len(v) > sch['maxItems']:
            errs.append('%s cần %s–%s phần tử' % (path, sch.get('minItems', 0), sch.get('maxItems', '∞')))
        if sch.get('uniqueItems') and len({json.dumps(x, sort_keys=True) for x in v}) != len(v):
            errs.append('%s có phần tử trùng' % path)
        if 'items' in sch:
            for i, x in enumerate(v):
                errs += schema_errors(x, sch['items'], '%s[%d]' % (path, i), root)
    if isinstance(v, dict):
        for k in sch.get('required', []):
            if k not in v:
                errs.append('%s thiếu "%s"' % (path, k))
        if 'maxProperties' in sch and len(v) > sch['maxProperties']:
            errs.append('%s tối đa %d mục' % (path, sch['maxProperties']))
        props = sch.get('properties', {})
        for k, x in v.items():
            if k in props:
                errs += schema_errors(x, props[k], '%s.%s' % (path, k), root)
            elif sch.get('additionalProperties') is False:
                errs.append('%s: trường lạ "%s"' % (path, k))
            elif isinstance(sch.get('additionalProperties'), dict):
                errs += schema_errors(x, sch['additionalProperties'], '%s.%s' % (path, k), root)
    return errs


def mode_of(m):
    """Danh sách mode (turn|simultaneous|realtime|events) — khai trong manifest hoặc suy từ trường v1."""
    md = m.get('mode')
    if md is not None:
        return md if isinstance(md, list) else [md]
    out = []
    if m.get('bot_simultaneous'):
        out.append('simultaneous')
    if m.get('tick_ms'):
        out.append('realtime')
    if (m.get('ui') or {}).get('events'):
        out.append('events')
    return out or ['turn']


def cross_errors(m):
    """Luật chéo schema không diễn tả được."""
    errs = []
    p = m.get('players') or {}
    if isinstance(p.get('min'), int) and isinstance(p.get('max'), int) and p['min'] > p['max']:
        errs.append('players.min > players.max')
    for o in m.get('options') or []:
        if isinstance(o, dict) and isinstance(o.get('choices'), list) and not any(o.get('default') == c and type(c) is type(o.get('default')) for c in o['choices']):
            errs.append('options.%s: default phải thuộc choices' % o.get('key'))
    keys = [o.get('key') for o in m.get('options') or [] if isinstance(o, dict)]
    if len(keys) != len(set(keys)):
        errs.append('options: key trùng')
    md = mode_of(m)
    if 'mode' in m:
        if 'realtime' in md and not m.get('tick_ms'):
            errs.append('mode "realtime" cần tick_ms')
        if m.get('tick_ms') and 'realtime' not in md:
            errs.append('có tick_ms thì mode phải gồm "realtime"')
        if 'events' in md and not (m.get('ui') or {}).get('events'):
            errs.append('mode "events" cần ui.events = true')
        if 'turn' in md and 'simultaneous' in md:
            errs.append('mode không gồm cả "turn" lẫn "simultaneous"')
    if 'action' in md:
        # Game hành động (GAME-PROTOCOL.md): đường chạy riêng — không dùng chung cơ chế theo lượt / tick của khung.
        if len(md) > 1:
            errs.append('mode "action" đứng một mình (không kết hợp turn/simultaneous/realtime/events)')
        for k in ('tick_ms', 'clock', 'undo', 'hint'):
            if m.get(k):
                errs.append('mode "action" không dùng %s' % k)
        a = m.get('action') or {}
        if isinstance(a.get('tick_hz'), int) and isinstance(a.get('send_hz'), int) and a['send_hz'] > a['tick_hz']:
            errs.append('action.send_hz phải ≤ tick_hz')
        for k, r in (a.get('input') or {}).items():
            if not re.match(r'^[a-z][a-z0-9_]{0,15}$', k) or k in ('q', 'ff') or not (isinstance(r, list) and len(r) == 2 and r[0] <= r[1]):
                errs.append('action.input.%s: khóa chữ thường (không q/ff), [min ≤ max]' % k)
    elif m.get('action') is not None:
        errs.append('có "action" thì mode phải là "action"')
    if m.get('clock') and m.get('tick_ms'):
        errs.append('clock (đồng hồ cờ của khung) không dùng cùng tick_ms')
    if m.get('undo_max') is not None and not m.get('undo'):
        errs.append('undo_max chỉ có nghĩa khi undo = true')
    if m.get('hint_max') is not None and not m.get('hint'):
        errs.append('hint_max chỉ có nghĩa khi hint = true')
    for code in (m.get('reasons') or {}):
        if not REASON_RE.match(code):
            errs.append('reasons: mã "%s" phải khớp %s' % (code, REASON_RE.pattern))
        elif code in STD_REASONS:
            errs.append('reasons: "%s" là lý do chuẩn, không khai lại' % code)
    sm = (m.get('session') or {}).get('minutes')
    if isinstance(sm, list) and len(sm) == 2 and sm[0] > sm[1]:
        errs.append('session.minutes [ít nhất, nhiều nhất]')
    if m.get('sdk') is not None and m.get('api') != 1:
        errs.append('sdk "2" chạy trên api 1')
    return errs


def _png_size(data):
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        return None
    return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')


def _jpg_size(data):
    if data[:2] != b'\xff\xd8':
        return None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            return None
        mk = data[i + 1]
        ln = int.from_bytes(data[i + 2:i + 4], 'big')
        if mk in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], 'big'), int.from_bytes(data[i + 5:i + 7], 'big')
        i += 2 + ln
    return None


def _webp_size(data):
    if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        return None
    ch = data[12:16]
    if ch == b'VP8X':
        return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
    if ch == b'VP8 ':
        return int.from_bytes(data[26:28], 'little') & 0x3FFF, int.from_bytes(data[28:30], 'little') & 0x3FFF
    if ch == b'VP8L':
        b = int.from_bytes(data[21:25], 'little')
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    return (0, 0)


def image_size(data, ext):
    """(rộng, cao) đọc từ header, None nếu file không đúng định dạng theo đuôi."""
    return {'png': _png_size, 'jpg': _jpg_size, 'jpeg': _jpg_size, 'webp': _webp_size}.get(ext, lambda d: None)(data)


SVG_BAD = [(re.compile(r'<\s*script', re.I), 'có <script>'),
           (re.compile(r'\son[a-z]+\s*=', re.I), 'có thuộc tính sự kiện on*='),
           (re.compile(r'<\s*foreignObject', re.I), 'có <foreignObject>'),
           (re.compile(r'(?:xlink:)?href\s*=\s*["\'](?!#)', re.I), 'có href trỏ ra ngoài (chỉ cho #id nội bộ)'),
           (re.compile(r'url\(\s*["\']?(?!#)', re.I), 'có url() trỏ ra ngoài'),
           (re.compile(r'<!ENTITY', re.I), 'có <!ENTITY>')]


def svg_errors(data, label):
    import xml.etree.ElementTree as ET
    errs = []
    txt = data.decode('utf-8', 'replace')
    for rx, why in SVG_BAD:
        if rx.search(txt):
            errs.append('%s %s' % (label, why))
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        return errs + ['%s không phải XML hợp lệ (%s) — ảnh sẽ vỡ ở mọi nơi' % (label, e)]
    if not root.tag.endswith('svg'):
        errs.append('%s: phần tử gốc phải là <svg>' % label)
    vb = (root.get('viewBox') or '').replace(',', ' ').split()
    if len(vb) != 4:
        errs.append('%s thiếu viewBox' % label)
    else:
        try:
            w, h = float(vb[2]), float(vb[3])
            if w <= 0 or h <= 0 or abs(w - h) > 0.01 * max(w, h):
                errs.append('%s: viewBox phải vuông (đang %gx%g)' % (label, w, h))
        except ValueError:
            errs.append('%s: viewBox sai số' % label)
    return errs


def asset_errors(gdir, m):
    """Icon + ảnh chụp: tồn tại, đúng định dạng, cỡ chuẩn, SVG an toàn."""
    errs = []
    icon = m.get('icon')
    if isinstance(icon, str) and icon in ('icon.svg', 'icon.png'):
        p = os.path.join(gdir, icon)
        if not os.path.isfile(p):
            errs.append('thiếu %s' % icon)
        else:
            data = open(p, 'rb').read()
            if len(data) > MAX_ICON:
                errs.append('%s > 200 KB' % icon)
            if icon.endswith('.svg'):
                errs += svg_errors(data, icon)
            else:
                sz = image_size(data, 'png')
                if not sz:
                    errs.append('icon.png không phải PNG hợp lệ')
                elif sz[0] != sz[1] or not 256 <= sz[0] <= 1024:
                    errs.append('icon.png phải vuông 256–1024 px (đang %dx%d)' % sz)
    shots = m.get('screenshots')
    listed = shots if isinstance(shots, list) else []
    sdir = os.path.join(gdir, 'screenshots')
    if os.path.isdir(sdir):
        disk = ['screenshots/' + f for f in sorted(os.listdir(sdir)) if f not in JUNK]
        listed = listed or disk
        for rel in disk:
            if ext_of(rel) not in ('png', 'jpg', 'jpeg', 'webp'):
                errs.append('%s: ảnh chụp chỉ png/jpg/webp' % rel)
    for rel in listed:
        p = os.path.join(gdir, *str(rel).split('/'))
        if not os.path.isfile(p):
            errs.append('thiếu ảnh chụp %s' % rel)
            continue
        data = open(p, 'rb').read()
        if len(data) > MAX_SHOT:
            errs.append('%s > 400 KB' % rel)
        sz = image_size(data, ext_of(rel))
        if not sz:
            errs.append('%s không đúng định dạng theo đuôi' % rel)
        elif not (320 <= min(sz) and max(sz) <= 2400):
            errs.append('%s: cạnh phải trong 320–2400 px (đang %dx%d)' % (rel, sz[0], sz[1]))
    return errs


def check_manifest_v2(gdir, m):
    """(lỗi, cảnh báo). Manifest có "manifest": 2 -> lỗi schema/luật chéo là LỖI; v1 -> chỉ cảnh báo. Icon/ảnh: luôn là lỗi."""
    soft = schema_errors(m) + cross_errors(m)
    hard = asset_errors(gdir, m)
    if m.get('manifest') == 2:
        return hard + soft, []
    return hard, soft
