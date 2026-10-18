/*
 * Oẳn tù tì — TRÒ MẪU của devkit Jagame, viết theo GIAO THỨC GAME v2 (CHUAN-GIAO-TIEP.md) bằng SDK jg-core.
 * manifest "sdk": "2" → công cụ tự chèn jg-core.js lên đầu file này (biến JGCore có sẵn). KHÔNG require gì.
 * Luật sandbox: đồng bộ, tất định, state là JSON thuần; ngẫu nhiên CHỈ qua ctx.rng; giờ CHỈ qua ctx.now (ms).
 *
 * Thể loại: hành động đồng thời + pha bí mật rồi lộ (kind 'simultaneous') + đồng hồ theo tick (manifest tick_ms 1000).
 * Nước đi: {type:'pick', hand:'bua'|'bao'|'keo'} · {type:'resign'} (SDK xử lý: 2 người → người kia thắng, reason 'resign').
 * Kết thúc: ai đủ số hiệp thắng trước → reason 'win'; quá 15 hiệp → nhiều hiệp thắng hơn thắng (reason 'score', bằng nhau = hòa).
 */
'use strict';

var HANDS = ['bua', 'bao', 'keo'];
var BEATS = { bua: 'keo', keo: 'bao', bao: 'bua' };   // khóa thắng giá trị
var MAX_ROUNDS = 15;
var REVEAL_MS = 2500;

function newRound(s) {
  s.picks = JGCore.fill(s.jg.n, null);
  s.jg.phase = 'pick';
  JGCore.setDeadline(s, s.thinkMs);
}

function reveal(s) {
  var a = s.picks[0], b = s.picks[1], w = a === b ? -1 : (BEATS[a] === b ? 0 : 1);
  if (w >= 0) s.wins[w] += 1;
  s.last = { round: s.round, hands: [a, b], winner: w };
  JGCore.log(s, { t: 'round', round: s.round, hands: [a, b], winner: w });
  s.round += 1;
  if (w >= 0 && s.wins[w] >= s.target) return JGCore.end(s, { winners: [w], reason: 'win', scores: s.wins });
  if (s.round > MAX_ROUNDS) return JGCore.endByScore(s, s.wins, 'score', { drawOnTie: true });
  s.jg.phase = 'reveal';
  JGCore.setDeadline(s, REVEAL_MS);
}

module.exports = JGCore.game({
  kind: 'simultaneous',

  setup: function (s, ctx) {
    var o = ctx.options || {};
    s.target = o.best_of === 5 ? 3 : 2;
    s.thinkMs = (o.think === 20 ? 20 : 10) * 1000;
    s.wins = JGCore.fill(s.jg.n, 0);
    s.round = 1;
    s.last = null;
    newRound(s);
  },

  moves: {
    pick: {
      args: { hand: HANDS },              // SDK tự từ chối hand lạ: "Nước đi không hợp lệ (hand không thuộc lựa chọn)"
      phase: 'pick',
      run: function (s, ctx, mv) {
        if (s.picks[ctx.player]) return 'Bạn đã chọn rồi, chờ bạn kia nhé';
        s.picks[ctx.player] = mv.hand;
        if (s.picks.every(Boolean)) reveal(s);
      }
    }
  },

  /* Đồng hồ: hết giờ chọn → máy chọn ngẫu nhiên giúp người chưa chọn; hết giờ xem kết quả → hiệp mới. */
  tick: function (s, ctx) {
    if (!JGCore.expired(s)) return;
    if (s.jg.phase === 'pick') {
      for (var i = 0; i < s.jg.n; i++) if (!s.picks[i]) s.picks[i] = JGCore.pick(ctx.rng, HANDS);
      reveal(s);
    } else newRound(s);
  },

  scores: function (s) { return s.wins.slice(); },

  /* ẨN THÔNG TIN: chỉ thấy tay của CHÍNH mình; người khác chỉ biết "đã chọn". */
  view: function (s, you, v) {
    v.round = s.round;
    v.target = s.target;
    v.picked = s.picks.map(Boolean);
    v.mine = you >= 0 ? s.picks[you] : null;
    v.last = s.last;
  },

  legal: function (s, seat) {
    if (s.jg.phase !== 'pick' || s.picks[seat]) return [];
    return HANDS.map(function (h) { return { type: 'pick', hand: h }; });
  },

  bot: function (s, seat, ctx) {
    if (s.jg.phase !== 'pick' || s.picks[seat]) return null;   // null = chưa có việc (khung hỏi lại khi state đổi)
    return { type: 'pick', hand: JGCore.pick(ctx.rng, HANDS) };
  }
});
