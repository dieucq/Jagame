#!/usr/bin/env python3
"""Kiểm TỰ ĐỘNG gói nộp của nhà phát triển (cổng nộp PS-2) — chạy trong TIẾN TRÌNH RIÊNG, không bao giờ trong tiến trình web.

    python3 -I tools/check_submission.py --zip <gói.zip> --work <thư mục tạm> --out <report.json> --src-out <thư mục giữ mã>
                                         [--rounds 60] [--timeout 120]
    python3 -I tools/check_submission.py <thư mục game>  [--json <report.json>] [--rounds 120]
        Chế độ THƯ MỤC (bài gửi qua Pull Request `submissions/<id>/`, người viết game tự kiểm trước khi gửi): dựng zip tạm từ thư mục
        rồi chạy đúng các bước dưới + luật bài gửi (tên thư mục = id, có README.md + LICENSE, id không trùng game chính thức,
        không tệp chấm/symlink). In báo cáo dễ đọc, mã thoát 0 = ĐẠT, 1 = TRƯỢT.

Các bước (mỗi bước sinh 1 hoặc nhiều dòng ✓/✗ trong báo cáo, không dừng ở lỗi đầu tiên khi còn kiểm được):
  1. Gói: zip hợp lệ, ≤ 10 MB, ≤ 300 tệp, giải nén AN TOÀN (zip-slip, symlink, tên ẩn/lạ, mã hóa, trùng tên, cỡ giải nén đếm lúc đọc).
  2. Cấu trúc: manifest.json, icon, entry client/server/style, test/cases.json, mục gốc được phép (store.json bị cấm — do admin quản).
  3. Manifest: luật jgame.validate_manifest + JSON Schema/luật chéo (jgame.check_manifest_v2) + id/phiên bản/tác giả/giấy phép.
  4. Quét tĩnh (GAME-SUBMIT §1.5): server (eval, Function, require, process, Date, async/await…), client (fetch, WebSocket,
     localStorage, postMessage, iframe, URL ngoài…), mã nén; cảnh báo (innerHTML, chuỗi entropy cao, từ cấm, ảnh quá lớn).
  5. Kiểm luật chơi rút gọn: tools/runner.js của kho (cases.json + N ván ngẫu nhiên + nước rác + tất định + ≤ 250 ms/lần gọi) chạy
     bằng node trong thư mục tạm, giới hạn thời gian/CPU/bộ nhớ, môi trường sạch, `node --permission` (chặn ghi tệp/tiến trình con)
     nếu node hỗ trợ. CHỈ chạy khi bước 1–4 không có lỗi (mã bị quét tĩnh chặn thì không bao giờ được nạp).
  6. Đóng gói thử tất định: sha256/size gói .jgame.
Mã thoát 0 kể cả khi gói trượt (ok=false trong báo cáo); 2 = lỗi hệ thống.
"""
import argparse
import hashlib
import io
import json
import math
import os
import re
import shutil
import stat
import subprocess
import sys
import time
import unicodedata
import zipfile
try:
    import resource
except ImportError:      # Windows: không có giới hạn tài nguyên kiểu Unix — chỉ còn giới hạn thời gian
    resource = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scan_game  # noqa: E402  (load_jgame + package_source — cùng cách backend dựng gói)

MAX_ZIP = 10 * 1024 * 1024
MAX_FILES = 300
MAX_UNPACKED = 30 * 1024 * 1024
TOP_OK = {'manifest.json', 'icon.svg', 'icon.png', 'client', 'server', 'screenshots', 'README.md', 'LICENSE.md', 'LICENSE.txt',
          'test', 'jagame-submit.json', 'CHANGELOG.md', 'LICENSE'}
