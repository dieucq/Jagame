'use strict';
/*
 * Nạp server/game.js của 1 gói trong vm context riêng — MẪU THAM CHIẾU cho Realtime (phía máy, S2) chép theo.
 * CHUAN-GIAO-TIEP.md: CommonJS thuần, không require/process/fetch/timer; chỉ Math, JSON; mỗi lần gọi ≤ 250 ms.
 *
 * - Context rỗng, tắt eval/new Function (codeGeneration.strings=false), không Date, Math.random ném lỗi.
 * - Mọi dữ liệu qua lại dạng chuỗi JSON (state phải là JSON thuần — máy lưu state dạng JSON).
 * - ctx.rng() tất định: tạo trong context từ seed uint32 (máy: seed = hash(seed ván, số thứ tự lần gọi)).
 * - Mỗi lần gọi chạy bằng vm.Script với timeout (mặc định 250 ms) -> vòng lặp vô hạn bị cắt.
 *
 *   const g = loadGame(src, { filename: 'caro/server/game.js' });
 *   const state = g.call('setup', { ctx: { players, options }, seed: 123 });
 *   const r = g.call('move', { state, ctx: { player: 0, move: {x:7,y:7}, now: Date.now() }, seed: 124 });
 *   g.call('view', { state, seat: -1 });  g.call('result', { state });  g.has('legal')
 *   g.call('bot', { state, seat: 1, ctx: { options }, seed: 125 })   // máy chơi thay (manifest "bot": true)
 *   g.call('undo', { state, ctx: { player: 0, now }, seed: 126 })   // xin đi lại (manifest "undo": true + hàm tùy chọn undo(state, ctx))
 */
const vm = require('node:vm');

const PRELUDE = `
'use strict';
var module = { exports: {} };
var exports = module.exports;
globalThis.Date = undefined;
Math.random = function () { throw new Error('Không dùng Math.random — dùng ctx.rng()'); };
function __mkrng(seed) {                       // mulberry32 — số thực [0,1) tất định theo seed uint32
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
`;

const CALL = `__out = (function () {
  var a = JSON.parse(__in), g = module.exports, r;
  switch (a.fn) {
    case 'setup':  a.ctx.rng = __mkrng(a.seed); r = g.setup(a.ctx); break;
    case 'move':   a.ctx.rng = __mkrng(a.seed); r = g.move(a.state, a.ctx); break;
    case 'tick':   a.ctx.rng = __mkrng(a.seed); r = g.tick(a.state, a.ctx); break;
    case 'view':   r = g.view(a.state, a.seat); break;
    case 'result': r = g.result(a.state); break;
    case 'legal':  r = g.legal(a.state, a.seat); break;
    case 'bot':    a.ctx.rng = __mkrng(a.seed); r = g.bot(a.state, a.seat, a.ctx); break;
    case 'undo':   a.ctx.rng = __mkrng(a.seed); r = g.undo(a.state, a.ctx); break;
    case 'hint':   a.ctx.rng = __mkrng(a.seed); r = g.hint(a.state, a.seat, a.ctx); break;
    default: throw new Error('hàm lạ');
  }
  if (r && typeof r.then === 'function') throw new Error(a.fn + '() không được trả Promise');
  return r === undefined ? 'null' : JSON.stringify(r);
})();`;

const REQUIRED = ['setup', 'move', 'view', 'result'];
// = khung Jagame ASYNC_RE: máy chủ TỪ CHỐI nạp gói có chữ async/await ở BẤT KỲ đâu trong game.js (kể cả chú thích/
// chuỗi — so khớp thô). Công cụ phải bắt y hệt trước khi phát hành (gói phom 1.0.0 qua test nhưng máy không nạp).
const ASYNC_RE = /\b(?:async|await)\b/;

function loadGame(src, opts) {
  opts = opts || {};
  const timeout = opts.timeout || 250;
  if (ASYNC_RE.test(src)) {
    throw new Error('game.js không được chứa chữ "async"/"await" ở bất kỳ đâu (kể cả chú thích) — máy chủ từ chối nạp (luật chơi chạy đồng bộ)');
  }
  const context = vm.createContext(Object.create(null), {
    name: opts.filename || 'game',
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate'
  });
  vm.runInContext(PRELUDE, context, { timeout: 1000 });
  vm.runInContext(src, context, { filename: opts.filename || 'game.js', timeout: 1000 });
  const kinds = JSON.parse(vm.runInContext(
    'JSON.stringify(Object.keys(module.exports).filter(function(k){return typeof module.exports[k]==="function"}))',
    context, { timeout: 100 }));
  const missing = REQUIRED.filter((k) => kinds.indexOf(k) < 0);
  if (missing.length) throw new Error('game.js thiếu hàm: ' + missing.join(', '));
  const script = new vm.Script(CALL, { filename: 'jagame-call' });

  return {
    exports: kinds,
    has: (fn) => kinds.indexOf(fn) >= 0,
    /** Gọi 1 hàm của game; trả kết quả đã qua JSON. Ném lỗi nếu game ném / quá thời gian. ms = thời gian gọi. */
    call(fn, args) {
      context.__in = JSON.stringify(Object.assign({ fn }, args));
      context.__out = undefined;
      const t0 = process.hrtime.bigint();
      script.runInContext(context, { timeout });
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const out = JSON.parse(context.__out);
      this.lastMs = ms;
      return out;
    },
    lastMs: 0
  };
}

