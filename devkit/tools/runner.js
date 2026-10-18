'use strict';
/*
 * Bộ kiểm luật chơi 1 game (test_game.py gọi): node runner.js <thư mục game> [--rounds N] [--seed S]
 *   1. Nạp server/game.js trong sandbox (giống máy) — thiếu hàm / lỗi cú pháp -> trượt.
 *   2. Chạy các ca trong test/cases.json (nếu có).
 *   3. Chơi ngẫu nhiên N ván (cần hàm tùy chọn legal(state, seat), hoặc bot, hoặc tick), xen nước rác + đầu hàng; kiểm: không
 *      ném lỗi, nước sai trả error và không đổi state, view mọi ghế + người xem, result, tất định khi chơi lại. Game có máy chơi
 *      (manifest "bot": true + bot(state, seat, ctx)): nửa số nước lấy từ bot — bot phải trả nước hợp lệ cho mọi tùy chọn.
 *      ĐỒNG HỒ GIẢ: ctx.now (setup/move/tick/bot) là mili-giây tăng dần tất định theo seed (bắt đầu ~1,7e12 như Date.now());
 *      game có tick_ms + tick() được gọi tick mỗi khi đồng hồ qua 1 nhịp tick_ms (như máy chủ), thỉnh thoảng nhảy 15–45 s để
 *      thử hết giờ. Không ai có nước hợp lệ mà có tick -> chỉ tick tiếp (ván thời gian thực tự tiến).
 *      cases.json: bước {"tick": ms} = cho đồng hồ chạy ms mili-giây (gọi tick() mỗi tick_ms; không có tick_ms thì 1 lần).
 *   4. Đo thời gian mỗi lần gọi (giới hạn 250 ms, như máy chủ thật).
 * In kết quả tiếng Việt; mã thoát 0 = đạt.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, loadAction } = require('./sandbox');

const LIMIT_MS = 250;   // = timeout thật của khung Jagame (máy tải nặng vm giật tới ~50 ms)
const argv = process.argv.slice(2);
const dir = argv[0];
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? Number(argv[i + 1]) : def; };
const ROUNDS = opt('--rounds', 200);
const SEED = opt('--seed', 20261006) >>> 0;

const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
// manifest "sdk": "2" -> chạy ĐÚNG mã máy sẽ nạp: jg-core gộp trước game.js (shared/sdk/bundle.js, cạnh thư mục công cụ này).
const sdkBundle = require(path.join(__dirname, '..', 'shared', 'sdk', 'bundle.js'));
const src = sdkBundle.bundled(dir, manifest, 'server').toString('utf8');
if (manifest.sdk) console.log('SDK v' + manifest.sdk + ': đã gộp jg-core trước ' + manifest.entry.server + ' (số dòng lỗi trong game.js = dòng báo − ' + sdkBundle.prefixLines(manifest, 'server') + ')');

let fails = 0;
const timing = {};
const bad = (msg) => { fails++; console.log('  TRƯỢT  ' + msg); };

const MODES = Array.isArray(manifest.mode) ? manifest.mode : (manifest.mode ? [manifest.mode] : []);
const IS_ACTION = MODES.indexOf('action') >= 0;
let game;
try {
  game = loadGame(src, { filename: manifest.id + '/' + manifest.entry.server, timeout: LIMIT_MS });
} catch (e) {
  if (!IS_ACTION) {
    console.log('TRƯỢT: không nạp được game.js — ' + e.message);
    process.exit(1);
  }
  // Game hành động không bắt buộc lớp cổ điển (move/view): chỉ chạy phần kiểm action bên dưới.
  console.log('Game hành động: không có lớp cổ điển (' + e.message.split('\n')[0].slice(0, 80) + ') — chỉ kiểm đường action');
  game = null;
}
const HAS_BOT = manifest.bot === true;
const TICK_MS = Number.isInteger(manifest.tick_ms) && manifest.tick_ms >= 100 && game.has('tick') ? Math.min(manifest.tick_ms, 60000) : 0;
const UI_EVENTS = !!(manifest.ui && manifest.ui.events === true);
const EVENTS_MAX_CHARS = 16384;   // = khung Jagame EVENTS_MAX_CHARS
const BASE_NOW = 1700000000000;   // đồng hồ giả bắt đầu như Date.now() thật (game không được giả định now nhỏ)
if (manifest.tick_ms && !game.has('tick')) console.log('Lưu ý: manifest có tick_ms nhưng game.js không có hàm tick() -> máy không gọi tick');
if (!manifest.tick_ms && game.has('tick')) console.log('Lưu ý: game.js có tick() nhưng manifest không có tick_ms -> máy KHÔNG gọi tick');
if (HAS_BOT && !game.has('bot')) {
  console.log('TRƯỢT: manifest "bot": true nhưng game.js không có hàm bot(state, seat, ctx)');
  process.exit(1);
}
if (!HAS_BOT && game.has('bot')) console.log('Lưu ý: game.js có bot() nhưng manifest chưa khai "bot": true -> máy tự host KHÔNG bật máy chơi');
// Đồng hồ cờ + xin đi lại do KHUNG phòng chơi xử lý (khung Jagame CHUAN-GIAO-TIEP.md): game chỉ cần view.turn đúng.
const HAS_UNDO = manifest.undo === true;
const UNDO_FN = game.has('undo');   // hàm tùy chọn undo(state, {player, now, rng}) -> {state, error?}; không có thì khung khôi phục bản chụp
if (manifest.clock) console.log('Đồng hồ cờ: manifest clock = ' + JSON.stringify(manifest.clock) + ' (khung giữ giờ theo view.turn, hết giờ thua het-gio)');
if (HAS_UNDO) console.log('Xin đi lại: ' + (UNDO_FN ? 'game có undo() riêng' : 'khung tự khôi phục state đã chụp trước nước') +
  (manifest.undo_max ? ', tối đa ' + manifest.undo_max + ' lần/người/ván' : ', tối đa 3 lần/người/ván (mặc định)') +
  (!UNDO_FN && TICK_MS ? ' — LƯU Ý: game có tick_ms mà không có undo(): bản chụp cũ mang cả mốc giờ cũ trong state' : ''));
if (!HAS_UNDO && UNDO_FN) console.log('Lưu ý: game.js có undo() nhưng manifest chưa khai "undo": true -> máy tự host KHÔNG bật xin đi lại');
// Gợi ý nước 💡 (§3.7, khung xử lý `room:hint`): manifest "hint": true -> khung gọi hint(state, seat, ctx) -> move | {move, cells?, text?} | null,
// không có hint() thì gọi bot(). Ván ngẫu nhiên thỉnh thoảng đi theo gợi ý: nước gợi ý PHẢI được move() chấp nhận.
const HINT_FN = manifest.hint === true ? (game.has('hint') ? 'hint' : (game.has('bot') ? 'bot' : null)) : null;
if (manifest.hint === true && !HINT_FN) {
  console.log('TRƯỢT: manifest "hint": true nhưng game.js không có hint(state, seat, ctx) lẫn bot(state, seat, ctx)');
  process.exit(1);
}
if (HINT_FN) console.log('Gợi ý nước: khung gọi ' + HINT_FN + '()' + (manifest.hint_max ? ', tối đa ' + manifest.hint_max : ', tối đa 3') + ' lần/người/ván' +
  (manifest.tutorial ? '; hướng dẫn lần đầu ' + (Array.isArray(manifest.tutorial) ? manifest.tutorial.length : (manifest.tutorial.steps || []).length) + ' bước' : ''));
if (manifest.hint !== true && game.has('hint')) console.log('Lưu ý: game.js có hint() nhưng manifest chưa khai "hint": true -> máy tự host KHÔNG hiện nút 💡');
/** Kết quả hint()/bot() -> nước đi (dạng {move,…} hoặc nước thẳng), null = không có gợi ý. */
function hintMove(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, 'move')) {
    if (v.cells !== undefined && !Array.isArray(v.cells)) throw new Error(HINT_FN + '() trả cells không phải mảng');
    if (v.text !== undefined && typeof v.text !== 'string') throw new Error(HINT_FN + '() trả text không phải chuỗi');
    return v.move === null || v.move === undefined ? null : v.move;
  }
  return v;
}

