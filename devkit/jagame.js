#!/usr/bin/env node
'use strict';
/*
 * jagame — bộ công cụ phát triển game cho Jagame (devkit). CHỈ CẦN Node ≥ 22.2 (không cần Python, không cần npm install).
 *
 *   node jagame.js new <id> [--name "Tên game"]   tạo game mới từ trò mẫu Oẳn tù tì -> games/<id>/
 *   node jagame.js check <id|thư mục> [--rounds N] tự kiểm TRƯỚC KHI NỘP: manifest v2 (schema chung), icon/ảnh, tên file, giới hạn,
 *                                                  luật sandbox, ca kiểm test/cases.json, ván ngẫu nhiên, máy chơi, hợp đồng v2
 *   node jagame.js play <id> [--port 7788]        chạy thử trong trình duyệt: http://127.0.0.1:7788/tools/play.html?game=<id>
 *   node jagame.js pack <id>                      check rồi đóng GÓI NỘP dist/<id>-<version>.jgsrc.zip (mã nguồn + test/ + biên nhận)
 *   node jagame.js submit <id> [--to <thư mục>]   check rồi chép games/<id>/ sang <repo>/submissions/<id>/ để mở Pull Request
 *
 * Bố cục (devkit tải về và  trong repo y hệt): <gốc>/tools/{runner.js,sandbox.js,play.*}, <gốc>/shared/sdk/*,
 * <gốc>/games/<id>/. Gốc = thư mục chứa file này nếu có tools/runner.js cạnh nó, ngược lại thư mục cha (repo: devkit/).
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = fs.existsSync(path.join(__dirname, 'tools', 'runner.js')) ? __dirname : path.dirname(__dirname);
const GAMES = path.join(ROOT, 'games');
const TEMPLATE = fs.existsSync(path.join(__dirname, 'template', 'oantuti')) ? path.join(__dirname, 'template', 'oantuti') : path.join(ROOT, 'template', 'oantuti');
const VERSION = (() => { try { return fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim(); } catch (e) { return 'dev'; } })();
const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const MIT_BODY = 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files ' +
  '(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, ' +
  'distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the ' +
  'following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the ' +
  'Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES ' +
  'OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY ' +
  'CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE ' +
  'SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def; };
const die = (msg) => { console.error('LỖI: ' + msg); process.exit(1); };

if (!zlib.crc32) die('cần Node ≥ 22.2 (đang ' + process.version + ')');

function gameDir(arg) {
  if (!arg) die('thiếu <id> hoặc đường dẫn thư mục game');
  const d = ID_RE.test(arg) && !fs.existsSync(arg) ? path.join(GAMES, arg) : path.resolve(arg);
  if (!fs.existsSync(path.join(d, 'manifest.json'))) die('không thấy ' + path.join(d, 'manifest.json'));
  return d;
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const n of fs.readdirSync(src)) {
    const a = path.join(src, n), b = path.join(dst, n);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

/* ───────────── new ───────────── */
function cmdNew() {
  const id = argv[1];
  if (!ID_RE.test(id || '')) die('id phải khớp ' + ID_RE + ' (chữ thường, số, gạch ngang; 2–32 ký tự)');
  const dst = path.join(GAMES, id);
  if (fs.existsSync(dst)) die(dst + ' đã có');
  try {
    const off = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'official_ids.json'), 'utf8')).ids || [];
    if (off.includes(id)) die('"' + id + '" trùng id game chính thức của Jagame — chọn id khác');
  } catch (e) { if (e && e.code !== 'ENOENT') throw e; }
  copyDir(TEMPLATE, dst);
  const mp = path.join(dst, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.id = id; m.name = flag('--name', 'Game ' + id); m.version = '0.1.0';
  m.author = flag('--author', 'Tên bạn'); m.changelog = '0.1.0: bản đầu.'; m.news = 'Bản đầu tiên.';
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
  fs.writeFileSync(path.join(dst, 'README.md'), '# ' + m.name + '\n\n' +
    '- **Mô tả:** (1–3 câu: game là gì, chơi mấy người)\n' +
    '- **Luật chơi:** (tóm tắt luật; manifest `howto` là bản ngắn cho người chơi)\n' +
    '- **Tác giả:** ' + m.author + '\n' +
    '- **Giấy phép mã:** MIT (xem LICENSE)\n' +
    '- **Tài sản (hình, âm, phông):** tự vẽ / tự làm, cùng giấy phép MIT — ghi rõ nguồn + giấy phép nếu dùng tài sản của người khác\n');
  fs.writeFileSync(path.join(dst, 'LICENSE'), 'MIT License\n\nCopyright (c) ' + new Date().getFullYear() + ' ' + m.author + '\n\n' + MIT_BODY);
  console.log('Đã tạo ' + dst + ' (từ trò mẫu Oẳn tù tì — sửa server/game.js, client/index.js, manifest.json, icon.svg, test/cases.json).');
  console.log('Tiếp:  node ' + path.relative(process.cwd(), __filename) + ' check ' + id + '   ·   play ' + id);
}

