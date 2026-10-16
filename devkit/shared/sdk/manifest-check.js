'use strict';
/*
 * Kiểm 1 thư mục game theo MANIFEST v2 + luật gói — bản Node của jgame.py (schema_errors, cross_errors, asset_errors,
 * check_member_name, giới hạn gói, quét async/await). Dùng bởi devkit `jagame check`, có thể dùng ở cổng nộp / cài thủ công.
 * Nguồn luật DUY NHẤT cho trường manifest: manifest.schema.json cạnh file này (Python đọc cùng file).
 *
 *   const { checkGameDir } = require('./manifest-check');
 *   const { errors, warnings, manifest, files } = checkGameDir('/đường/dẫn/games/oantuti');
 */
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.schema.json'), 'utf8'));
const STD_REASONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'reasons.json'), 'utf8')).reasons;
const REASON_RE = /^[a-z][a-z0-9-]{1,23}$/;
const ASYNC_RE = /\b(?:async|await)\b/;
const LIMITS = { zip: 20 * 1024 * 1024, unzipped: 60 * 1024 * 1024, files: 500, icon: 200 * 1024, shot: 400 * 1024, server: 1024 * 1024 };
const ALLOWED_EXT = new Set(['json', 'js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'ogg', 'm4a', 'woff2', 'txt', 'md']);
const DEV_ONLY = new Set(['store.json', 'CHANGELOG.md', 'LICENSE']);
const PACKAGE_TOP = new Set(['manifest.json', 'icon.svg', 'icon.png', 'client', 'server', 'screenshots', 'README.md', 'LICENSE.md', 'LICENSE.txt']);
const JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const extOf = (n) => { const b = n.split('/').pop(); return b.includes('.') ? b.split('.').pop().toLowerCase() : ''; };
const typeOk = (v, t) => ({
  object: () => v !== null && typeof v === 'object' && !Array.isArray(v), array: () => Array.isArray(v),
  string: () => typeof v === 'string', boolean: () => typeof v === 'boolean', integer: () => Number.isInteger(v),
  number: () => typeof v === 'number' && Number.isFinite(v)
}[t] || (() => true))();
const same = (a, b) => a === b && typeof a === typeof b;

/** Tập con JSON Schema y như jgame.schema_errors. */
function schemaErrors(v, sch, p) {
  sch = sch || SCHEMA; p = p || 'manifest';
  if (sch.$ref) sch = SCHEMA.$defs[sch.$ref.split('/').pop()];
  const errs = [];
  if (sch.anyOf) return sch.anyOf.every((s) => schemaErrors(v, s, p).length) ? [p + ': sai dạng (không khớp kiểu nào cho phép)'] : [];
  if ('const' in sch && !same(v, sch.const)) return [p + ' phải là ' + JSON.stringify(sch.const)];
  if (sch.enum && !sch.enum.some((e) => same(v, e))) return [p + ' phải là một trong ' + sch.enum.map((e) => JSON.stringify(e)).join(', ')];
  if (sch.type && !typeOk(v, sch.type)) return [p + ' phải kiểu ' + sch.type];
  if (typeof v === 'string') {
    if (v.length < (sch.minLength || 0) || (sch.maxLength !== undefined && v.length > sch.maxLength)) errs.push(p + ' dài ' + (sch.minLength || 0) + '–' + (sch.maxLength === undefined ? '∞' : sch.maxLength) + ' ký tự');
    if (sch.pattern && !new RegExp(sch.pattern).test(v)) errs.push(p + ' sai dạng (' + sch.pattern + ')');
  }
  if (typeOk(v, 'number') && ((sch.minimum !== undefined && v < sch.minimum) || (sch.maximum !== undefined && v > sch.maximum))) errs.push(p + ' trong ' + sch.minimum + '..' + sch.maximum);
  if (Array.isArray(v)) {
    if (v.length < (sch.minItems || 0) || (sch.maxItems !== undefined && v.length > sch.maxItems)) errs.push(p + ' cần ' + (sch.minItems || 0) + '–' + (sch.maxItems === undefined ? '∞' : sch.maxItems) + ' phần tử');
    if (sch.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) errs.push(p + ' có phần tử trùng');
    if (sch.items) v.forEach((x, i) => errs.push(...schemaErrors(x, sch.items, p + '[' + i + ']')));
  }
  if (typeOk(v, 'object')) {
    (sch.required || []).forEach((k) => { if (!(k in v)) errs.push(p + ' thiếu "' + k + '"'); });
    if (sch.maxProperties !== undefined && Object.keys(v).length > sch.maxProperties) errs.push(p + ' tối đa ' + sch.maxProperties + ' mục');
    const props = sch.properties || {};
    for (const k of Object.keys(v)) {
      if (props[k]) errs.push(...schemaErrors(v[k], props[k], p + '.' + k));
      else if (sch.additionalProperties === false) errs.push(p + ': trường lạ "' + k + '"');
      else if (sch.additionalProperties && typeof sch.additionalProperties === 'object') errs.push(...schemaErrors(v[k], sch.additionalProperties, p + '.' + k));
    }
  }
  return errs;
}

function modeOf(m) {
  if (m.mode !== undefined) return Array.isArray(m.mode) ? m.mode : [m.mode];
  const out = [];
  if (m.bot_simultaneous) out.push('simultaneous');
  if (m.tick_ms) out.push('realtime');
  if (m.ui && m.ui.events) out.push('events');
  return out.length ? out : ['turn'];
}

/** Luật chéo y như jgame.cross_errors. */
function crossErrors(m) {
  const errs = [], p = m.players || {};
  if (Number.isInteger(p.min) && Number.isInteger(p.max) && p.min > p.max) errs.push('players.min > players.max');
  const opts = Array.isArray(m.options) ? m.options : [];
  opts.forEach((o) => { if (o && Array.isArray(o.choices) && !o.choices.some((c) => same(c, o.default))) errs.push('options.' + o.key + ': default phải thuộc choices'); });
  const keys = opts.map((o) => o && o.key);
  if (new Set(keys).size !== keys.length) errs.push('options: key trùng');
  const md = modeOf(m);
  if (m.mode !== undefined) {
    if (md.includes('realtime') && !m.tick_ms) errs.push('mode "realtime" cần tick_ms');
    if (m.tick_ms && !md.includes('realtime')) errs.push('có tick_ms thì mode phải gồm "realtime"');
    if (md.includes('events') && !(m.ui && m.ui.events)) errs.push('mode "events" cần ui.events = true');
    if (md.includes('turn') && md.includes('simultaneous')) errs.push('mode không gồm cả "turn" lẫn "simultaneous"');
  }
  if (md.includes('action')) {
    // Game hành động (GAME-PROTOCOL.md): đường chạy riêng — không dùng chung cơ chế theo lượt / tick của khung.
    if (md.length > 1) errs.push('mode "action" đứng một mình (không kết hợp turn/simultaneous/realtime/events)');
    ['tick_ms', 'clock', 'undo', 'hint'].forEach((k) => { if (m[k]) errs.push('mode "action" không dùng ' + k); });
    const a = m.action || {};
    if (Number.isInteger(a.tick_hz) && Number.isInteger(a.send_hz) && a.send_hz > a.tick_hz) errs.push('action.send_hz phải ≤ tick_hz');
    Object.keys(a.input || {}).forEach((k) => {
      const r = a.input[k];
      if (!/^[a-z][a-z0-9_]{0,15}$/.test(k) || k === 'q' || k === 'ff' || !(Array.isArray(r) && r.length === 2 && r[0] <= r[1])) errs.push('action.input.' + k + ': khóa chữ thường (không q/ff), [min ≤ max]');
    });
  } else if (m.action !== undefined) errs.push('có "action" thì mode phải là "action"');
  if (m.clock && m.tick_ms) errs.push('clock (đồng hồ cờ của khung) không dùng cùng tick_ms');
  if (m.undo_max !== undefined && !m.undo) errs.push('undo_max chỉ có nghĩa khi undo = true');
  if (m.hint_max !== undefined && !m.hint) errs.push('hint_max chỉ có nghĩa khi hint = true');
  Object.keys(m.reasons || {}).forEach((c) => {
    if (!REASON_RE.test(c)) errs.push('reasons: mã "' + c + '" phải khớp ' + REASON_RE.source);
    else if (STD_REASONS[c]) errs.push('reasons: "' + c + '" là lý do chuẩn, không khai lại');
  });
  const sm = m.session && m.session.minutes;
  if (Array.isArray(sm) && sm.length === 2 && sm[0] > sm[1]) errs.push('session.minutes [ít nhất, nhiều nhất]');
  if (m.sdk !== undefined && m.api !== 1) errs.push('sdk "2" chạy trên api 1');
  return errs;
}

/** Tên file trong gói y như jgame.check_member_name. */
function memberError(name) {
  if (!name || name.includes('\0')) return 'tên rỗng / có ký tự NUL';
  if (name.includes('\\')) return 'có dấu \\';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'đường dẫn tuyệt đối';
  if (name.length > 200) return 'tên quá dài';
  const parts = name.split('/');
  for (const x of parts) {
    if (x === '' || x === '.' || x === '..') return 'đoạn đường dẫn rỗng / "." / ".."';
    if (x.startsWith('.')) return 'tên ẩn (bắt đầu bằng ".")';
    if (!/^[A-Za-z0-9._@+-]+$/.test(x)) return 'ký tự không cho phép (chỉ A-Z a-z 0-9 . _ - @ +)';
  }
  const ext = extOf(name);
  if (!ALLOWED_EXT.has(ext)) return 'đuôi ".' + ext + '" không cho phép';
  if (parts[0] === 'server' && ext !== 'js' && ext !== 'json') return 'server/ chỉ được chứa .js/.json';
  if (parts.length === 1 && !PACKAGE_TOP.has(name)) return 'file gốc không thuộc danh sách cho phép';
  if (parts.length > 1 && !PACKAGE_TOP.has(parts[0])) return 'thư mục gốc "' + parts[0] + '" không cho phép';
  return null;
}

/** Danh sách file gói [{rel, abs, size}] (bỏ test/ — đồ dev). Ném Error khi gặp symlink / file lạ. */
function packageFiles(dir) {
  const out = [];
  const walk = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      if (JUNK.has(name)) continue;
      const a = path.join(abs, name), r = rel ? rel + '/' + name : name, st = fs.lstatSync(a);
      if (st.isSymbolicLink()) throw new Error('symlink không được phép: ' + r);
      if (!rel && !PACKAGE_TOP.has(name)) {
        if (name === 'test' && st.isDirectory()) continue;
        if (DEV_ONLY.has(name)) continue;            // siêu dữ liệu kho (store.json…) — khớp jgame.py DEV_ONLY, không vào gói
        throw new Error('"' + name + '" không được phép ở gốc game (chỉ ' + [...PACKAGE_TOP].join(', ') + ', test/)');
      }
      if (st.isDirectory()) walk(a, r);
      else if (st.isFile()) { const why = memberError(r); if (why) throw new Error(r + ': ' + why); out.push({ rel: r, abs: a, size: st.size }); }
      else throw new Error('không phải file thường: ' + r);
    }
  };
  walk(dir, '');
  return out;
}