let eventMoves = 0, eventTooBig = 0;
// Hợp đồng giao thức v2 (shared/sdk/contract.js): soi mọi view/result; game v2 sai = trượt, game v1 chỉ cảnh báo.
const contract = require(path.join(__dirname, '..', 'shared', 'sdk', 'contract.js')).makeChecker(manifest);
function call(fn, args) {
  const r = game.call(fn, args);
  if (fn === 'view' && contract.np) contract.view(r, args.seat);
  else if (fn === 'result' && contract.np) contract.result(r);
  const t = timing[fn] || (timing[fn] = { n: 0, sum: 0, max: 0 });
  t.n++; t.sum += game.lastMs; t.max = Math.max(t.max, game.lastMs);
  if (fn === 'move' && r && !r.error && r.events !== undefined && r.events !== null) {
    // Hợp đồng: events = mảng đối tượng (máy phát game:event cho cả phòng khi manifest ui.events; quá 16 KB thì gửi view).
    if (!Array.isArray(r.events) || !r.events.every((e) => e && typeof e === 'object' && !Array.isArray(e))) {
      throw new Error('move() trả events không phải mảng đối tượng: ' + JSON.stringify(r.events).slice(0, 80));
    }
    if (r.events.length) { eventMoves++; if (JSON.stringify(r.events).length > EVENTS_MAX_CHARS) eventTooBig++; }
  }
  return r;
}

/** Đồng hồ giả của 1 ván: now tăng dần; tick() được gọi đúng số nhịp tick_ms đã qua (như setInterval của máy chủ). */
function makeClock(start, seed, counter) {
  const c = { now: start, lastTick: start, ticks: 0 };
  c.tickTo = function (state) {
    if (!TICK_MS) return state;
    let guard = 0;
    while (c.now - c.lastTick >= TICK_MS && guard++ < 1000) {
      c.lastTick += TICK_MS;
      c.ticks++;
      const r = call('tick', { state, ctx: { now: c.lastTick }, seed: callSeed(seed, counter.n++) });
      if (!r || typeof r !== 'object' || !r.state || typeof r.state !== 'object') throw new Error('tick() phải trả {state}');
      state = r.state;
    }
    return state;
  };
  c.advance = function (state, ms) { c.now += ms; return c.tickTo(state); };
  return c;
}