EXT_OK = {'json', 'js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'ogg', 'm4a', 'woff2', 'txt', 'md'}
QJS_CALL_MS = 150                 # hạn mỗi lần gọi trong khu cách ly (game Cộng đồng) — GAME-PROTOCOL mục 20
QJS_SLOW_MS = 25                  # vm chậm hơn mức này thì QuickJS dễ chạm hạn
QJS_MAX_SOURCE = 256 * 1024       # server/game.js đã gộp SDK
QJS_MIN_TICK = 250
TEST_EXT = {'json', 'js', 'md', 'txt'}
JUNK = {'.DS_Store', 'Thumbs.db', 'desktop.ini'}
NAME_RE = re.compile(r'^[A-Za-z0-9._@+-]+$')


class Report:
    def __init__(self):
        self.checks = []

    def add(self, group, title, status, detail='', items=None):
        self.checks.append({'group': group, 'title': title, 'status': status, 'detail': detail, 'items': (items or [])[:12]})

    def ok(self, group, title, detail=''):
        self.add(group, title, 'ok', detail)

    def fail(self, group, title, detail='', items=None):
        self.add(group, title, 'fail', detail, items)

    def warn(self, group, title, detail='', items=None):
        self.add(group, title, 'warn', detail, items)

    def n(self, status):
        return sum(1 for c in self.checks if c['status'] == status)


def ext_of(name):
    return name.rsplit('.', 1)[-1].lower() if '.' in name.rsplit('/', 1)[-1] else ''


def member_problem(name):
    """Lý do từ chối tên mục trong zip, hoặc None. Chặt như luật máy hội quán, cho phép thêm test/ và jagame-submit.json."""
    if not name or '\x00' in name:
        return 'tên rỗng / có ký tự NUL'
    if '\\' in name:
        return 'có dấu \\ (đường dẫn kiểu Windows)'
    if name.startswith('/') or re.match(r'^[A-Za-z]:', name):
        return 'đường dẫn tuyệt đối'
    if len(name) > 200:
        return 'tên quá dài'
    if name == 'LICENSE':      # giấy phép không đuôi (chỉ để duyệt, không vào gói phát hành)
        return None
    parts = name.split('/')
    for p in parts:
        if p in ('', '.', '..'):
            return 'đoạn đường dẫn rỗng / "." / ".." (zip-slip)'
        if p.startswith('.'):
            return 'tên ẩn (bắt đầu bằng ".")'
        if not NAME_RE.match(p):
            return 'ký tự không cho phép (chỉ A-Z a-z 0-9 . _ - @ +)'
    ext = ext_of(name)
    if ext not in EXT_OK:
        return 'đuôi ".%s" không cho phép' % ext
    if parts[0] == 'server' and ext not in ('js', 'json'):
        return 'server/ chỉ được chứa .js/.json'
    if parts[0] == 'test' and ext not in TEST_EXT:
        return 'test/ chỉ được chứa .json/.js/.md/.txt'
    if len(parts) == 1 and name not in TOP_OK:
        return 'tệp gốc "%s" không thuộc danh sách cho phép' % name
    if len(parts) > 1 and parts[0] not in TOP_OK:
        return 'thư mục gốc "%s" không cho phép' % parts[0]
    return None


# ───────────────────────────── 1. giải nén an toàn ─────────────────────────────
def safe_unzip(zip_path, dest, rep):
    """Giải nén vào dest; trả True nếu mọi thứ hợp lệ. Mọi lỗi ghi vào rep (nhóm 'Gói nộp')."""
    G = 'Gói nộp'
    size = os.path.getsize(zip_path)
    if size > MAX_ZIP:
        rep.fail(G, 'Cỡ tệp zip', '%.1f MB — tối đa %d MB' % (size / 1048576.0, MAX_ZIP // 1048576))
        return False
    rep.ok(G, 'Cỡ tệp zip', '%.2f MB (tối đa %d MB)' % (size / 1048576.0, MAX_ZIP // 1048576))
    try:
        z = zipfile.ZipFile(zip_path)
        infos = z.infolist()
    except zipfile.BadZipFile as e:
        rep.fail(G, 'Là tệp zip hợp lệ', 'không đọc được zip: %s' % e)
        return False
    rep.ok(G, 'Là tệp zip hợp lệ')
    if len(infos) > MAX_FILES + 60:       # +60: chỗ cho mục thư mục / rác macOS
        rep.fail(G, 'Số tệp', '%d mục — tối đa %d tệp' % (len(infos), MAX_FILES))
        return False
    entries = []
    bad = []
    seen = {}
    for zi in infos:
        name = zi.filename
        base = name.rstrip('/').split('/')[-1]
        if name.startswith('__MACOSX/') or base in JUNK or base.startswith('._'):
            continue
        if name.endswith('/'):
            if zi.file_size:
                bad.append('%s: mục thư mục có dữ liệu' % name)
            continue
        entries.append(zi)
    # bỏ thư mục bọc ngoài (nhiều người nén cả thư mục <id>/)
    names = [zi.filename for zi in entries]
    prefix = ''
    if names and 'manifest.json' not in names:
        tops = {n.split('/', 1)[0] for n in names if '/' in n}
        if len(tops) == 1 and all(n.startswith(next(iter(tops)) + '/') for n in names):
            prefix = next(iter(tops)) + '/'
    total = 0
    plan = []
    for zi in entries:
        rel = zi.filename[len(prefix):] if prefix and zi.filename.startswith(prefix) else zi.filename
        why = member_problem(rel)
        if why:
            bad.append('%s: %s' % (zi.filename, why))
            continue
        mode = (zi.external_attr >> 16) & 0o170000
        if zi.create_system == 3 and mode not in (0, stat.S_IFREG):
            bad.append('%s: không phải tệp thường (symlink/thiết bị)' % zi.filename)
            continue
        if zi.flag_bits & 0x1:
            bad.append('%s: tệp mã hóa' % zi.filename)
            continue
        if zi.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            bad.append('%s: phương thức nén không cho phép' % zi.filename)
            continue
        key = rel.lower()
        if key in seen:
            bad.append('%s: trùng tên với %s (không phân biệt hoa/thường)' % (zi.filename, seen[key]))
            continue
        seen[key] = zi.filename
        plan.append((zi, rel))
    if len(plan) > MAX_FILES:
        bad.append('quá %d tệp (%d)' % (MAX_FILES, len(plan)))
    if bad:
        rep.fail(G, 'Tên tệp & loại mục an toàn', '%d vấn đề — gói bị từ chối, không giải nén' % len(bad), bad)
        return False
    rep.ok(G, 'Tên tệp & loại mục an toàn', '%d tệp; không có "..", đường dẫn tuyệt đối, symlink, tệp ẩn hay mã hóa' % len(plan))
    real_dest = os.path.realpath(dest)
    os.makedirs(dest, exist_ok=True)
    for zi, rel in plan:
        target = os.path.realpath(os.path.join(dest, *rel.split('/')))
        if not target.startswith(real_dest + os.sep):
            rep.fail(G, 'Giải nén', '%s thoát khỏi thư mục đích (zip-slip)' % zi.filename)
            return False
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(zi) as f, open(target, 'xb') as out:
            while True:
                chunk = f.read(1 << 16)
                if not chunk:
                    break
                total += len(chunk)           # đếm lúc đọc, không tin header
                if total > MAX_UNPACKED:
                    rep.fail(G, 'Cỡ sau giải nén', 'vượt %d MB' % (MAX_UNPACKED // 1048576))
                    return False
                out.write(chunk)
    rep.ok(G, 'Cỡ sau giải nén', '%.2f MB (tối đa %d MB)' % (total / 1048576.0, MAX_UNPACKED // 1048576))
    if prefix:
        rep.ok(G, 'Thư mục bọc ngoài', 'tự bỏ thư mục "%s" bên ngoài' % prefix.rstrip('/'))
    return True


# ───────────────────────────── 4. quét tĩnh ─────────────────────────────
def strip_js_comments(src):
    """Bỏ chú thích // và /* */ (giữ nguyên xuống dòng để số dòng không lệch), tôn trọng chuỗi '..' ".." `..`. Bộ tách mức xấp xỉ:
    regex literal chứa dấu nháy có thể làm lệch -> nếu kết thúc khi còn trong chuỗi/chú thích thì trả nguyên bản (quét thô)."""
    out = []
    i, n = 0, len(src)
    state = None
    while i < n:
        c = src[i]
        nx = src[i + 1] if i + 1 < n else ''
        if state is None:
            if c == '/' and nx == '/':
                state = 'line'
                i += 2
                continue
            if c == '/' and nx == '*':
                state = 'block'
                i += 2
                continue
            if c in '\'"`':
                state = c
            out.append(c)
        elif state == 'line':
            if c == '\n':
                state = None
                out.append(c)
        elif state == 'block':
            if c == '*' and nx == '/':
                state = None
                i += 2
                continue
            if c == '\n':
                out.append(c)
        else:   # trong chuỗi
            out.append(c)
            if c == '\\' and i + 1 < n:
                out.append(nx)
                i += 2
                continue
            if c == state or (c == '\n' and state != '`'):
                state = None
        i += 1
    if state in ('block',) or (state is not None and state not in ('line',)):
        return src
    return ''.join(out)


SERVER_RULES = [
    (r'\b(?:async|await)\b', 'async/await (máy chủ từ chối nạp — kể cả trong chú thích)', True),
    (r'\beval\s*\(', 'eval()', False),
    (r'\bnew\s+Function\b|(?<![\w.])Function\s*\(', 'Function(…) tạo mã từ chuỗi', False),
    (r'constructor\s*\.\s*constructor', 'constructor.constructor (đường thoát sandbox)', False),
    (r'__proto__', '__proto__', False),
    (r'\bProxy\b', 'Proxy', False),
    (r'\bReflect\b', 'Reflect', False),
    (r'\bWebAssembly\b', 'WebAssembly', False),
    (r'\b(?:SharedArrayBuffer|Atomics)\b', 'SharedArrayBuffer/Atomics', False),
    (r'\bimport\s*\(|^\s*import\s+[\w{*]', 'import', False),
    (r'\brequire\b', 'require (luật chơi không được nạp module)', False),
    (r'\bprocess\b', 'process (đối tượng Node)', False),
    (r'\bglobalThis\s*\[', 'globalThis[…]', False),
    (r'\bDate\b', 'Date (không tất định — dùng ctx.now)', False),
    (r'\b(?:setTimeout|setInterval)\b', 'setTimeout/setInterval (dùng tick)', False),
    (r'\bPromise\b', 'Promise (luật chơi chạy đồng bộ)', False),
    (r'\b(?:ArrayBuffer|DataView|BigInt|(?:Ui|I)nt(?:8|16|32)Array|Uint8ClampedArray|Float(?:32|64)Array|Big(?:Ui|I)nt64Array)\b',
     'ArrayBuffer/TypedArray/BigInt (khu cách ly không có)', False),
]
CLIENT_RULES = [
    (r'\bfetch\s*\(', 'fetch() — game không được gọi mạng'),
    (r'\bXMLHttpRequest\b', 'XMLHttpRequest'),
    (r'\bWebSocket\b', 'WebSocket'),
    (r'\bEventSource\b', 'EventSource'),
    (r'\bRTCPeerConnection\b', 'RTCPeerConnection'),
    (r'\bsendBeacon\b', 'sendBeacon'),
    (r'document\s*\.\s*cookie', 'document.cookie'),
    (r'\b(?:localStorage|sessionStorage|indexedDB)\b', 'localStorage/sessionStorage/indexedDB (dùng JG.storage)'),
    (r'\bwindow\s*\.\s*(?:parent|top|opener)\b|\b(?:parent|top)\s*\.\s*(?:location|document|postMessage)', 'window.parent/top/opener'),
    (r'\bpostMessage\b', 'postMessage (chỉ khung jg-frame được dùng)'),
    (r'\beval\s*\(', 'eval()'),
    (r'\bnew\s+Function\b|(?<![\w.])Function\s*\(', 'Function(…) tạo mã từ chuỗi'),
    (r'\b(?:setTimeout|setInterval)\s*\(\s*["\'`]', 'setTimeout/setInterval với chuỗi (tương đương eval)'),
    (r'\bimport\s*\(|^\s*import\s+[\w{*]', 'import động / module'),
    (r'\b(?:Worker|SharedWorker)\b', 'Worker'),
    (r'\bserviceWorker\b', 'serviceWorker'),
    (r'\bimportScripts\b', 'importScripts'),
    (r'\bWebAssembly\b', 'WebAssembly'),
    (r'<\s*(?:iframe|object|embed)\b', '<iframe>/<object>/<embed>'),
]
MAGIC = {
    'png': lambda b: b.startswith(b'\x89PNG\r\n\x1a\n'),
    'jpg': lambda b: b.startswith(b'\xff\xd8\xff'), 'jpeg': lambda b: b.startswith(b'\xff\xd8\xff'),
    'gif': lambda b: b[:6] in (b'GIF87a', b'GIF89a'),
    'webp': lambda b: b[:4] == b'RIFF' and b[8:12] == b'WEBP',
    'mp3': lambda b: b[:3] == b'ID3' or (len(b) > 1 and b[0] == 0xFF and (b[1] & 0xE0) == 0xE0),
    'ogg': lambda b: b[:4] == b'OggS',
    'm4a': lambda b: b[4:8] == b'ftyp',
    'woff2': lambda b: b[:4] == b'wOF2',
}
URL_RE = re.compile(r'https?://(?!www\.w3\.org/)[^\s"\'`<>)]+', re.I)


def scan_lines(rx, text, limit=4):
    hits = []
    for m in re.finditer(rx, text, re.M):
        line = text.count('\n', 0, m.start()) + 1
        hits.append(line)
        if len(hits) >= limit:
            break
    return hits


def entropy(s):
    if not s:
        return 0.0
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    return -sum(c / len(s) * math.log(c / len(s), 2) for c in freq.values())


def load_badwords():
    for cand in (os.path.join(os.path.dirname(ROOT), 'Web', 'application', 'config', 'badwords.default.json'),
                 os.path.join(ROOT, 'tools', 'rules', 'badwords.json')):
        try:
            with open(cand, encoding='utf-8') as f:
                return json.load(f).get('words', [])
        except (OSError, ValueError):
            continue
    return []


def fold(s):
    s = unicodedata.normalize('NFD', s.lower().replace('đ', 'd'))
    return ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')


def static_scan(src, files, rep):
    """files: [(rel, abs)]. Trả số lỗi chặn."""
    G = 'Quét tĩnh'
    errors = 0
    texts = {}
    for rel, path in files:
        if ext_of(rel) in ('js', 'css', 'json', 'md', 'txt', 'svg'):
            try:
                texts[rel] = open(path, encoding='utf-8', errors='replace').read()
            except OSError:
                pass
    # --- server
    srv = [(r, t) for r, t in texts.items() if r.startswith('server/') and r.endswith('.js')]
    viol = []
    for rel, t in srv:
        code = t if rel.endswith('.json') else strip_js_comments(t)
        for rx, label, in_comments in SERVER_RULES:
            for ln in scan_lines(rx, t if in_comments else code, 3):
                viol.append('%s dòng %d: %s' % (rel, ln, label))
    if viol:
        errors += len(viol)
        rep.fail(G, 'Mã luật chơi (server/) không dùng API cấm', '%d chỗ vi phạm' % len(viol), viol)
    else:
        rep.ok(G, 'Mã luật chơi (server/) không dùng API cấm', 'không có eval, Function, require, process, Date, async/await…')
    # --- client
    cli = [(r, t) for r, t in texts.items() if r.startswith('client/') and r.endswith('.js')]
    viol = []
    for rel, t in cli:
        code = strip_js_comments(t)
        for rx, label in CLIENT_RULES:
            for ln in scan_lines(rx, code, 3):
                viol.append('%s dòng %d: %s' % (rel, ln, label))
    if viol:
        errors += len(viol)
        rep.fail(G, 'Giao diện (client/) không dùng API cấm', '%d chỗ vi phạm' % len(viol), viol)
    else:
        rep.ok(G, 'Giao diện (client/) không dùng API cấm', 'không có fetch, WebSocket, localStorage, postMessage, iframe, eval…')
    # --- URL ngoài ở mọi tệp văn bản (manifest/README được nhắc tới cũng tính — game không có liên kết ngoài)
    viol = []
    for rel, t in texts.items():
        if rel.startswith('test/') or rel in ('README.md',):
            continue
        for ln in scan_lines(URL_RE.pattern, t, 2):
            viol.append('%s dòng %d: địa chỉ ngoài http(s)://' % (rel, ln))
    if viol:
        errors += len(viol)
        rep.fail(G, 'Không có địa chỉ mạng ngoài (http/https)', '%d chỗ — cấm liên kết ngoài, tải tài nguyên ngoài' % len(viol), viol)
    else:
        rep.ok(G, 'Không có địa chỉ mạng ngoài (http/https)')
    # --- mã nén / khó đọc
    mini = []
    longl = []
    for rel, t in texts.items():
        if ext_of(rel) not in ('js', 'css'):
            continue
        for i, line in enumerate(t.split('\n'), 1):
            if len(line) > 1000:
                mini.append('%s dòng %d: %d ký tự — mã nén (minified)' % (rel, i, len(line)))
                break
            if len(line) > 500:
                longl.append('%s dòng %d: %d ký tự' % (rel, i, len(line)))
                break
    if mini:
        errors += len(mini)
        rep.fail(G, 'Mã đọc được (không nén/làm rối)', 'bắt buộc nộp mã nguồn đọc được', mini)
    else:
        rep.ok(G, 'Mã đọc được (không nén/làm rối)')
    if longl:
        rep.warn(G, 'Dòng rất dài', 'người duyệt sẽ xem kỹ', longl)
    # --- nhị phân phải đúng định dạng theo đuôi; tệp chữ phải là UTF-8 thật (chặn ROM/tệp lạ đổi đuôi)
    fake = []
    for rel, path in files:
        ext = ext_of(rel)
        try:
            with open(path, 'rb') as f:
                head = f.read(16) if ext in MAGIC else f.read()
        except OSError:
            continue
        if ext in MAGIC:
            if not MAGIC[ext](head):
                fake.append('%s: nội dung không phải tệp .%s thật' % (rel, ext))
        elif ext in ('js', 'css', 'json', 'svg', 'md', 'txt') or rel == 'LICENSE':
            try:
                txt = head.decode('utf-8')
                if '\x00' in txt:
                    raise UnicodeDecodeError('utf-8', b'', 0, 1, 'NUL')
            except UnicodeDecodeError:
                fake.append('%s: không phải văn bản UTF-8 (tệp nhị phân đổi đuôi?)' % rel)
    if fake:
        errors += len(fake)
        rep.fail(G, 'Tệp đúng định dạng (không nhị phân lạ / ROM)', '%d tệp' % len(fake), fake)
    else:
        rep.ok(G, 'Tệp đúng định dạng (không nhị phân lạ / ROM)')
    # --- svg phụ trong gói
    svg_bad = []
    jg = scan_game.load_jgame()
    for rel, path in files:
        if ext_of(rel) == 'svg' and rel not in ('icon.svg',):
            try:
                svg_bad += jg.svg_errors(open(path, 'rb').read(), rel) if jg else []
            except Exception:   # noqa: BLE001
                svg_bad.append('%s: không đọc được' % rel)
    svg_bad = [e for e in svg_bad if 'viewBox' not in e]       # SVG phụ không cần vuông
    if svg_bad:
        errors += len(svg_bad)
        rep.fail(G, 'SVG an toàn (không script/sự kiện)', '', svg_bad)
    # --- cảnh báo
    warn = []
    for rel, t in cli:
        for ln in scan_lines(r'\.innerHTML\s*=|insertAdjacentHTML', strip_js_comments(t), 3):
            warn.append('%s dòng %d: innerHTML/insertAdjacentHTML — chắc chắn không dùng dữ liệu từ view chưa escape?' % (rel, ln))
    for rel, t in texts.items():
        if ext_of(rel) != 'js':
            continue
        for m in re.finditer(r'"([^"\n]{80,})"|\'([^\'\n]{80,})\'', t):
            s = m.group(1) or m.group(2)
            if entropy(s) > 5.0 and ' ' not in s:
                warn.append('%s dòng %d: chuỗi dài entropy cao (mã ẩn?)' % (rel, t.count('\n', 0, m.start()) + 1))
                break
    words = load_badwords()
    if words:
        hit = []
        for rel, t in texts.items():
            if rel.startswith('test/') or ext_of(rel) not in ('json', 'js', 'md', 'txt'):
                continue
            low, fl = t.lower(), fold(t)
            for w in words:
                word = str(w.get('word', '')).lower()
                if not word:
                    continue
                mode = w.get('mode', 'loose')
                if mode == 'sub':
                    found = fold(word) in fl
                elif mode == 'exact':
                    found = re.search(r'(?<!\w)' + re.escape(word) + r'(?!\w)', low) is not None
                else:
                    found = re.search(r'(?<!\w)' + re.escape(fold(word)) + r'(?!\w)', fl) is not None
                if found:
                    hit.append('%s: có từ nhạy cảm "%s"' % (rel, word))
                    break
        warn += hit[:5]
    if warn:
        rep.warn(G, 'Cảnh báo cho người duyệt', '%d lưu ý (không chặn nộp)' % len(warn), warn)
    else:
        rep.ok(G, 'Không có cảnh báo cho người duyệt')
    return errors


# ───────────────────────────── 5. kiểm động rút gọn ─────────────────────────────
def find_node():
    env_node = os.environ.get('JAGAME_NODE')
    if env_node and os.path.isfile(env_node) and os.access(env_node, os.X_OK):
        return env_node
    n = shutil.which('node')
    if n:
        return n
    base = os.path.join(os.path.dirname(ROOT), 'Tools', 'runtime')
    if os.path.isdir(base):
        for d in sorted(os.listdir(base)):
            for cand in (os.path.join(base, d, 'node', 'bin', 'node'), os.path.join(base, d, 'node')):
                if os.path.isfile(cand) and os.access(cand, os.X_OK):
                    return cand
    return None


def node_supports_permission(node):
    try:
        r = subprocess.run([node, '--permission', '-e', '0'], capture_output=True, timeout=20)
        return r.returncode == 0
    except Exception:   # noqa: BLE001
        return False


def dynamic_check(jg, srcdir, work, rounds, timeout, rep):
    G = 'Kiểm luật chơi (rút gọn)'
    node = find_node()
    runner = None
    for d in (os.environ.get('JAGAME_TOOLS') or '', HERE):
        if d and os.path.isfile(os.path.join(d, 'runner.js')):
            runner = os.path.join(d, 'runner.js')
            break
    if not node or not runner:
        rep.fail(G, 'Chạy bộ kiểm luật chơi', 'không tìm thấy node hoặc runner.js trên máy chủ kiểm — báo quản trị (không phải lỗi của bạn)')
        return
    tools_dir = os.path.dirname(runner)
    allow = [tools_dir, os.path.join(os.path.dirname(tools_dir), 'shared'), srcdir]
    cmd = [node, '--max-old-space-size=256']
    if node_supports_permission(node):
        cmd.append('--permission')
        for a in allow:
            cmd.append('--allow-fs-read=' + os.path.realpath(a))
        isolated = 'node --permission (chặn ghi tệp, tiến trình con, worker)'
    else:
        isolated = 'KHÔNG có --permission (node cũ) — chỉ giới hạn thời gian/CPU/bộ nhớ'
    cmd += [runner, srcdir, '--rounds', str(rounds), '--seed', '20261006']
    env = {'PATH': os.path.dirname(node) + os.pathsep + '/usr/bin:/bin', 'HOME': work, 'TMPDIR': work, 'LANG': 'C.UTF-8'}

    def limits():
        if resource is None:
            return
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (timeout + 5, timeout + 10))
        resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024, 10 * 1024 * 1024))
        try:
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        except (ValueError, OSError):
            pass

    t0 = time.time()
    try:
        p = subprocess.run(cmd, cwd=work, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           timeout=timeout, preexec_fn=limits if resource is not None else None)
        out = p.stdout.decode('utf-8', 'replace')[-60000:]
        code = p.returncode
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or b'').decode('utf-8', 'replace')[-4000:]
        rep.fail(G, 'Chạy bộ kiểm luật chơi', 'quá %d giây — luật chơi chạy quá chậm hoặc vòng lặp vô hạn' % timeout, out.strip().split('\n')[-6:])
        return
    dur = time.time() - t0
    for secret in (os.path.realpath(srcdir), srcdir, os.path.realpath(work), work, tools_dir):   # không lộ đường dẫn máy chủ kiểm
        out = out.replace(secret, '<game>' if secret in (srcdir, os.path.realpath(srcdir)) else '<kiem>')
    fails = [l.strip() for l in out.split('\n') if re.match(r'^\s+TRƯỢT\s', l)]
    mx = 0.0
    for m in re.finditer(r'max\s+([0-9.]+)\s*ms', out):
        mx = max(mx, float(m.group(1)))
    if code == 0 and not fails and 'KẾT QUẢ: ĐẠT' in out:
        rep.ok(G, 'Ca kiểm + ván ngẫu nhiên + nước rác + tất định', 'ĐẠT — %d ván ngẫu nhiên, lần gọi chậm nhất %.1f ms (giới hạn 250 ms), %.1f giây' % (rounds, mx, dur))
        rep.ok(G, 'Môi trường kiểm', isolated)
        if mx > QJS_SLOW_MS:
            rep.warn(G, 'Tốc độ trong khu cách ly', 'lần gọi chậm nhất %.1f ms — game Cộng đồng chạy trong QuickJS chậm hơn 4–30 lần, hạn %d ms/lần '
                     '(bot/hint 250 ms): giới hạn độ sâu tìm kiếm của bot' % (mx, QJS_CALL_MS))
    else:
        tail = fails or [l for l in out.strip().split('\n')[-8:] if l.strip()]
        rep.fail(G, 'Ca kiểm + ván ngẫu nhiên + nước rác + tất định', '%d lỗi (mã thoát %d)' % (len(fails), code), tail)


def isolation_limits(jg, m, pf, rep):
    """Giới hạn khu cách ly (game Cộng đồng chạy QuickJS) — GAME-PROTOCOL mục 20. Trả False nếu có lỗi chặn."""
    G = 'Khu cách ly (game Cộng đồng)'
    bad = []
    srv = m['entry']['server']
    size = 0
    for e in pf:
        if e[0] == srv:
            size = len(jg._file_data(e))
    if size > QJS_MAX_SOURCE:
        bad.append('%s sau khi gộp SDK là %d KB — tối đa %d KB' % (srv, size // 1024, QJS_MAX_SOURCE // 1024))
    modes = m.get('mode') if isinstance(m.get('mode'), list) else [m.get('mode')]
    if 'action' in modes or m.get('action'):
        bad.append('game hành động (mode "action") chưa chạy được trong khu cách ly — chỉ game chính thức')
    if bad:
        rep.fail(G, 'Giới hạn khu cách ly', '%d lỗi' % len(bad), bad)
        return False
    rep.ok(G, 'Giới hạn khu cách ly', 'server/game.js (đã gộp SDK) %d KB / %d KB, không phải game hành động' % (size // 1024, QJS_MAX_SOURCE // 1024))
    tick = m.get('tick_ms')
    if isinstance(tick, int) and tick < QJS_MIN_TICK:
        rep.warn(G, 'Nhịp tick', 'tick_ms %d < %d — khu cách ly tự nâng lên %d ms, game phải chạy đúng ở nhịp đó' % (tick, QJS_MIN_TICK, QJS_MIN_TICK))
    return True


# ───────────────────────────── chế độ thư mục (bài gửi qua Pull Request) ─────────────────────────────
ID_RE = re.compile(r'^[a-z][a-z0-9-]{1,31}$')


def official_ids():
    """Id game CHÍNH THỨC (không được trùng). Devkit: tools/official_ids.json. Kho: mọi games/<id>/ có store.json tier official hoặc
    không có store.json (game nội bộ). Game cộng đồng đã nhận (tier community) không tính — tác giả gửi bản cập nhật cùng id."""
    lst = os.path.join(HERE, 'official_ids.json')
    if os.path.isfile(lst):
        try:
            with open(lst, encoding='utf-8') as f:
                return set(str(x) for x in json.load(f).get('ids', []))
        except (OSError, ValueError):
            return set()
    ids = set()
    gdir = os.path.join(ROOT, 'games')
    if os.path.isdir(gdir):
        for g in os.listdir(gdir):
            if not os.path.isfile(os.path.join(gdir, g, 'manifest.json')):
                continue
            tier = 'official'
            try:
                with open(os.path.join(gdir, g, 'store.json'), encoding='utf-8') as f:
                    tier = json.load(f).get('tier', 'official')
            except (OSError, ValueError):
                pass
            if tier == 'official':
                ids.add(g)
    return ids


def dir_to_zip(src, zip_path, rep):
    """Đóng thư mục bài gửi thành zip tạm (để đi đúng đường kiểm của gói zip). Chặn symlink + tệp/thư mục chấm."""
    G = 'Thư mục gửi'
    gid = os.path.basename(os.path.normpath(src))
    bad, skipped, files = [], [], []
    for dp, dns, fns in os.walk(src, followlinks=False):
        for d in sorted(dns):
            p = os.path.join(dp, d)
            rel = os.path.relpath(p, src).replace(os.sep, '/')
            if os.path.islink(p):
                bad.append('%s/: là symlink' % rel)
            elif d.startswith('.'):
                bad.append('%s/: thư mục chấm (ẩn)' % rel)
        dns[:] = sorted(d for d in dns if not d.startswith('.') and not os.path.islink(os.path.join(dp, d)))
        for f in sorted(fns):
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, src).replace(os.sep, '/')
            if os.path.islink(p):
                bad.append('%s: là symlink' % rel)
            elif f in JUNK:
                skipped.append(rel)
            elif f.startswith('.'):
                bad.append('%s: tệp chấm (ẩn)' % rel)
            elif not os.path.isfile(p):
                bad.append('%s: không phải tệp thường' % rel)
            elif rel == gid + '.jgame':
                skipped.append(rel + ' (gói dựng sẵn — kho tự dựng lại từ mã nguồn)')
            else:
                files.append((rel, p))
    if skipped:
        rep.warn(G, 'Bỏ qua khi kiểm', 'không gửi kèm các tệp rác hệ điều hành', skipped)
    if bad:
        rep.fail(G, 'Không symlink, không tệp chấm', '%d mục bị cấm' % len(bad), bad)
        return False
    rep.ok(G, 'Không symlink, không tệp chấm', '%d tệp' % len(files))
    if len(files) > MAX_FILES + 60:
        rep.fail(G, 'Số tệp', '%d tệp — tối đa %d' % (len(files), MAX_FILES))
        return False
    total = 0
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel, p in files:
            total += os.path.getsize(p)
            if total > MAX_UNPACKED:
                rep.fail(G, 'Tổng dung lượng', 'vượt %d MB' % (MAX_UNPACKED // 1048576))
                return False
            z.write(p, rel)
    return True


def submission_rules(src, rep):
    """Luật riêng của bài gửi qua PR: tên thư mục = id hợp lệ, không trùng game chính thức, có README.md + LICENSE."""
    G = 'Thư mục gửi'
    gid = os.path.basename(os.path.normpath(src))
    errs = []
    if not ID_RE.match(gid):
        errs.append('tên thư mục "%s" không phải id hợp lệ (^[a-z][a-z0-9-]{1,31}$)' % gid)
    if gid.startswith(('local-', 'jg-')):
        errs.append('id "%s" dùng tiền tố dành riêng (local-, jg-)' % gid)
    if gid in official_ids():
        errs.append('id "%s" trùng game chính thức của Jagame — đổi id khác' % gid)
    try:
        with open(os.path.join(src, 'manifest.json'), encoding='utf-8') as f:
            mid = json.load(f).get('id')
        if mid != gid:
            errs.append('manifest.json "id" là "%s" nhưng thư mục là submissions/%s/' % (mid, gid))
    except (OSError, ValueError, AttributeError):
        pass    # thiếu / hỏng manifest: bước Cấu trúc + Manifest báo
    if not os.path.isfile(os.path.join(src, 'README.md')):
        errs.append('thiếu README.md (mô tả, luật chơi, tác giả, giấy phép mã + tài sản)')
    if not any(os.path.isfile(os.path.join(src, n)) for n in ('LICENSE', 'LICENSE.md', 'LICENSE.txt')):
        errs.append('thiếu LICENSE (hoặc LICENSE.md / LICENSE.txt)')
    if errs:
        rep.fail(G, 'Đúng quy định bài gửi', '%d lỗi' % len(errs), errs)
    else:
        rep.ok(G, 'Đúng quy định bài gửi', 'submissions/%s/ — id hợp lệ, không trùng game chính thức, có README.md + LICENSE' % gid)


def print_report(res, title):
    mark = {'ok': 'ĐẠT ', 'warn': 'LƯU Ý', 'fail': 'TRƯỢT'}
    print(title)
    group = None
    for c in res['checks']:
        if c['group'] != group:
            group = c['group']
            print('\n[%s]' % group)
        print('  %s  %s%s' % (mark.get(c['status'], c['status']), c['title'], (' — ' + c['detail']) if c['detail'] else ''))
        for it in c['items']:
            print('           · ' + it)
    print('\nKẾT QUẢ: %s — %d lỗi, %d lưu ý' % ('ĐẠT' if res['ok'] else 'TRƯỢT', res['errors'], res['warnings']))


def main_dir(argv):
    ap = argparse.ArgumentParser(description='Tự kiểm 1 thư mục game (bài gửi submissions/<id>/) trước khi mở Pull Request.')
    ap.add_argument('dir')
    ap.add_argument('--json', help='ghi thêm báo cáo JSON')
    ap.add_argument('--jgame', help='ĐẠT thì ghi gói .jgame (đã gộp SDK, CHƯA ký) — để Cài thủ công thử trên hội quán của bạn')
    ap.add_argument('--rounds', type=int, default=120)
    ap.add_argument('--timeout', type=int, default=180)
    a = ap.parse_args(argv)
    import tempfile
    src = os.path.abspath(a.dir)
    rep = Report()
    res = {'ok': False, 'manifest': None, 'files': [], 'sha256': None, 'size': None, 'source_hash': None}
    t0 = time.time()
    root = os.path.realpath(tempfile.mkdtemp(prefix='jg_check_'))   # node --permission so khớp đường dẫn THẬT
    try:
        if os.path.islink(src) or not os.path.isdir(src):
            rep.fail('Thư mục gửi', 'Là thư mục thường', '%s không phải thư mục (hoặc là symlink)' % a.dir)
        else:
            submission_rules(src, rep)
            zp = os.path.join(root, 'submit.zip')
            if dir_to_zip(src, zp, rep):
                jg = scan_game.load_jgame()
                work = os.path.join(root, 'work')
                os.makedirs(work)
                tmp_src = os.path.join(work, 'src')
                if jg is None:
                    rep.fail('Hệ thống', 'Công cụ kiểm', 'không tìm thấy jgame.py cạnh check_submission.py')
                elif safe_unzip(zp, tmp_src, rep):
                    srcdir = os.path.join(root, os.path.basename(os.path.normpath(src)))
                    shutil.move(tmp_src, srcdir)
                    check_source(jg, srcdir, work, a, rep, res)
    except Exception as e:   # noqa: BLE001
        rep.fail('Hệ thống', 'Lỗi bất ngờ khi kiểm', '%s: %s' % (type(e).__name__, e))
    finally:
        shutil.rmtree(root, ignore_errors=True)
    res['checks'] = rep.checks
    res['errors'] = rep.n('fail')
    res['warnings'] = rep.n('warn')
    res['ok'] = rep.n('fail') == 0 and rep.n('ok') > 0
    res['duration_ms'] = int((time.time() - t0) * 1000)
    data = res.pop('_jgame', None)
    print_report(res, 'Kiểm bài gửi: %s' % a.dir)
    if a.jgame and res['ok'] and data:
        with open(a.jgame, 'wb') as f:
            f.write(data)
        print('Gói thử (chưa ký): %s — hội quán nhận ở Cài thủ công khi bật "Cho phép nhập game ngoài kho" (id thành local-<id>).' % a.jgame)
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
    return 0 if res['ok'] else 1


# ───────────────────────────── main ─────────────────────────────
def main():
    if len(sys.argv) > 1 and not sys.argv[1].startswith('-'):
        return main_dir(sys.argv[1:])
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', required=True)
    ap.add_argument('--work', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--src-out', required=True)
    ap.add_argument('--rounds', type=int, default=60)
    ap.add_argument('--timeout', type=int, default=120)
    a = ap.parse_args()
    t0 = time.time()
    rep = Report()
    res = {'ok': False, 'manifest': None, 'files': [], 'sha256': None, 'size': None, 'source_hash': None, 'zip_sha256': None}
    jg = scan_game.load_jgame()
    work = os.path.abspath(a.work)
    srcdir = os.path.abspath(a.src_out)
    try:
        os.makedirs(work, exist_ok=True)
        res['zip_sha256'] = hashlib.sha256(open(a.zip, 'rb').read()).hexdigest()
        if jg is None:
            rep.fail('Hệ thống', 'Công cụ kiểm', 'không tìm thấy jgame.py — báo quản trị')
            raise SystemExit(0)
        tmp_src = os.path.join(work, 'src')
        if safe_unzip(a.zip, tmp_src, rep):
            if os.path.exists(srcdir):
                shutil.rmtree(srcdir)
            os.makedirs(os.path.dirname(srcdir), exist_ok=True)
            shutil.move(tmp_src, srcdir)
            check_source(jg, srcdir, work, a, rep, res)
    except SystemExit:
        pass
    except Exception as e:   # noqa: BLE001  lỗi bất ngờ vẫn ra báo cáo đọc được
        rep.fail('Hệ thống', 'Lỗi bất ngờ khi kiểm', '%s: %s' % (type(e).__name__, e))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    res['checks'] = rep.checks
    res['errors'] = rep.n('fail')
    res['warnings'] = rep.n('warn')
    res['ok'] = rep.n('fail') == 0 and rep.n('ok') > 0
    res['duration_ms'] = int((time.time() - t0) * 1000)
    res.pop('_jgame', None)
    with open(a.out + '.tmp', 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False)
    os.replace(a.out + '.tmp', a.out)
    return 0


def check_source(jg, srcdir, work, a, rep, res):
    S = 'Cấu trúc'
    # jagame-submit.json: biên nhận do devkit sinh — đối chiếu sha256, rồi bỏ khỏi cây nguồn (không phải mã game)
    sub_path = os.path.join(srcdir, 'jagame-submit.json')
    sub = None
    if os.path.isfile(sub_path):
        try:
            sub = json.load(open(sub_path, encoding='utf-8'))
        except ValueError:
            rep.warn(S, 'Biên nhận jagame-submit.json', 'không đọc được — bỏ qua')
        os.remove(sub_path)
    files = []
    for dp, dn, fn in os.walk(srcdir):
        for f in sorted(fn):
            ap_ = os.path.join(dp, f)
            files.append((os.path.relpath(ap_, srcdir).replace(os.sep, '/'), ap_))
    files.sort()
    res['files'] = [{'path': r, 'size': os.path.getsize(p)} for r, p in files]
    if isinstance(sub, dict) and isinstance(sub.get('files'), dict):
        mism = []
        for rel, want in sub['files'].items():
            p = os.path.join(srcdir, *str(rel).split('/'))
            if os.path.isfile(p) and hashlib.sha256(open(p, 'rb').read()).hexdigest() != want:
                mism.append(rel)
        if mism:
            rep.fail(S, 'Biên nhận jagame-submit.json khớp mã', 'sha256 lệch ở %d tệp — gói bị sửa sau khi đóng' % len(mism), mism)
        else:
            rep.ok(S, 'Biên nhận jagame-submit.json khớp mã', 'sha256 mọi tệp khớp biên nhận devkit')
    mpath = os.path.join(srcdir, 'manifest.json')
    if not os.path.isfile(mpath):
        rep.fail(S, 'Có manifest.json ở gốc gói', 'thiếu manifest.json (nén THƯ MỤC GAME, không nén thư mục cha)')
        return
    rep.ok(S, 'Có manifest.json ở gốc gói')
    try:
        m = jg.read_json(mpath)
        if not isinstance(m, dict):
            raise ValueError('manifest.json phải là object')
    except ValueError as e:
        rep.fail('Manifest', 'manifest.json là JSON hợp lệ', str(e))
        return
    res['manifest'] = {k: m.get(k) for k in ('id', 'name', 'version', 'group', 'players', 'age', 'author', 'license', 'desc', 'mode', 'api', 'sdk') if k in m}
    names = {r for r, _ in files}
    missing = []
    entry = m.get('entry') if isinstance(m.get('entry'), dict) else {}
    need = [m.get('icon')] + [entry.get(k) for k in ('client', 'server', 'style') if entry.get(k)]
    for nm in need:
        if isinstance(nm, str) and nm not in names:
            missing.append(nm)
    if not isinstance(entry.get('client'), str) or not isinstance(entry.get('server'), str):
        missing.append('manifest.entry.client / entry.server')
    if 'test/cases.json' not in names:
        missing.append('test/cases.json (bắt buộc — ca kiểm của bạn)')
    if missing:
        rep.fail(S, 'Đủ tệp manifest trỏ tới', 'thiếu %d tệp' % len(missing), missing)
    else:
        rep.ok(S, 'Đủ tệp manifest trỏ tới', 'icon, client, server%s, test/cases.json' % (', style' if entry.get('style') else ''))
    shots = [r for r in names if r.startswith('screenshots/')]
    if len(shots) < 2:
        rep.warn(S, 'Ảnh chụp màn hình', 'nên có 2–6 ảnh trong screenshots/ (hiện %d)' % len(shots))
    else:
        rep.ok(S, 'Ảnh chụp màn hình', '%d ảnh' % len(shots))
    if 'README.md' not in names:
        rep.warn(S, 'README.md', 'nên có README.md mô tả game cho người chơi và người duyệt')

    M = 'Manifest'
    gid = m.get('id') if isinstance(m.get('id'), str) else ''
    errs = []
    try:
        jg.validate_manifest(m, folder_id=gid or None)
    except jg.StoreError as e:
        errs.append(str(e))
    if m.get('manifest') != 2:
        errs.append('thiếu "manifest": 2 — bài nộp mới phải theo manifest v2 (GAME-PROTOCOL.md mục 3, 15)')
    if gid.startswith(('local-', 'jg-')):
        errs.append('id không được bắt đầu bằng "local-" hoặc "jg-" (dành riêng)')
    if not str(m.get('author') or '').strip():
        errs.append('thiếu "author" (tên tác giả)')
    if not str(m.get('license') or '').strip():
        errs.append('thiếu "license" (giấy phép mã, vd MIT — mã SPDX)')
    if errs:
        rep.fail(M, 'Manifest đúng chuẩn giao thức', '%d lỗi' % len(errs), errs)
    else:
        rep.ok(M, 'Manifest đúng chuẩn giao thức', '%s %s' % (m.get('id'), m.get('version')))
    try:
        e2, w2 = jg.check_manifest_v2(srcdir, m)
    except Exception as e:   # noqa: BLE001
        e2, w2 = ['không kiểm được schema v2: %s' % e], []
    if e2:
        rep.fail(M, 'Schema manifest v2 + icon + ảnh chụp', '%d lỗi' % len(e2), e2)
    else:
        rep.ok(M, 'Schema manifest v2 + icon + ảnh chụp')
    if w2:
        rep.warn(M, 'Lưu ý schema (sẽ thành lỗi khi khai "manifest": 2)', '', w2)

    structural = rep.n('fail')
    n_static = static_scan(srcdir, files, rep)
    if structural or n_static:
        rep.warn('Kiểm luật chơi (rút gọn)', 'Bỏ qua kiểm động', 'sửa các lỗi ở trên trước — mã chưa qua kiểm tĩnh thì không được chạy thử')
        return

    P = 'Đóng gói thử'
    try:
        pf, src_dir, tmp = scan_game.package_source(jg, srcdir, gid, m)
        try:
            jg.check_limits(pf)
            jg.check_server_source(src_dir, m)
            data = jg.pack(pf)
            jg.safe_extract(data, expect_id=gid, expect_version=m['version'])
            if jg.sha256_bytes(jg.pack(pf)) != jg.sha256_bytes(data):
                raise jg.StoreError('đóng gói không tất định')
            res['sha256'] = jg.sha256_bytes(data)
            res['_jgame'] = data
            res['size'] = len(data)
            res['source_hash'] = jg.source_hash(pf)
        finally:
            if tmp:
                shutil.rmtree(tmp, ignore_errors=True)
        rep.ok(P, 'Đóng gói .jgame tất định + kiểm lại theo luật máy hội quán', '%d tệp, %d byte, sha256 %s…' % (len(pf), len(data), res['sha256'][:12]))
    except jg.StoreError as e:
        rep.fail(P, 'Đóng gói .jgame', str(e))
        return
    if not isolation_limits(jg, m, pf, rep):
        return
    dynamic_check(jg, srcdir, work, a.rounds, a.timeout, rep)


if __name__ == '__main__':
    sys.exit(main())
