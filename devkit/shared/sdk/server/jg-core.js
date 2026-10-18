/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════
   Jagame SDK — jg-core (phía máy chủ) · giao thức game v2 · CHUAN-GIAO-TIEP.md
   ───────────────────────────────────────────────────────────────────────────────────────────────────────
   KHÔNG require file này. Manifest khai "sdk": "2" → công cụ (build kho, test_game, play.html, devkit) tự CHÈN nguyên
   file này lên ĐẦU server/game.js lúc đóng gói / chạy thử. Trong game.js dùng thẳng biến toàn cục JGCore.
   Tuân luật sandbox: đồng bộ, tất định, không Date / Math.random / require / Promise; mọi ngẫu nhiên đi qua ctx.rng.

     module.exports = JGCore.game({
       kind: 'turn',                               // 'turn' | 'simultaneous' | 'realtime'
       setup: function (s, ctx) { ... },           // s đã có phong bì s.jg (n, names, bots, out, done, finish, end, now, turn, phase)
       moves: { play: { args: {x: 'int'}, turn: true, run: function (s, ctx, mv) { ... } } },
       view:  function (s, seat, v) { v.board = s.board; }
     });

   Hàm trong moves/tick/onResign SỬA THẲNG s (SDK đã chép sâu trước khi gọi); trả chuỗi / JGCore.err(...) = từ chối nước
   (SDK trả lại state cũ, không đổi gì). Kết thúc ván: JGCore.end(s, {winners, reason, draw?, ranks?}).
   Phiên ứng dụng không thắng thua: JGCore.end(s, {scored: false, reason}) hoặc JGCore.game({scored: false, …}) (SDK 2.1).
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
var JGCore = (function () {
  'use strict';
  var VERSION = '2.1.0';

  /* ───────────────────────── tiện ích dữ liệu ───────────────────────── */
  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(typeof v === 'function' ? v(i) : clone(v)); return a; }
  function range(n) { return fill(n, function (i) { return i; }); }
  function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i] || 0; return t; }

  /* ───────────────────────── ngẫu nhiên tất định (CHỈ qua ctx.rng) ───────────────────────── */
  function rint(rng, n) { return Math.floor(rng() * n); }
  function pick(rng, a) { return a.length ? a[rint(rng, a.length)] : undefined; }
  /** Xáo Fisher–Yates TẠI CHỖ từ cuối mảng (i = len-1..1, j = floor(rng()*(i+1))) — đúng thứ tự gọi rng các game v1 đang dùng. */
  function shuffle(rng, a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ───────────────────────── lỗi chuẩn ───────────────────────── */
  var ERR = {
    ended: 'Ván đã kết thúc', seat: 'Bạn không ngồi ở bàn này', 'bad-move': 'Nước đi không hợp lệ',
    'not-your-turn': 'Chưa tới lượt bạn', 'wrong-phase': 'Chưa tới lúc làm việc này', 'you-done': 'Bạn đã rời ván rồi',
    rule: 'Sai luật', forbidden: 'Bạn không được làm việc này', limit: 'Hết lượt dùng', timeout: 'Hết giờ rồi'
  };
  /** Lỗi có mã: {error: chữ tiếng Việt, code}. Máy hiện chữ; code để công cụ / khung sau này phân loại. */
  function err(code, text) { return { error: text || ERR[code] || String(code), code: ERR[code] ? code : 'rule' }; }

  /* ───────────────────────── lý do kết thúc chuẩn ───────────────────────── */
  // by: 'loser' = việc của NGƯỜI THUA (khung gắn tên người thua vào phụ đề), 'winner' = việc của người thắng, 'none' = hòa/trung tính.
  var REASONS = {
    resign: 'loser', disconnect: 'loser', leave: 'loser', 'het-gio': 'loser',
    win: 'winner', score: 'winner', finish: 'winner', 'het-nguoi': 'winner', 'het-van': 'winner', 'sach-dau': 'winner',
    'het-luot': 'none', draw: 'none',
    // lý do riêng của các game kho đã có trong REASONS của khung (khung Jagame) — dùng lại được:
    checkmate: 'winner', stalemate: 'none', five: 'winner', 'draw-agree': 'none', 'draw-50': 'none', repetition: 'none',
    full: 'none', 'tan-cuoc': 'winner', 'all-home': 'winner', 'low-beans': 'winner', 'het-dan': 'loser', 'all-down': 'winner',
    general: 'winner', 'all-soldiers': 'winner', kinh: 'winner', 'het-so': 'none', 'het-cau': 'winner', 'het-quan': 'winner',
    'draw-200': 'none', 'poker-bust': 'winner', 'poker-hands': 'winner', 've-xong': 'winner', 'bai-diem': 'winner',
    'het-soi': 'winner', 'soi-thang': 'winner', whitewin: 'winner', 'phom-diem': 'winner'
  };
  var REASON_RE = /^[a-z][a-z0-9-]{1,23}$/;

  /* ───────────────────────── kiểm dữ liệu nước đi ───────────────────────── */
  /**
   * spec: 'int' | 'num' | 'str' | 'bool' | 'cards' (mảng mã lá) | 'ints' | [giá trị cho phép] | {int:[min,max]} |
   *       {str: maxLen} | {arr: spec, max: n} | {opt: spec} (tùy chọn). Trả null (đúng) hoặc chữ lỗi.
   */
  function checkArg(v, spec) {
    if (spec && spec.opt !== undefined) return v === undefined ? null : checkArg(v, spec.opt);
    if (v === undefined) return 'thiếu';
    if (Array.isArray(spec)) return spec.indexOf(v) >= 0 ? null : 'không thuộc lựa chọn';
    if (spec === 'int') return isInt(v) ? null : 'phải là số nguyên';
    if (spec === 'num') return typeof v === 'number' && isFinite(v) ? null : 'phải là số';
    if (spec === 'bool') return typeof v === 'boolean' ? null : 'phải là đúng/sai';
    if (spec === 'str') return typeof v === 'string' && v.length <= 200 ? null : 'phải là chữ ≤ 200';
    if (spec === 'ints') return Array.isArray(v) && v.length <= 64 && v.every(isInt) ? null : 'phải là mảng số nguyên';
    if (spec === 'cards') {
      return Array.isArray(v) && v.length <= 60 && v.every(function (c) { return typeof c === 'string' && c.length <= 4; })
        ? null : 'phải là mảng mã lá';
    }
    if (isObj(spec) && spec.int) return isInt(v) && v >= spec.int[0] && v <= spec.int[1] ? null : 'ngoài khoảng';
    if (isObj(spec) && spec.str !== undefined) return typeof v === 'string' && v.length <= spec.str ? null : 'chữ quá dài';
    if (isObj(spec) && spec.arr !== undefined) {
      if (!Array.isArray(v) || v.length > (spec.max || 64)) return 'phải là mảng';
      for (var i = 0; i < v.length; i++) if (checkArg(v[i], spec.arr)) return 'phần tử sai';
      return null;
    }
    return 'kiểu lạ';
  }
  function checkArgs(mv, args) {
    for (var k in args) {
      if (!Object.prototype.hasOwnProperty.call(args, k)) continue;
      var e = checkArg(mv[k], args[k]);
      if (e) return k + ' ' + e;
    }
    return null;
  }

  /* ───────────────────────── ghế ───────────────────────── */
  var Seats = {
    /** Ghế kế sau `from` (vòng tròn) thỏa ok(seat); -1 nếu không có. dir = 1 | -1. */
    next: function (from, n, ok, dir) {
      dir = dir === -1 ? -1 : 1;
      for (var i = 1; i <= n; i++) { var q = ((from + dir * i) % n + n) % n; if (!ok || ok(q)) return q; }
      return -1;
    },
    list: function (n, ok) { var o = []; for (var i = 0; i < n; i++) if (!ok || ok(i)) o.push(i); return o; },
    /** Ghế còn trong ván (chưa đầu hàng/rời) theo phong bì s.jg. */
    alive: function (s) { return Seats.list(s.jg.n, function (i) { return !s.jg.out[i]; }); },
    /** Ghế còn phải chơi (chưa rời, chưa "xong phần mình"). */
    playing: function (s) { return Seats.list(s.jg.n, function (i) { return !s.jg.out[i] && !s.jg.done[i]; }); }
  };

  /* ───────────────────────── bộ bài ───────────────────────── */
  var Cards = {
    RANKS: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
    SUITS: ['S', 'C', 'D', 'H'],
    /** Bộ 52 lá mã '10H' 'AS' (giống shared/cards): duyệt chất rồi hạng. opts {ranks, suits, copies}. */
    deck: function (opts) {
      opts = opts || {};
      var ranks = opts.ranks || Cards.RANKS, suits = opts.suits || Cards.SUITS, d = [], c;
      for (c = 0; c < (opts.copies || 1); c++) suits.forEach(function (su) { ranks.forEach(function (r) { d.push(r + su); }); });
      return d;
    },
    rank: function (c) { return String(c).slice(0, -1); },
    suit: function (c) { return String(c).slice(-1); },
    /** Chia vòng: k lá cho mỗi ghế trong seats (rút từ CUỐI bộ như deck.pop()). Trả {seat: [lá]}. */
    deal: function (deck, seats, k) {
      var out = {}, i;
      seats.forEach(function (q) { out[q] = []; });
      for (i = 0; i < k; i++) seats.forEach(function (q) { if (deck.length) out[q].push(deck.pop()); });
      return out;
    },
    /** Che bài: trả mảng cùng độ dài toàn -1 (client vẽ lưng bài). */
    mask: function (hand) { return hand ? hand.map(function () { return -1; }) : hand; }
  };

  /* ───────────────────────── đậu ảo (KHÔNG BAO GIỜ là tiền thật) ───────────────────────── */
  var Beans = {
    /** Chuyển tối đa amt đậu từ `from` sang `to`; người trả không xuống âm trừ khi allowNegative. Trả số đậu đã chuyển. */
    pay: function (beans, from, to, amt, allowNegative) {
      var a = allowNegative ? amt : Math.max(0, Math.min(amt, beans[from]));
      beans[from] -= a; if (to >= 0) beans[to] += a;
      return a;
    },
    broke: function (beans, i, min) { return beans[i] < (min || 1); },
    /** Ghế có nhiều đậu nhất trong danh sách seats (hòa thì nhiều ghế). */
    leaders: function (beans, seats) {
      var max = -Infinity;
      seats.forEach(function (i) { if (beans[i] > max) max = beans[i]; });
      return seats.filter(function (i) { return beans[i] === max; });
    }
  };

  /* ───────────────────────── bàn lưới ───────────────────────── */
  var Grid = {
    make: function (w, h, v) { return fill(h, function () { return fill(w, v === undefined ? null : v); }); },
    inside: function (w, h, x, y) { return isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < w && y < h; },
    DIRS4: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    DIRS8: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    /** Độ dài chuỗi liên tiếp cùng giá trị qua (x,y) theo hướng (dx,dy) — dùng cho caro / 4 quân liền. */
    run: function (g, x, y, dx, dy) {
      var h = g.length, w = g[0].length, v = g[y][x], n = 1, k;
      for (k = 1; Grid.inside(w, h, x + dx * k, y + dy * k) && g[y + dy * k][x + dx * k] === v; k++) n++;
      for (k = 1; Grid.inside(w, h, x - dx * k, y - dy * k) && g[y - dy * k][x - dx * k] === v; k++) n++;
      return n;
    }
  };

  /* ───────────────────────── xếp hạng + kết quả ───────────────────────── */
  /** Hạng theo điểm: ranks[seat] = 1 + số ghế điểm cao hơn (đồng hạng). lowWins: điểm thấp xếp trên. seats: ghế được xếp. */
  function ranksByScore(scores, seats, lowWins) {
    var r = fill(scores.length, null);
    seats.forEach(function (i) {
      var better = 0;
      seats.forEach(function (j) { if (lowWins ? scores[j] < scores[i] : scores[j] > scores[i]) better++; });
      r[i] = better + 1;
    });
    return r;
  }
  /** Chốt ván: ghi s.jg.end (result() đọc lại). Gọi lại khi đã chốt thì bỏ qua. */
  function end(s, r) {
    if (s.jg.end) return s.jg.end;
    if (r.scored === false || s.jg.unscored) {
      // "Không tính điểm" (SDK 2.1): không người thắng, không hòa — khung ghi "Xong phiên", không thống kê/xếp hạng/huy hiệu/tim.
      s.jg.end = { winners: [], reason: r.reason || 'finish', scored: false };
      s.jg.phase = 'ended'; s.jg.turn = null; s.jg.deadline = null;
      return s.jg.end;
    }
    var winners = (r.winners || []).filter(isInt).slice().sort(function (a, b) { return a - b; });
    var e = { winners: winners, reason: r.reason || 'win' };
    if (r.draw || (!winners.length && r.draw !== false)) e.draw = true;
    if (r.ranks) e.ranks = r.ranks.slice();
    if (r.scores) e.scores = r.scores.slice();
    s.jg.end = e; s.jg.phase = 'ended'; s.jg.turn = null; s.jg.deadline = null;
    return e;
  }
  /** Chốt theo điểm: người (còn trong ván) điểm cao nhất thắng; nhiều người bằng nhau → cùng thắng (draw nếu tất cả bằng). */
  function endByScore(s, scores, reason, opts) {
    opts = opts || {};
    var seats = opts.seats || Seats.alive(s);
    var best = opts.lowWins ? Infinity : -Infinity;
    seats.forEach(function (i) { if (opts.lowWins ? scores[i] < best : scores[i] > best) best = scores[i]; });
    var winners = seats.filter(function (i) { return scores[i] === best; });
    return end(s, { winners: winners, reason: reason, draw: opts.drawOnTie && winners.length > 1,
      ranks: ranksByScore(scores, seats, opts.lowWins), scores: scores });
  }

  /* ───────────────────────── nhật ký ván (tùy chọn, ≤ 30 dòng cuối) ───────────────────────── */
  function log(s, entry) {
    var l = s.jg.log || (s.jg.log = []);
    s.jg.seq = (s.jg.seq || 0) + 1;
    var e = { i: s.jg.seq }; for (var k in entry) if (Object.prototype.hasOwnProperty.call(entry, k)) e[k] = entry[k];
    l.push(e);
    if (l.length > 30) l.splice(0, l.length - 30);
    return e;
  }

  /* ───────────────────────── hạn giờ ───────────────────────── */
  // Hai kiểu: (1) theo ms tuyệt đối của máy chủ: setDeadline(s, ms) — so với ctx.now ở move/tick; (2) đếm nhịp tick: game tự giữ
  // bộ đếm và trả timer qua def.timer(s). View luôn gửi dạng TƯƠNG ĐỐI {left, total} (ms) → không lệch đồng hồ máy khách.
  function setDeadline(s, ms, seat) {
    s.jg.deadline = s.jg.now + ms; s.jg.timerTotal = ms; s.jg.timerSeat = isInt(seat) ? seat : null;
  }
  function clearDeadline(s) { s.jg.deadline = null; s.jg.timerTotal = null; s.jg.timerSeat = null; }
  function expired(s) { return s.jg.deadline !== null && s.jg.deadline !== undefined && s.jg.now >= s.jg.deadline; }

  /* ───────────────────────── phong bì state + bộ chuyển GameDef v2 → API máy v1 ───────────────────────── */
  function envelope(ctx) {
    var players = (ctx && ctx.players) || [];
    var n = players.length;
    return {
      v: 2, n: n,
      names: players.map(function (p, i) { return p && p.name ? String(p.name).slice(0, 40) : 'Người ' + (i + 1); }),
      bots: players.map(function (p) { return !!(p && p.bot); }),
      out: fill(n, false), done: fill(n, false), finish: [], end: null,
      now: ctx && isFinite(ctx.now) ? ctx.now : 0, turn: null, phase: 'play', deadline: null, timerTotal: null, timerSeat: null
    };
  }

  function normalizeReturn(r) {
    if (r === undefined || r === null || r === true) return null;
    if (typeof r === 'string') return { error: r, code: 'rule' };
    if (isObj(r) && r.error) return { error: String(r.error), code: r.code || 'rule' };
    return null;
  }

  /**
   * GameDef v2 → module.exports theo API máy v1 (setup/move/view/result/tick/legal/bot/undo/hint).
   * def: { kind, minAlive, resign, setup, moves | move, view, tick, legal, bot, undo, hint, onResign, turn, phase, timer, scores, result, scored }
   */
  function game(def) {
    var kind = def.kind || 'turn';
    var minAlive = def.minAlive || 2;

    function defaultResign(s, seat) {
      s.jg.out[seat] = true;
      if (s.jg.finish.indexOf(seat) < 0) s.jg.done[seat] = true;
      var alive = Seats.alive(s);
      if (def.resign === 'end' || alive.length < minAlive) {
        end(s, { winners: alive, reason: 'resign', draw: alive.length === 0 });
      } else if (kind === 'turn' && s.jg.turn === seat) {
        s.jg.turn = Seats.next(seat, s.jg.n, function (q) { return !s.jg.out[q] && !s.jg.done[q]; });
      }
    }

    var api = {
      setup: function (ctx) {
        var s = { jg: envelope(ctx) };
        if (def.scored === false) s.jg.unscored = true;   // mọi JGCore.end của gói (kể cả rời phòng) -> không tính điểm
        var r = def.setup ? def.setup(s, ctx) : null;
        if (isObj(r) && r !== s) { for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k) && k !== 'jg') s[k] = r[k]; }
        return s;
      },

      move: function (state, ctx) {
        var seat = ctx && ctx.player, mv = ctx && ctx.move;
        if (!state || !state.jg || state.jg.end) return { state: state, error: ERR.ended, code: 'ended' };
        if (!isInt(seat) || seat < 0 || seat >= state.jg.n) return { state: state, error: ERR.seat, code: 'seat' };
        if (!isObj(mv) || typeof mv.type !== 'string' || mv.type.length > 32) return { state: state, error: ERR['bad-move'], code: 'bad-move' };
        if (state.jg.out[seat]) return { state: state, error: ERR['you-done'], code: 'you-done' };
        var s = clone(state);
        if (ctx && isFinite(ctx.now)) s.jg.now = ctx.now;
        var events = [], c = { player: seat, move: mv, now: s.jg.now, rng: ctx && ctx.rng, events: events };
        var bad;
        if (mv.type === 'resign') {
          bad = normalizeReturn(def.onResign ? def.onResign(s, seat, c, defaultResign) : defaultResign(s, seat));
        } else if (def.moves) {
          var m = Object.prototype.hasOwnProperty.call(def.moves, mv.type) ? def.moves[mv.type] : null;
          if (!m) return { state: state, error: ERR['bad-move'], code: 'bad-move' };
          var why = m.args ? checkArgs(mv, m.args) : null;
          if (why) return { state: state, error: ERR['bad-move'] + ' (' + why + ')', code: 'bad-move' };
          if (m.phase && (Array.isArray(m.phase) ? m.phase : [m.phase]).indexOf(api.$phase(s)) < 0) {
            return { state: state, error: m.phaseError || ERR['wrong-phase'], code: 'wrong-phase' };
          }
          if (m.turn && api.$turn(s) !== seat) return { state: state, error: ERR['not-your-turn'], code: 'not-your-turn' };
          if (s.jg.done[seat] && !m.whenDone) return { state: state, error: m.doneError || 'Bạn đã xong phần mình rồi', code: 'you-done' };
          bad = normalizeReturn(m.run(s, c, mv));
        } else if (def.move) {
          bad = normalizeReturn(def.move(s, c, mv));
        } else {
          return { state: state, error: ERR['bad-move'], code: 'bad-move' };
        }
        if (bad) return { state: state, error: bad.error, code: bad.code };
        var out = { state: s };
        if (events.length) out.events = events;
        return out;
      },

      view: function (state, seat) {
        var s = state, you = isInt(seat) && seat >= 0 && seat < s.jg.n ? seat : -1;
        var v = {};
        var r = def.view ? def.view(s, you, v) : null;
        if (isObj(r) && r !== v) v = r;
        // ── trường chuẩn v2 (game đã tự đặt thì giữ của game) ──
        if (v.proto === undefined) v.proto = 2;
        if (v.phase === undefined) v.phase = api.$phase(s);
        if (v.turn === undefined) v.turn = api.$turn(s, you);
        if (v.you === undefined) v.you = you;
        if (v.youDone === undefined) v.youDone = you >= 0 && !!(s.jg.out[you] || s.jg.done[you]);
        if (v.seats === undefined) {
          v.seats = s.jg.names.map(function (name, i) {
            return { name: name, out: !!s.jg.out[i], done: !!s.jg.done[i], bot: !!s.jg.bots[i] };
          });
        }
        if (v.timer === undefined) v.timer = api.$timer(s);
        if (v.scores === undefined) { var sc = def.scores ? def.scores(s) : null; v.scores = Array.isArray(sc) ? sc : null; }
        if (v.finishOrder === undefined) v.finishOrder = s.jg.finish.slice();
        if (v.log === undefined && s.jg.log) v.log = def.logView ? def.logView(s, you) : s.jg.log;
        if (v.result === undefined) v.result = s.jg.end ? clone(s.jg.end) : null;
        return v;
      },

      result: function (state) {
        if (!state || !state.jg) return null;
        if (state.jg.end) {
          var e = state.jg.end, r = { winners: e.winners.slice(), reason: e.reason };
          if (e.scored === false) r.scored = false;
          if (e.draw) r.draw = true;
          if (e.ranks) r.ranks = e.ranks.slice();
          return r;
        }
        return def.result ? def.result(state) : null;
      },

      /* nội bộ (tiền tố $ — không phải hàm sandbox gọi) */
      $phase: function (s) { return s.jg.end ? 'ended' : (def.phase ? def.phase(s) : s.jg.phase); },
      $turn: function (s, you) {
        if (s.jg.end) return null;
        if (def.turn) { var t = def.turn(s, you === undefined ? -1 : you); return isInt(t) ? t : null; }
        return kind === 'turn' && isInt(s.jg.turn) ? s.jg.turn : null;
      },
      $timer: function (s) {
        if (s.jg.end) return null;
        if (def.timer) return def.timer(s) || null;
        if (s.jg.deadline === null || s.jg.deadline === undefined) return null;
        return { left: Math.max(0, s.jg.deadline - s.jg.now), total: s.jg.timerTotal, seat: s.jg.timerSeat };
      }
    };

    if (def.tick) {
      api.tick = function (state, ctx) {
        if (!state || !state.jg || state.jg.end) return { state: state };
        var s = clone(state);
        if (ctx && isFinite(ctx.now)) s.jg.now = ctx.now;
        def.tick(s, { now: s.jg.now, rng: ctx && ctx.rng });
        return { state: s };
      };
    }
    if (def.legal) api.legal = function (state, seat) { return !state || !state.jg || state.jg.end || state.jg.out[seat] ? [] : def.legal(state, seat); };
    if (def.bot) api.bot = function (state, seat, ctx) { return !state || !state.jg || state.jg.end || state.jg.out[seat] ? null : def.bot(state, seat, ctx || {}); };
    if (def.hint) api.hint = function (state, seat, ctx) { return def.hint(state, seat, ctx || {}); };
    if (def.undo) {
      api.undo = function (state, ctx) {
        var s = clone(state);
        var bad = normalizeReturn(def.undo(s, ctx || {}));
        return bad ? { state: state, error: bad.error } : { state: s };
      };
    }
    // Xuất thêm cho kiểm thử (tiền tố _ — khung bỏ qua): def gốc + phiên bản SDK.
    api._sdk = function () { return VERSION; };
    return api;
  }

  return Object.freeze({
    VERSION: VERSION, ERR: ERR, REASONS: REASONS, REASON_RE: REASON_RE,
    isInt: isInt, isObj: isObj, clone: clone, fill: fill, range: range, sum: sum,
    int: rint, pick: pick, shuffle: shuffle,
    err: err, checkArg: checkArg, checkArgs: checkArgs,
    Seats: Seats, Cards: Cards, Beans: Beans, Grid: Grid,
    end: end, endByScore: endByScore, ranksByScore: ranksByScore, log: log,
    setDeadline: setDeadline, clearDeadline: clearDeadline, expired: expired,
    game: game
  });
})();