// PRNG phía bộ kiểm (chọn nước, sinh seed) — tách biệt với ctx.rng của game.
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const callSeed = (matchSeed, n) => (Math.imul(matchSeed ^ 0x9E3779B9, 0x85EBCA6B) + n * 0xC2B2AE35) >>> 0;

function defaults() {
  const o = {};
  (manifest.options || []).forEach((d) => { o[d.key] = d.default; });
  return o;
}
function players(n) {
  return Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + 1), name: 'Người ' + (i + 1) }));
}

// So khớp một phần: mọi khóa trong `want` phải bằng (sâu) giá trị tương ứng của `got`.
function match(got, want) {
  if (want === null || typeof want !== 'object') return got === want;
  if (Array.isArray(want)) return Array.isArray(got) && got.length === want.length && want.every((w, i) => match(got[i], w));
  return got !== null && typeof got === 'object' && Object.keys(want).every((k) => match(got[k], want[k]));
}

/* ---------- 0. Game hành động (CHUAN-GIAO-TIEP.md): chạy RESIDENT như máy — nhịp, bot, ảnh chụp theo vùng nhìn, join/leave, tất định ---------- */
if (IS_ACTION) runAction();
if (!game) {
  fails += contract.report((l) => console.log(l));
  console.log(fails ? 'KẾT QUẢ: TRƯỢT — ' + fails + ' lỗi' : 'KẾT QUẢ: ĐẠT — 0 lỗi');
  process.exit(fails ? 1 : 0);
}

