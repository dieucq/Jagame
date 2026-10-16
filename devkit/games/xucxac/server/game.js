'use strict';
/*
 * Xúc xắc may rủi — luật chơi (game mẫu devkit, theo lượt 2–6 người). jg-core được công cụ gộp lên đầu file (biến JGCore).
 * Ngẫu nhiên CHỈ qua ctx.rng (tất định theo ván). Người đầu hàng ở ván ≥ 3 người ra khỏi ván, ván chạy tiếp (SDK lo).
 */
function nextTurn(s) {
  s.turnPts = 0;
  s.jg.turn = JGCore.Seats.next(s.jg.turn, s.jg.n, function (q) { return !s.jg.out[q]; });
}

module.exports = JGCore.game({
  kind: 'turn',
  setup: function (s, ctx) {
    var t = ctx.options.target;
    s.target = t === 50 || t === 100 ? t : 30;
    s.scores = JGCore.fill(s.jg.n, 0);
    s.turnPts = 0;
    s.lastRoll = null;           // {seat, d, bust}
    s.jg.phase = 'play';
    s.jg.turn = 0;
  },
  moves: {
    roll: {
      phase: 'play',
      turn: true,
      run: function (s, ctx) {
        var d = 1 + JGCore.int(ctx.rng, 6);
        s.lastRoll = { seat: ctx.player, d: d, bust: d === 1 };
        if (d === 1) return nextTurn(s);
        s.turnPts += d;
      }
    },
    hold: {
      phase: 'play',
      turn: true,
      run: function (s, ctx) {
        if (s.turnPts <= 0) return 'Gieo ít nhất một lần rồi mới giữ điểm';
        s.scores[ctx.player] += s.turnPts;
        s.lastRoll = null;
        if (s.scores[ctx.player] >= s.target) {
          s.turnPts = 0;
          return JGCore.endByScore(s, s.scores, 'win');
        }
        nextTurn(s);
      }
    }
  },
  onResign: function (s, seat, ctx, resignDefault) {
    var wasTurn = s.jg.turn === seat;
    resignDefault(s, seat);
    if (wasTurn) s.turnPts = 0;
  },
  scores: function (s) { return s.scores.slice(); },
  view: function (s, you, v) {
    v.target = s.target;
    v.turnPts = s.turnPts;
    v.lastRoll = s.lastRoll;
  },
  legal: function (s, seat) {
    if (s.jg.end || s.jg.turn !== seat) return [];
    return s.turnPts > 0 ? [{ type: 'roll' }, { type: 'hold' }] : [{ type: 'roll' }];
  },
  bot: function (s, seat, ctx) {
    if (s.jg.end || s.jg.turn !== seat) return null;
    var need = s.target - s.scores[seat];
    var stop = Math.min(need, 12 + JGCore.int(ctx.rng, 8));   // máy dừng khi đủ thắng hoặc được 12–19 điểm lượt
    return s.turnPts >= stop ? { type: 'hold' } : { type: 'roll' };
  }
});