function pngSize(b) { return b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('latin1', 12, 16) === 'IHDR' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; }
function jpgSize(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const mk = b[i + 1], ln = b.readUInt16BE(i + 2);
    if (mk === 0xc0 || mk === 0xc1 || mk === 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + ln;
  }
  return null;
}
function webpSize(b) {
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const ch = b.toString('latin1', 12, 16);
  if (ch === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (ch === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (ch === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1]; }
  return [0, 0];
}
function imageSize(b, ext) { return ({ png: pngSize, jpg: jpgSize, jpeg: jpgSize, webp: webpSize }[ext] || (() => null))(b); }

const SVG_BAD = [[/<\s*script/i, 'có <script>'], [/\son[a-z]+\s*=/i, 'có thuộc tính sự kiện on*='], [/<\s*foreignObject/i, 'có <foreignObject>'],
  [/(?:xlink:)?href\s*=\s*["'](?!#)/i, 'có href trỏ ra ngoài (chỉ cho #id nội bộ)'], [/url\(\s*["']?(?!#)/i, 'có url() trỏ ra ngoài'], [/<!ENTITY/i, 'có <!ENTITY>']];

/** Kiểm XML tối thiểu (thẻ đóng/mở khớp, 1 gốc <svg>) — đủ bắt lỗi kiểu chinquan icon.svg 1.2.0. */
function xmlError(txt) {
  const s = txt.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const stack = [], re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=>\/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m, roots = 0, last = 0;
  while ((m = re.exec(s))) {
    if (/</.test(s.slice(last, m.index))) return 'thẻ hỏng gần ký tự ' + m.index;
    last = re.lastIndex;
    if (m[1]) { const top = stack.pop(); if (top !== m[2]) return 'thẻ đóng </' + m[2] + '> không khớp <' + (top || '—') + '>'; }
    else { if (!stack.length) roots++; if (!m[4]) stack.push(m[2]); }
  }
  if (/</.test(s.slice(last))) return 'thẻ hỏng ở cuối file';
  if (stack.length) return 'thiếu thẻ đóng </' + stack.pop() + '>';
  if (roots !== 1) return 'phải có đúng 1 phần tử gốc';
  return null;
}
function svgErrors(buf, label) {
  const txt = buf.toString('utf8'), errs = [];
  SVG_BAD.forEach(([rx, why]) => { if (rx.test(txt)) errs.push(label + ' ' + why); });
  const xe = xmlError(txt);
  if (xe) return errs.concat([label + ' không phải XML hợp lệ (' + xe + ') — ảnh sẽ vỡ ở mọi nơi']);
  const root = /<svg\b([^>]*)>/i.exec(txt);
  if (!root) return errs.concat([label + ': phần tử gốc phải là <svg>']);
  const vb = /viewBox\s*=\s*["']([^"']*)["']/.exec(root[1]);
  const p = vb ? vb[1].replace(/,/g, ' ').trim().split(/\s+/).map(Number) : [];
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) errs.push(label + ' thiếu viewBox');
  else if (p[2] <= 0 || p[3] <= 0 || Math.abs(p[2] - p[3]) > 0.01 * Math.max(p[2], p[3])) errs.push(label + ': viewBox phải vuông (đang ' + p[2] + 'x' + p[3] + ')');
  return errs;
}

function assetErrors(dir, m) {
  const errs = [];
  if (m.icon === 'icon.svg' || m.icon === 'icon.png') {
    const p = path.join(dir, m.icon);
    if (!fs.existsSync(p)) errs.push('thiếu ' + m.icon);
    else {
      const b = fs.readFileSync(p);
      if (b.length > LIMITS.icon) errs.push(m.icon + ' > 200 KB');
      if (m.icon === 'icon.svg') errs.push(...svgErrors(b, 'icon.svg'));
      else { const sz = pngSize(b); if (!sz) errs.push('icon.png không phải PNG hợp lệ'); else if (sz[0] !== sz[1] || sz[0] < 256 || sz[0] > 1024) errs.push('icon.png phải vuông 256–1024 px (đang ' + sz[0] + 'x' + sz[1] + ')'); }
    }
  }
  const sdir = path.join(dir, 'screenshots');
  const disk = fs.existsSync(sdir) ? fs.readdirSync(sdir).filter((f) => !JUNK.has(f)).sort().map((f) => 'screenshots/' + f) : [];
  disk.forEach((r) => { if (!['png', 'jpg', 'jpeg', 'webp'].includes(extOf(r))) errs.push(r + ': ảnh chụp chỉ png/jpg/webp'); });
  const listed = Array.isArray(m.screenshots) && m.screenshots.length ? m.screenshots : disk;
  listed.forEach((r) => {
    const p = path.join(dir, ...String(r).split('/'));
    if (!fs.existsSync(p)) return errs.push('thiếu ảnh chụp ' + r);
    const b = fs.readFileSync(p);
    if (b.length > LIMITS.shot) errs.push(r + ' > 400 KB');
    const sz = imageSize(b, extOf(r));
    if (!sz) errs.push(r + ' không đúng định dạng theo đuôi');
    else if (Math.min(...sz) < 320 || Math.max(...sz) > 2400) errs.push(r + ': cạnh phải trong 320–2400 px (đang ' + sz[0] + 'x' + sz[1] + ')');
  });
  return errs;
}

/**
 * Kiểm cả thư mục game (KHÔNG chạy luật chơi — việc đó của tools/runner.js). Trả {errors, warnings, manifest, files}.
 * Manifest "manifest": 2 → lỗi schema/luật chéo là LỖI; manifest v1 → CẢNH BÁO. Icon/ảnh/tên file/giới hạn/async: luôn là lỗi.
 */
function checkGameDir(dir) {
  const errors = [], warnings = [];
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch (e) { return { errors: ['manifest.json: ' + e.message], warnings, manifest: null, files: [] }; }
  if (!typeOk(m, 'object')) return { errors: ['manifest.json phải là object'], warnings, manifest: null, files: [] };
  const soft = schemaErrors(m).concat(crossErrors(m));
  if (m.id !== path.basename(path.resolve(dir))) soft.unshift('id "' + m.id + '" khác tên thư mục "' + path.basename(path.resolve(dir)) + '"');
  if (!m.changelog) errors.push('thiếu "changelog" (ghi thay đổi của phiên bản này)');
  (m.manifest === 2 ? errors : warnings).push(...soft);
  let files = [];
  try { files = packageFiles(dir); } catch (e) { errors.push(e.message); }
  const total = files.reduce((t, f) => t + f.size, 0);
  if (files.length > LIMITS.files) errors.push('quá ' + LIMITS.files + ' file');
  if (total > LIMITS.unzipped) errors.push('tổng dung lượng ' + total + ' B > 60 MB');
  const names = new Set(files.map((f) => f.rel));
  const entry = m.entry || {};
  [m.icon, entry.client, entry.server, entry.style].filter(Boolean).forEach((n) => { if (!names.has(n)) errors.push('thiếu file ' + n + ' (manifest trỏ tới)'); });
  errors.push(...assetErrors(dir, m));
  if (entry.server && names.has(entry.server)) {
    const src = fs.readFileSync(path.join(dir, entry.server), 'utf8');
    const mm = ASYNC_RE.exec(src);
    if (mm) errors.push(entry.server + ' dòng ' + (src.slice(0, mm.index).split('\n').length) + ' có chữ "' + mm[0] + '" — máy chủ từ chối nạp (kể cả trong chú thích)');
    if (Buffer.byteLength(src) > LIMITS.server) errors.push(entry.server + ' lớn quá 1 MB');
  }
  if (!fs.existsSync(path.join(dir, 'test', 'cases.json'))) warnings.push('chưa có test/cases.json (ca kiểm luật chính + ca sai) — BẮT BUỘC khi nộp');
  return { errors, warnings, manifest: m, files, total };
}

module.exports = { checkGameDir, schemaErrors, crossErrors, assetErrors, svgErrors, xmlError, memberError, packageFiles, modeOf, imageSize, LIMITS, SCHEMA, STD_REASONS };