function runAction() {
  const A = Object.assign({ tick_hz: 30, send_hz: 15, view: [32, 48], unit: 8, input: { d: [-1, 3], f: [0, 1] }, delta: {} }, manifest.action || {});
  const KEYS = Object.keys(A.input);
  const room = manifest.room || {};
  const teams = room.teams ? room.teams.count : 0;
  const HAS = (fn) => act.has(fn);
  let act;
  console.log('Game hành động (' + A.tick_hz + ' Hz mô phỏng, ' + A.send_hz + ' ảnh chụp/s, vùng nhìn ' + A.view.join('×') + ' ô, input [' + KEYS.join(', ') + ']):');
  try {
    act = loadAction(src, { filename: manifest.id + '/' + manifest.entry.server, timeout: LIMIT_MS });
  } catch (e) {
    bad('không nạp được ở chế độ action — ' + e.message);
    return;
  }
  ['tiles', 'world', 'summary', 'join', 'leave', 'bot', 'view'].forEach((fn) => { if (!HAS(fn)) console.log('  Lưu ý: không có ' + fn + '()'); });
  if (manifest.bot === true && !HAS('bot')) bad('manifest "bot": true nhưng không có bot(s, seat, ctx)');
  const frameMs = [], snapBytes = [];
  let bigPkts = 0, ticksTot = 0, ended = 0;
  const ROUNDS_A = Math.max(2, Math.min(12, Math.round(ROUNDS / 20)));
  const TICKS_MAX = A.tick_hz * 240;   // ≤ 4 phút mô phỏng / ván
  function play(seed) {
    const rnd = prng(seed);
    const n = manifest.players.max;
    const humans = Math.max(1, Math.min(n, manifest.players.min + Math.floor(rnd() * 3)));
    const options = defaults();
    (manifest.options || []).forEach((d) => { options[d.key] = d.choices[Math.floor(rnd() * d.choices.length)]; });
    const players = [];
    for (let i = 0; i < n; i++) {
      if (i < humans) players.push({ id: 'p' + (i + 1), name: 'Người ' + (i + 1), team: teams ? i % teams : undefined });
      else if (manifest.bot === true && rnd() < 0.5) players.push({ id: -i, name: 'Máy ' + i, bot: true, team: teams ? i % teams : undefined });
      else players.push(null);
    }
    let now = BASE_NOW;
    const init = act.call('init', { players, options, now, seed });
    if (!init || typeof init !== 'object') throw new Error('init lỗi');
    if (HAS('world') && JSON.stringify(init.world).length > 256 * 1024) throw new Error('world() lớn quá 256 KB');
    const focus = [], ts = [], last = [], drive = players.map((p) => (p ? (p.bot ? 'bot' : 'human') : 'none'));
    let q = 0, res = null, k;
    for (k = 1; k <= TICKS_MAX && !res; k++) {
      now += Math.round(1000 / A.tick_hz);
      // giữa ván: 1 người rời (máy lái) rồi quay lại, 1 người mới vào ghế trống
      if (k === 90 && HAS('leave')) { act.call('leave', { seat: 0, now }); drive[0] = 'bot'; }
      if (k === 150 && HAS('join')) {
        const r = act.call('join', { seat: 0, id: 'p1', name: 'Người 1', now, team: teams ? 0 : undefined });
        if (typeof r === 'string' || (r && r.error)) throw new Error('join() từ chối người cũ quay lại: ' + JSON.stringify(r));
        drive[0] = 'human';
      }
      const empty = players.findIndex((p, i) => !p && drive[i] === 'none');
      if (k === 200 && empty >= 0 && HAS('join')) {
        const r = act.call('join', { seat: empty, id: 'm' + empty, name: 'Mới', now, team: teams ? empty % teams : undefined });
        if (!(typeof r === 'string' || (r && r.error))) drive[empty] = 'human';
      }
      const inputs = drive.map((d) => {
        if (d !== 'human') return null;
        q++;
        const o = { q, ff: Math.floor(rnd() * 3) };
        KEYS.forEach((key) => { const r = A.input[key]; o[key] = r[0] + Math.floor(rnd() * (r[1] - r[0] + 1)); });
        return rnd() < 0.05 ? null : o;   // 5 % nhịp đói gói
      });
      const bots = drive.map((d, i) => (d === 'bot' ? i : -1)).filter((i) => i >= 0);
      const snaps = [];
      if (k % Math.max(1, Math.round(A.tick_hz / A.send_hz)) === 0) {
        drive.forEach((d, i) => {
          if (d !== 'human') return;
          const f = focus[i] || [0, 0];
          const area = [Math.floor(f[0] - A.view[0] / 2), Math.floor(f[1] - A.view[1] / 2), Math.floor(f[0] + A.view[0] / 2), Math.floor(f[1] + A.view[1] / 2)];
          snaps.push(['s' + i, i, area, HAS('tiles') ? (ts[i] || 0) : null, last[i] || 0]);
          last[i] = k;
        });
        if (k % (A.tick_hz / 10 | 0 || 1) === 0) snaps.push(['x', -1, [0, 0, 4096, 4096], null, 0]);
      }
      const out = act.call('frame', { k, now, dt: 1000 / A.tick_hz, inputs, bots, snaps, sum: k % A.tick_hz === 0, views: k % (A.tick_hz * 3) === 0 ? [-1, 0] : null, res: true });
      frameMs.push(act.lastMs);
      ticksTot++;
      for (const [vid, sn, tl] of out.snaps) {
        if (!sn || typeof sn !== 'object' || Array.isArray(sn)) throw new Error('snapshot() phải trả đối tượng');
        for (const f of Object.keys(A.delta)) {
          if (sn[f] !== undefined && (!Array.isArray(sn[f]) || sn[f].length % A.delta[f] !== 0)) throw new Error('snapshot().' + f + ' không chia hết ' + A.delta[f] + ' (action.delta)');
        }
        const bytes = JSON.stringify(sn).length;
        snapBytes.push(bytes);
        if (bytes > 2048) bigPkts++;
        if (vid !== 'x' && Array.isArray(sn.me) && typeof sn.me[0] === 'number') focus[Number(vid.slice(1))] = [sn.me[0] / A.unit, sn.me[1] / A.unit];
        if (tl && Number.isInteger(tl.ts)) ts[Number(vid.slice(1))] = tl.ts;
      }
      if (out.views) out.views.forEach(([seat, v]) => { if (contract.np) contract.view(v, seat); });
      res = out.result;
    }
    if (res) {
      ended++;
      if (!Array.isArray(res.winners) || !res.winners.every((w) => Number.isInteger(w) && w >= 0 && w < n)) throw new Error('result().winners phải là mảng ghế 0..' + (n - 1));
      if (typeof res.reason !== 'string') throw new Error('result().reason thiếu');
    }
    return JSON.stringify(act.call('dump')).length + ':' + JSON.stringify(res) + ':' + k;
  }
  let aFails = 0;
  contract.np = manifest.players.max;
  for (let r = 0; r < ROUNDS_A; r++) {
    const seed = (SEED + 9000 + r) >>> 0;
    try {
      const h1 = play(seed);
      if (r < 2 && play(seed) !== h1) throw new Error('không tất định: cùng seed + cùng input ra kết quả khác');
    } catch (e) {
      aFails++;
      if (aFails <= 5) bad('action seed ' + seed + ': ' + e.message);
    }
  }
  contract.np = 0;
  const sorted = frameMs.slice().sort((a, b) => a - b);
  const mean = frameMs.reduce((a, b) => a + b, 0) / Math.max(1, frameMs.length);
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const sb = snapBytes.slice().sort((a, b) => a - b);
  console.log('  ' + (aFails ? '✗' : 'ĐẠT') + '   ' + ROUNDS_A + ' ván, ' + ticksTot + ' nhịp (' + ended + ' ván tự kết thúc, còn lại dừng ở ' + (TICKS_MAX / A.tick_hz) + ' s), rời -> máy lái -> quay lại, vào giữa ván; 2 ván đầu chơi lại tất định');
  const line = '  frame (bot + sim + ảnh chụp, 1 lần vào sandbox/nhịp): tb ' + mean.toFixed(3) + ' ms, p99 ' + p99.toFixed(3) + ' ms (máy: hạn 20 ms, khuyên tb ≤ 2 ms)';
  if (p99 > 20) bad(line); else console.log(line);
  console.log('  ảnh chụp/người (JSON trước delta): tb ' + Math.round(sb.reduce((a, b) => a + b, 0) / Math.max(1, sb.length)) + ' B, p99 ' + (sb[Math.floor(sb.length * 0.99)] || 0) + ' B' +
    (bigPkts ? ' — LƯU Ý ' + bigPkts + ' gói > 2 KB (ngân sách khung ≤ 2 KB/gói, ≤ 6 KB/s/người: khai action.delta, cắt bớt thực thể/sự kiện xa)' : ''));
  if (mean > 2) console.log('  Lưu ý: frame tb > 2 ms — máy NAS chậm 4–6× (tối đa ' + 3 + ' trận song song)');
}