/* ───────────── check ───────────── */
function cmdCheck(dir, quiet) {
  const mc = require(path.join(ROOT, 'shared', 'sdk', 'manifest-check.js'));
  const r = mc.checkGameDir(dir);
  console.log('Manifest + gói (' + path.basename(dir) + (r.manifest ? ' ' + r.manifest.version : '') + ', ' + r.files.length + ' file, ' + Math.round((r.total || 0) / 1024) + ' KB):');
  r.warnings.forEach((w) => console.log('  Lưu ý  ' + w));
  r.errors.forEach((e) => console.log('  TRƯỢT  ' + e));
  if (r.errors.length) { console.log('KẾT QUẢ: TRƯỢT — sửa ' + r.errors.length + ' lỗi manifest/gói trước'); return false; }
  console.log('  ĐẠT   ' + (r.manifest.manifest === 2 ? 'manifest v2 đúng schema' : 'manifest v1 (khai "manifest": 2 để được kiểm chặt)'));
  const rounds = flag('--rounds', '200');
  const p = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'runner.js'), dir, '--rounds', rounds], { stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (quiet) process.stdout.write(p.stdout || '');
  return p.status === 0;
}

/* ───────────── play ───────────── */
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp3: 'audio/mpeg',
  ogg: 'audio/ogg', m4a: 'audio/mp4', woff2: 'font/woff2', md: 'text/plain; charset=utf-8', txt: 'text/plain; charset=utf-8' };
function cmdPlay(dir) {
  const id = path.basename(dir);
  if (path.dirname(dir) !== GAMES) die('play cần game nằm trong ' + GAMES);
  const port = Number(flag('--port', '7788'));
  const root = path.resolve(ROOT);
  http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
    if (rel === '/') { res.writeHead(302, { Location: '/tools/play.html?game=' + id }); return res.end(); }
    const file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root + path.sep) || rel.split('/').some((x) => x.startsWith('.'))) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Không có ' + rel); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  }).listen(port, '127.0.0.1', () => {
    console.log('Chơi thử: http://127.0.0.1:' + port + '/tools/play.html?game=' + id + '   (&players=N, &bot=1 máy chơi ghế khác, &tick=0 dừng đồng hồ)');
    console.log('Ctrl+C để dừng.');
  });
}