/*
 * Game hành động (manifest mode "action", CHUAN-GIAO-TIEP.md): state THƯỜNG TRÚ trong context giống máy (khung Jagame
 * action/khung) — mỗi lần gọi chỉ truyền input/ảnh chụp qua JSON, không chép state. Bộ kiểm dùng để đo ms/nhịp như máy thật.
 *   const a = loadAction(src, { filename });
 *   a.call('init', { players, options, now, seed })      -> {world}
 *   a.call('frame', { k, now, dt, inputs, bots, snaps: [[vid, seat, area, ts|null, last]], sum, views, res })
 *   a.call('join'|'leave', p) · a.call('world') · a.call('views', [ghế…]) · a.call('dump') (state, để so tất định)
 */
const RESIDENT = `
var __S = null, __opts = {}, __seed = 0;
function __rng() { __seed = (__seed + 0x6D2B79F5) | 0; var t = __seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function __has(n) { return typeof module.exports[n] === 'function'; }
function __act(name, a) {
  var M = module.exports, i, out;
  switch (name) {
    case 'init': __seed = a.seed | 0; __opts = a.options || {}; __S = M.setup({ players: a.players, options: __opts, now: a.now, rng: __rng, seed: a.seed | 0 });
      if (!__S || typeof __S !== 'object') throw new Error('setup() phải trả về state (đối tượng)');
      return { world: __has('world') ? M.world(__S) : null };
    case 'frame':
      if (a.bots && __has('bot')) for (i = 0; i < a.bots.length; i++) { var b = M.bot(__S, a.bots[i], { options: __opts, now: a.now, rng: __rng, k: a.k }); a.inputs[a.bots[i]] = b && typeof b === 'object' ? b : null; }
      M.sim(__S, a.inputs, { dt: a.dt, k: a.k, now: a.now, rng: __rng, options: __opts, events: [] });
      out = { snaps: [], sum: null, views: null, result: null };
      for (i = 0; i < (a.snaps || []).length; i++) { var r = a.snaps[i]; out.snaps.push([r[0], M.snapshot(__S, r[1], r[2], { now: a.now, k: a.k, last: r[4] | 0 }), __has('tiles') && r[3] !== null ? M.tiles(__S, r[3], r[2]) : null]); }
      if (a.sum && __has('summary')) out.sum = M.summary(__S);
      if (a.views && __has('view')) { out.views = []; for (i = 0; i < a.views.length; i++) out.views.push([a.views[i], M.view(__S, a.views[i])]); }
      if (a.res !== false) out.result = M.result(__S);
      return out;
    case 'join': return __has('join') ? (M.join(__S, a) || null) : null;
    case 'leave': if (__has('leave')) M.leave(__S, a); return null;
    case 'world': return __has('world') ? M.world(__S) : null;
    case 'views': out = []; if (__has('view')) for (i = 0; i < a.length; i++) out.push([a[i], M.view(__S, a[i])]); return out;
    case 'result': return M.result(__S);
    case 'dump': return __S;
    default: throw new Error('hàm lạ');
  }
}`;
const ACTION_REQUIRED = ['setup', 'sim', 'snapshot', 'result'];

function loadAction(src, opts) {
  opts = opts || {};
  const timeout = opts.timeout || 250;
  if (ASYNC_RE.test(src)) {
    throw new Error('game.js không được chứa chữ "async"/"await" ở bất kỳ đâu (kể cả chú thích) — máy chủ từ chối nạp (luật chơi chạy đồng bộ)');
  }
  const context = vm.createContext(Object.create(null), { name: opts.filename || 'game', codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
  vm.runInContext(PRELUDE, context, { timeout: 1000 });
  vm.runInContext(src, context, { filename: opts.filename || 'game.js', timeout: 1000 });
  vm.runInContext(RESIDENT, context, { timeout: 1000 });
  const kinds = JSON.parse(vm.runInContext(
    'JSON.stringify(Object.keys(module.exports).filter(function(k){return typeof module.exports[k]==="function"}))', context, { timeout: 100 }));
  const missing = ACTION_REQUIRED.filter((k) => kinds.indexOf(k) < 0);
  if (missing.length) throw new Error('game.js (mode action) thiếu hàm: ' + missing.join(', '));
  const script = new vm.Script('__out = JSON.stringify(__act(__fn, JSON.parse(__in)));', { filename: 'jagame-action' });
  return {
    exports: kinds,
    has: (fn) => kinds.indexOf(fn) >= 0,
    call(fn, arg, ms) {
      context.__fn = fn;
      context.__in = JSON.stringify(arg === undefined ? null : arg);
      context.__out = undefined;
      const t0 = process.hrtime.bigint();
      script.runInContext(context, { timeout: ms || timeout });
      this.lastMs = Number(process.hrtime.bigint() - t0) / 1e6;
      return context.__out === undefined ? null : JSON.parse(context.__out);
    },
    lastMs: 0
  };
}

module.exports = { loadGame, loadAction, ASYNC_RE };