/* ---------- 1. Ca kiểm thử ---------- */
const casesFile = path.join(dir, 'test', 'cases.json');
let cases = [];
if (fs.existsSync(casesFile)) cases = JSON.parse(fs.readFileSync(casesFile, 'utf8')).cases || [];
console.log('Ca kiểm thử (' + cases.length + '):');
cases.forEach((c, ci) => {
  const before = fails;
  try {
    const seed = (SEED + ci) >>> 0;
    const counter = { n: 0 };
    // Ca kiểm: đồng hồ bắt đầu từ 0 (tương thích các ca cũ, move luôn now:0 khi không có bước tick).
    const clock = makeClock(0, seed, counter);
    contract.np = c.players || manifest.players.min;
    let state = call('setup', { ctx: { players: players(c.players || manifest.players.min),
      options: Object.assign(defaults(), c.options || {}), now: 0 }, seed: callSeed(seed, counter.n++) });
    (c.steps || []).forEach((st, si) => {
      if (st && Number.isFinite(st.tick) && st.move === undefined) {
        // {"tick": ms}: cho đồng hồ chạy ms; game không có tick_ms thì gọi tick() đúng 1 lần ở mốc mới.
        if (TICK_MS) state = clock.advance(state, st.tick);
        else if (game.has('tick')) {
          clock.now += st.tick;
          const tr = call('tick', { state, ctx: { now: clock.now }, seed: callSeed(seed, counter.n++) });
          if (!tr || !tr.state) return bad(c.name + ': bước ' + (si + 1) + ' tick() phải trả {state}');
          state = tr.state;
        } else return bad(c.name + ': bước ' + (si + 1) + ' là tick nhưng game không có tick()');
        return;
      }
      const json = JSON.stringify(state);
      const r = call('move', { state, ctx: { player: st.seat, move: st.move, now: clock.now }, seed: callSeed(seed, counter.n++) });
      if (st.error) {
        if (!r || !r.error) return bad(c.name + ': bước ' + (si + 1) + ' lẽ ra bị từ chối nhưng được chấp nhận');
        if (typeof st.error === 'string' && r.error.indexOf(st.error) < 0) {
          bad(c.name + ': bước ' + (si + 1) + ' lỗi "' + r.error + '" không chứa "' + st.error + '"');
        }
        if (JSON.stringify(r.state === undefined ? state : r.state) !== json) {
          bad(c.name + ': bước ' + (si + 1) + ' nước sai nhưng state bị đổi');
        }
      } else {
        if (!r || r.error) return bad(c.name + ': bước ' + (si + 1) + ' bị từ chối: ' + (r && r.error));
        state = r.state;
      }
    });
    const res = call('result', { state });
    if ('result' in c && !match(res, c.result)) {
      bad(c.name + ': result = ' + JSON.stringify(res) + ', mong đợi ' + JSON.stringify(c.result));
    }
    (c.view || []).forEach((v) => {
      const got = call('view', { state, seat: v.seat });
      if (!match(got, v.match)) bad(c.name + ': view(' + v.seat + ') không khớp ' + JSON.stringify(v.match));
    });
  } catch (e) {
    bad(c.name + ': ném lỗi — ' + e.message);
  }
  console.log((fails === before ? '  ĐẠT   ' : '  ✗     ') + c.name);
});

/* ---------- 2. Ván ngẫu nhiên ---------- */
const JUNK = [null, 0, 'x', [], {}, { x: -1, y: 0 }, { x: 1e9, y: 1e9 }, { x: 0.5, y: 'a' }, { type: 'hack' },
  { x: { y: 1 } }, { type: 'place' }, '__proto__', { __proto__: { x: 1 } }];

