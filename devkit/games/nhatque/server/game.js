'use strict';
/*
 * Nhặt que — luật chơi (game mẫu devkit, theo lượt). manifest "sdk": "2" → công cụ gộp jg-core lên đầu file: biến JGCore có sẵn.
 * State là JSON thuần; ngẫu nhiên chỉ qua ctx.rng; không require/Date/Promise; mỗi lần gọi phải rất nhanh.
 */
var MAX_TAKE = 3;

function take(s, seat, n) {
  s.left -= n;
  s.last = { seat: seat, n: n };
  JGCore.log(s, { t: 'take', seat: seat, n: n, left: s.left });
  if (s.left <= 0) {
    // người vừa nhặt que cuối cùng thua → người kia thắng
    return JGCore.end(s, { winners: [1 - seat], reason: 'que-cuoi' });
  }
  s.jg.turn = 1 - seat;
}

// Nước tốt nhất: để lại số que chia 4 dư 1 cho đối thủ; không được thì nhặt 1.
function bestTake(left) {
  var n = (left - 1) % (MAX_TAKE + 1);
  return n >= 1 && n <= MAX_TAKE ? n : 1;
}

module.exports = JGCore.game({
  kind: 'turn',
  setup: function (s, ctx) {
    var opt = ctx.options.sticks;
    s.total = opt === 21 || opt === 31 ? opt : 15;
    s.left = s.total;
    s.last = null;
    s.jg.phase = 'play';
    s.jg.turn = 0;                            // ghế 0 đi trước (khung đã xếp ghế theo thứ tự ngồi)
  },
  moves: {
    take: {
      args: { n: { int: [1, MAX_TAKE] } },
      phase: 'play',
      turn: true,
      run: function (s, ctx, mv) {
        if (mv.n > s.left) return 'Chỉ còn ' + s.left + ' que thôi';
        take(s, ctx.player, mv.n);
      }
    }
  },
  view: function (s, you, v) {
    v.total = s.total;
    v.left = s.left;
    v.last = s.last;
    v.maxTake = Math.min(MAX_TAKE, s.left);
  },
  legal: function (s, seat) {
    if (s.jg.end || s.jg.turn !== seat) return [];
    var out = [];
    for (var n = 1; n <= Math.min(MAX_TAKE, s.left); n++) out.push({ type: 'take', n: n });
    return out;
  },
  bot: function (s, seat, ctx) {
    if (s.jg.end || s.jg.turn !== seat) return null;
    var max = Math.min(MAX_TAKE, s.left);
    if (ctx.options.bot_level === 'Dễ' && ctx.rng() < 0.5) return { type: 'take', n: 1 + JGCore.int(ctx.rng, max) };
    return { type: 'take', n: Math.min(bestTake(s.left), max) };
  },
  hint: function (s, seat) {
    if (s.jg.end || s.jg.turn !== seat) return null;
    var n = Math.min(bestTake(s.left), s.left);
    return { move: { type: 'take', n: n }, text: 'Nhặt ' + n + ' que để bạn kia gặp khó' };
  }
});