/* ───────────── pack (gói nộp) ───────────── */
function zip(entries) {   // [{name, data}] -> Buffer zip (deflate, mtime 1980-01-01, tên UTF-8) — tất định
  const locals = [], centrals = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), raw = e.data, comp = zlib.deflateRawSync(raw, { level: 9 }), crc = zlib.crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x031e, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(off, 42);
    locals.push(lh, name, comp); centrals.push(ch, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(locals.concat([cd, end]));
}
function cmdPack(dir) {
  if (!cmdCheck(dir, false)) die('check chưa đạt — không đóng gói nộp');
  const mc = require(path.join(ROOT, 'shared', 'sdk', 'manifest-check.js'));
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const files = mc.packageFiles(dir);
  const casesPath = path.join(dir, 'test', 'cases.json');
  if (!fs.existsSync(casesPath)) die('gói nộp bắt buộc có test/cases.json');
  const tdir = path.join(dir, 'test');
  fs.readdirSync(tdir).sort().forEach((n) => { if (/^[A-Za-z0-9._-]+\.json$/.test(n)) files.push({ rel: 'test/' + n, abs: path.join(tdir, n) }); });
  const entries = files.map((f) => ({ name: f.rel, data: fs.readFileSync(f.abs) }));
  const receipt = {
    format: 1, kind: 'jagame-game-source', id: m.id, version: m.version, sdk: m.sdk || null, manifest: m.manifest || 1,
    devkit: VERSION, node: process.version, checked: 'ĐẠT',
    files: Object.fromEntries(entries.map((e) => [e.name, crypto.createHash('sha256').update(e.data).digest('hex')]))
  };
  entries.push({ name: 'jagame-submit.json', data: Buffer.from(JSON.stringify(receipt, null, 1) + '\n') });
  entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  const out = path.join(ROOT, 'dist', m.id + '-' + m.version + '.jgsrc.zip');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const buf = zip(entries);
  fs.writeFileSync(out, buf);
  console.log('Gói nộp: ' + out + ' (' + Math.round(buf.length / 1024) + ' KB, ' + entries.length + ' file, sha256 ' +
    crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) + '…)');
  console.log('Gửi game: `node jagame.js submit ' + m.id + '` rồi mở Pull Request (xem developers/GUI-GAME.md). Kho tự kiểm lại, duyệt, gộp SDK và KÝ.');
}

/* ───────────── submit (chép sang submissions/<id>/ của repo đã fork) ───────────── */
function cmdSubmit(dir) {
  if (!cmdCheck(dir, false)) die('check chưa đạt — sửa lỗi trước khi gửi');
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const need of ['README.md']) if (!fs.existsSync(path.join(dir, need))) die('thiếu ' + need + ' (mô tả, luật chơi, tác giả, giấy phép mã + tài sản)');
  if (!['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((n) => fs.existsSync(path.join(dir, n)))) die('thiếu LICENSE');
  const to = path.resolve(flag('--to', path.join(ROOT, '..', 'submissions')));
  if (!fs.existsSync(to)) die('không thấy ' + to + ' — chạy trong bản fork của repo JagameServer hoặc chỉ --to <repo>/submissions');
  const dst = path.join(to, m.id);
  fs.rmSync(dst, { recursive: true, force: true });
  const copy = (a, b) => {
    fs.mkdirSync(b, { recursive: true });
    for (const n of fs.readdirSync(a)) {
      if (n.startsWith('.')) continue;                      // tệp chấm (.DS_Store…) bị từ chối khi gửi
      const x = path.join(a, n), y = path.join(b, n), st = fs.lstatSync(x);
      if (st.isSymbolicLink()) die('symlink không được phép: ' + x);
      if (st.isDirectory()) copy(x, y); else fs.copyFileSync(x, y);
    }
  };
  copy(dir, dst);
  console.log('Đã chép sang ' + dst);
  console.log('Tiếp: python3 ' + path.relative(process.cwd(), path.join(__dirname, 'check_submission.py')) + ' ' + path.relative(process.cwd(), dst) +
    '  ->  git add submissions/' + m.id + ' && git commit && git push  ->  mở Pull Request.');
}

/* ───────────── main ───────────── */
if (cmd === 'new') cmdNew();
else if (cmd === 'check' || cmd === 'test') process.exit(cmdCheck(gameDir(argv[1]), false) ? 0 : 1);
else if (cmd === 'play') cmdPlay(gameDir(argv[1]));
else if (cmd === 'pack') cmdPack(gameDir(argv[1]));
else if (cmd === 'submit') cmdSubmit(gameDir(argv[1]));
else {
  console.log('jagame devkit ' + VERSION + ' — gốc ' + ROOT + '\n');
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(3, 11).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
  process.exit(cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0);
}