function playRandom(seed, record) {
  const rnd = prng(seed);
  const pmin = manifest.players.min, pmax = manifest.players.max;
  const np = pmin + Math.floor(rnd() * (pmax - pmin + 1));
  contract.np = np;
  const options = defaults();
  (manifest.options || []).forEach((d) => { options[d.key] = d.choices[Math.floor(rnd() * d.choices.length)]; });
  const counter = { n: 0 };
  const clock = makeClock(BASE_NOW + Math.floor(rnd() * 1e9), seed, counter);
  let state = call('setup', { ctx: { players: players(np), options, now: clock.now }, seed: callSeed(seed, counter.n++) });
  const moves = [];
  const resignAt = rnd() < 0.15 ? Math.floor(rnd() * 30) : -1;
  const MAX_STEPS = TICK_MS ? 20000 : 5000;
  let idle = 0, step, raced = 0, undos = 0, hints = 0;
  for (step = 0; step < MAX_STEPS; step++) {
    // Đồng hồ chạy: mỗi bước 0,1–1,5 s (người nghĩ), 5% nhảy 15–45 s (thử hết giờ); tick() theo nhịp tick_ms.
    state = clock.advance(state, rnd() < 0.05 ? 15000 + Math.floor(rnd() * 30000) : 100 + Math.floor(rnd() * 1400));
    for (let s = -1; s < np; s++) call('view', { state, seat: s });
    if (call('result', { state })) break;
    // nước rác: phải bị từ chối, không đổi state
    if (rnd() < 0.3) {
      const junk = JUNK[Math.floor(rnd() * JUNK.length)];
      const seat = Math.floor(rnd() * np);
      const json = JSON.stringify(state);
      const r = call('move', { state, ctx: { player: seat, move: junk, now: clock.now }, seed: callSeed(seed, counter.n++) });
      if (!r || !r.error) throw new Error('nước rác ' + JSON.stringify(junk) + ' được chấp nhận');
      if (JSON.stringify(r.state === undefined ? state : r.state) !== json) throw new Error('nước rác làm đổi state');
    }
    let seat = -1, mv, byBot = false;
    if (step === resignAt) {
      seat = Math.floor(rnd() * np); mv = { type: 'resign' };
    } else {
      const options = [];
      if (game.has('legal')) {
        for (let s = 0; s < np; s++) { const l = call('legal', { state, seat: s }) || []; if (l.length) options.push([s, l]); }
      } else if (HAS_BOT) {
        // Không có legal(): ghế tới lượt theo view.turn, nước do bot quyết định
        const v = call('view', { state, seat: -1 }) || {};
        if (Number.isInteger(v.turn) && v.turn >= 0 && v.turn < np) options.push([v.turn, null]);
      }
      if (!options.length) {
        if (!TICK_MS) throw new Error('chưa có kết quả nhưng không ai có nước đi hợp lệ');
        // Game thời gian thực: không ai có nước thì chỉ cho đồng hồ chạy (kêu số, hết giờ câu hỏi…)
        if (++idle > 3000) throw new Error('không ai có nước đi và ' + idle + ' nhịp tick liên tiếp vẫn chưa kết thúc (ván treo?)');
        state = clock.advance(state, TICK_MS * (1 + Math.floor(rnd() * 3)));
        continue;
      }
      idle = 0;
      const pick = options[Math.floor(rnd() * options.length)];
      seat = pick[0];
      if (HAS_BOT && (!pick[1] || rnd() < 0.5)) {
        byBot = true;
        mv = call('bot', { state, seat, ctx: { options, now: clock.now }, seed: callSeed(seed, counter.n++) });
        if (mv === null || mv === undefined) throw new Error('bot() không trả nước đi cho ghế ' + seat + ' dù ván chưa xong');
      } else {
        mv = pick[1][Math.floor(rnd() * pick[1].length)];
      }
      // 10% nước: hỏi gợi ý 💡 như khung (seed riêng, không đụng rng ván) và đi theo — gợi ý phải là nước hợp lệ; null = không có gợi ý (được phép).
      if (HINT_FN && rnd() < 0.1) {
        const hv = hintMove(call(HINT_FN, { state, seat, ctx: { options, now: clock.now }, seed: callSeed(seed ^ 0x5bd1e995, hints) }));
        if (hv !== null) { mv = hv; byBot = true; hints++; }
      }
    }
    const r = call('move', { state, ctx: { player: seat, move: mv, now: clock.now }, seed: callSeed(seed, counter.n++) });
    if (!r || r.error) {
      // Game thời gian thực: legal() không biết now — nước hợp lệ lúc nhịp tick trước có thể vừa hết hạn (now đã qua deadline
      // nhưng chưa tới nhịp tick). Máy chủ thật cũng từ chối y vậy -> không phải lỗi, NẾU sau khi tick tới now nước đó hết hợp lệ.
      if (TICK_MS && !byBot && mv.type !== 'resign' && JSON.stringify(r && r.state !== undefined ? r.state : state) === JSON.stringify(state)) {
        const probe = call('tick', { state, ctx: { now: clock.now }, seed: callSeed(seed, counter.n) });
        const still = (probe && probe.state && call('legal', { state: probe.state, seat }) || []).some((x) => JSON.stringify(x) === JSON.stringify(mv));
        if (!still) { raced++; continue; }
      }
      throw new Error((byBot ? 'nước của BOT ' : 'nước hợp lệ ') + JSON.stringify(mv) + ' bị từ chối: ' + (r && r.error));
    }
    if (!r.state) throw new Error('move() không trả state');
    state = r.state;
    moves.push([seat, mv]);
    // room.dropin (vào/ra giữa ván): rời không phải thua — bỏ ràng buộc "2 người, 1 rời = hết ván" (CHUAN-GIAO-TIEP.md).
    if (mv.type === 'resign' && !call('result', { state }) && np === 2 && !(manifest.room && manifest.room.dropin)) throw new Error('đầu hàng nhưng ván chưa kết thúc');
    if (mv.type === 'resign' && !call('result', { state })) contract.afterResign(call('view', { state, seat }));
    // Game có undo() riêng: thỉnh thoảng xin đi lại như khung sẽ gọi — phải trả {state} (hoặc {state, error}), không ném lỗi,
    // state lùi vẫn là ván đang chơi (result null) và đi tiếp được.
    if (UNDO_FN && mv.type !== 'resign' && !call('result', { state }) && rnd() < 0.08) {
      const who = Math.floor(rnd() * np);
      const u = call('undo', { state, ctx: { player: who, now: clock.now }, seed: callSeed(seed, counter.n++) });
      if (!u || typeof u !== 'object' || !u.state || typeof u.state !== 'object') throw new Error('undo() phải trả {state, error?}');
      if (!u.error) {
        if (call('result', { state: u.state })) throw new Error('undo() trả state đã có kết quả');
        state = u.state;
        undos++;
      }
    }
  }
  const res = call('result', { state });
  if (!res) throw new Error('quá ' + MAX_STEPS + ' bước (' + moves.length + ' nước, ' + clock.ticks + ' tick) chưa kết thúc');
  if (!Array.isArray(res.winners)) throw new Error('result.winners phải là mảng');
  const after = call('move', { state, ctx: { player: 0, move: moves.length ? moves[0][1] : {}, now: clock.now }, seed: 1 });
  if (!after || !after.error) throw new Error('đi tiếp sau khi ván kết thúc vẫn được chấp nhận');
  if (TICK_MS) {
    // tick sau khi ván xong không được làm hỏng gì: state vẫn JSON, result giữ nguyên
    const tr = call('tick', { state, ctx: { now: clock.now + TICK_MS }, seed: 2 });
    if (!tr || !tr.state) throw new Error('tick() sau khi ván xong phải vẫn trả {state}');
    if (!call('result', { state: tr.state })) throw new Error('tick() sau khi ván xong làm mất kết quả');
  }
  if (record) record.final = JSON.stringify(state);
  return { res, moves: moves.length, ticks: clock.ticks, raced, undos, hints };
}

if (!game.has('legal') && !HAS_BOT && !TICK_MS) {
  console.log('Ván ngẫu nhiên: BỎ QUA (game không có hàm tùy chọn legal(state, seat), bot hay tick)');
} else {
  console.log('Ván ngẫu nhiên (' + ROUNDS + ' ván, seed ' + SEED + (HAS_BOT ? ', có máy chơi' : '') +
    (TICK_MS ? ', đồng hồ giả + tick mỗi ' + TICK_MS + ' ms' : '') + '):');
  const tally = { win: 0, draw: 0, resign: 0, none: 0, moves: 0, ticks: 0, raced: 0, undos: 0, hints: 0 };
  let roundFails = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const seed = (SEED + 1000 + i) >>> 0;
    try {
      const rec1 = {}, rec2 = {};
      const out = playRandom(seed, rec1);
      if (i < 20) { playRandom(seed, rec2); if (rec1.final !== rec2.final) throw new Error('không tất định: chơi lại cùng seed ra state khác'); }
      tally.moves += out.moves;
      tally.ticks += out.ticks;
      tally.raced += out.raced;
      tally.undos += out.undos;
      tally.hints += out.hints;
      if (out.res.scored === false) tally.none++; else if (out.res.draw) tally.draw++; else if (out.res.reason === 'resign') tally.resign++; else tally.win++;
    } catch (e) {
      roundFails++;
      if (roundFails <= 5) bad('ván seed ' + seed + ': ' + e.message);
    }
  }
  if (roundFails > 5) bad('... tổng ' + roundFails + ' ván lỗi');
  console.log('  ' + (roundFails ? '✗' : 'ĐẠT') + '   ' + ROUNDS + ' ván: thắng ' + tally.win + ', đầu hàng ' + tally.resign +
    ', hòa ' + tally.draw + (tally.none ? ', không tính điểm ' + tally.none : '') + ', trung bình ' + Math.round(tally.moves / ROUNDS) + ' nước/ván' +
    (TICK_MS ? ', ' + Math.round(tally.ticks / ROUNDS) + ' tick/ván' + (tally.raced ? ', ' + tally.raced + ' nước gửi trễ bị từ chối đúng' : '') : '') +
    (UNDO_FN ? ', ' + tally.undos + ' lần undo()' : '') + (HINT_FN ? ', ' + tally.hints + ' nước theo gợi ý ' + HINT_FN + '()' : '') + '; 20 ván đầu chơi lại tất định');
  if (eventMoves) {
    console.log('  ' + (UI_EVENTS ? 'ĐẠT' : 'Lưu ý') + '   ' + eventMoves + ' nước trả events' +
      (UI_EVENTS ? ' (manifest ui.events: máy phát game:event thay view' + (eventTooBig ? '; ' + eventTooBig + ' nước events > 16 KB -> máy gửi lại view' : '') + ')'
        : ' nhưng manifest chưa khai "ui": {"events": true} -> máy bỏ qua, vẫn gửi lại view'));
  }
}

/* ---------- 2b. Máy chơi: máy đấu máy với mọi tùy chọn, không nước sai, không treo, tất định ---------- */
if (HAS_BOT) {
  contract.np = 0;   // máy đấu máy: số ghế khác ván ngẫu nhiên — không soi hợp đồng ở đây
  console.log('Máy đấu máy (mỗi tổ hợp tùy chọn 3 ván):');
  const combos = [{}];
  (manifest.options || []).forEach((d) => {
    const next = [];
    combos.forEach((c) => d.choices.forEach((v) => next.push(Object.assign({}, c, { [d.key]: v }))));
    combos.splice(0, combos.length, ...next.slice(0, 64));
  });
  let botFails = 0;
  combos.forEach((options, ci) => {
    for (let g = 0; g < 3; g++) {
      const seed = (SEED + 5000 + ci * 10 + g) >>> 0;
      const finals = [];
      try {
        for (let rep = 0; rep < 2; rep++) {
          const np = manifest.players.min;
          let n = 0;
          let now = BASE_NOW;
          let state = call('setup', { ctx: { players: players(np), options, now }, seed: callSeed(seed, n++) });
          let moves = 0, idleTicks = 0;
          while (!call('result', { state }) && moves < 5000) {
            now += 700;
            const v = call('view', { state, seat: -1 }) || {};
            let seat = Number.isInteger(v.turn) ? v.turn : -1;
            if (seat < 0 || seat >= np) {
              // không có view.turn: thử từng ghế, ghế nào bot trả nước thì đi
              seat = -1;
              for (let s = 0; s < np && seat < 0; s++) if (call('bot', { state, seat: s, ctx: { options, now }, seed: callSeed(seed, n) }) !== null) seat = s;
              if (seat < 0 && TICK_MS && ++idleTicks < 20000) {
                // Game thời gian thực (đang lộ bài, chờ hết giờ…): máy chưa có việc -> cho đồng hồ chạy 1 nhịp như máy chủ.
                const tr = call('tick', { state, ctx: { now }, seed: callSeed(seed, n++) });
                if (!tr || !tr.state) throw new Error('tick() phải trả {state}');
                state = tr.state;
                now += TICK_MS - 700;
                continue;
              }
              if (seat < 0) throw new Error('không ghế nào có nước của máy');
            }
            const mv = call('bot', { state, seat, ctx: { options, now }, seed: callSeed(seed, n++) });
            if (mv === null || mv === undefined) throw new Error('máy ghế ' + seat + ' không trả nước');
            const r = call('move', { state, ctx: { player: seat, move: mv, now }, seed: callSeed(seed, n++) });
            if (!r || r.error) throw new Error('nước của máy ' + JSON.stringify(mv) + ' bị từ chối: ' + (r && r.error));
            state = r.state;
            moves++;
          }
          if (!call('result', { state })) throw new Error('quá 5000 nước chưa kết thúc');
          finals.push(JSON.stringify(state) + '|' + moves);
        }
        if (finals[0] !== finals[1]) throw new Error('máy không tất định (cùng seed ra ván khác)');
      } catch (e) {
        botFails++;
        if (botFails <= 5) bad('máy đấu máy ' + JSON.stringify(options) + ' seed ' + seed + ': ' + e.message);
      }
    }
  });
  if (botFails > 5) bad('... tổng ' + botFails + ' ván máy lỗi');
  if (!botFails) console.log('  ĐẠT   ' + combos.length * 3 + ' ván máy đấu máy kết thúc, không nước sai, tất định');
}

/* ---------- 3. Sandbox tự kiểm: vòng lặp vô hạn bị cắt, Math.random / Date / eval bị chặn ---------- */
console.log('Sandbox:');
[['vòng lặp vô hạn bị cắt sau ' + LIMIT_MS + ' ms', 'while (true) {}'],
  ['Math.random bị chặn', 'return Math.random();'],
  ['Date không có', 'return Date.now();'],
  ['eval / new Function bị chặn', 'return eval("1+1");'],
  ['require / process không có', 'return require("fs") || process.exit(1);'],
  ['chữ async/await (kể cả trong chú thích) bị từ chối lúc nạp', 'return 1; /* không async */']].forEach(([label, body]) => {
  const evil = 'module.exports = { setup: function () { ' + body + ' }, move: function(){}, view: function(){}, result: function(){} };';
  try {
    loadGame(evil, { timeout: LIMIT_MS }).call('setup', { ctx: {}, seed: 1 });
    bad(label + ' — KHÔNG bị chặn');
  } catch (e) {
    console.log('  ĐẠT   ' + label + ' (' + e.message.split('\n')[0].slice(0, 60) + ')');
  }
});

contract.np = 0;   // phần dưới (sandbox tự kiểm, máy đấu máy) không soi hợp đồng
fails += contract.report((l) => console.log(l));
console.log('Thời gian mỗi lần gọi (giới hạn ' + LIMIT_MS + ' ms):');
Object.keys(timing).forEach((fn) => {
  const t = timing[fn];
  const line = '  ' + fn.padEnd(7) + ' ' + String(t.n).padStart(7) + ' lần   tb ' + (t.sum / t.n).toFixed(3) +
    ' ms   max ' + t.max.toFixed(3) + ' ms';
  if (t.max > LIMIT_MS) bad(line); else console.log(line);
});

console.log(fails ? 'KẾT QUẢ: TRƯỢT — ' + fails + ' lỗi' : 'KẾT QUẢ: ĐẠT — 0 lỗi');
process.exit(fails ? 1 : 0);
