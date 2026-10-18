'use strict';
/*
 * Bình chọn nhanh — luật (mẫu ỨNG DỤNG KHÔNG PHẢI GAME của devkit). JGCore được công cụ gộp lên đầu tệp.
 * Phiên: ask (chủ phiên đặt câu hỏi) -> vote (mọi người chọn cùng lúc, có thể hạn giờ) -> reveal (hiện kết quả) -> ask … -> hết phiên.
 * Không ai thắng thua (chuẩn 2.2): JGCore.game({scored: false}) + JGCore.end(s, {scored: false, reason: 'xong-phien'}) — khung hiện
 * "Xong phiên", không ghi hòa/thắng/thua, không thống kê / xếp hạng / huy hiệu / tim (kể cả khi người cuối rời phiên).
 * Phiếu là bí mật tới khi chốt: view chỉ gửi "ai đã chọn" (true/false) + lựa chọn của CHÍNH người nhận; kết quả chỉ có số đếm.
 */
var MAX_Q = 80, MAX_OPT = 30, MIN_OPTS = 2, MAX_OPTS = 4;

/** Chữ người dùng gõ: bỏ ký tự điều khiển, gộp khoảng trắng, cắt độ dài. */
function clean(t, max) {
  return String(t).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isHost(s, seat) { return seat === s.host; }

/** Còn ai trong phiên chưa chọn? Mọi người đã chọn -> hiện kết quả luôn. */
function allVoted(s) {
  return JGCore.Seats.alive(s).every(function (i) { return s.votes[i] !== null; });
}

function reveal(s) {
  var tally = JGCore.fill(s.q.opts.length, 0), voters = 0;
  s.votes.forEach(function (v) { if (v !== null) { tally[v]++; voters++; } });
  s.last = { text: s.q.text, opts: s.q.opts.slice(), tally: tally, voters: voters };
  s.history.push(s.last);
  s.jg.phase = 'reveal';
  JGCore.clearDeadline(s);
}

function finish(s) {
  return JGCore.end(s, { scored: false, reason: 'xong-phien' });
}

module.exports = JGCore.game({
  kind: 'simultaneous',
  scored: false,                      // ứng dụng: mọi kết thúc là "không tính điểm" (SDK 2.1)
  setup: function (s, ctx) {
    var r = ctx.options.rounds, sec = ctx.options.secs;
    s.rounds = r === 5 || r === 10 ? r : 3;
    s.secs = sec === 20 || sec === 45 ? sec : 0;
    s.host = 0;                       // ghế đầu là chủ phiên; rời phiên thì chuyển cho ghế kế tiếp
    s.round = 1;
    s.q = null;                       // {text, opts[]}
    s.votes = JGCore.fill(s.jg.n, null);
    s.last = null;                    // kết quả câu vừa chốt
    s.history = [];
    s.jg.phase = 'ask';
  },
  moves: {
    ask: {
      args: { q: { str: 200 }, opts: { arr: { str: 120 }, max: 8 } },
      phase: 'ask',
      run: function (s, ctx, mv) {
        if (!isHost(s, ctx.player)) return JGCore.err('forbidden', 'Chỉ chủ phiên đặt câu hỏi');
        var text = clean(mv.q, MAX_Q);
        var opts = mv.opts.map(function (o) { return clean(o, MAX_OPT); }).filter(function (o) { return o !== ''; });
        if (!text) return 'Gõ câu hỏi trước đã';
        if (opts.length < MIN_OPTS || opts.length > MAX_OPTS) return 'Cần 2 đến 4 lựa chọn';
        if (opts.some(function (o, i) { return opts.indexOf(o) !== i; })) return 'Các lựa chọn không được trùng nhau';
        s.q = { text: text, opts: opts };
        s.votes = JGCore.fill(s.jg.n, null);
        s.last = null;
        s.jg.phase = 'vote';
        if (s.secs) JGCore.setDeadline(s, s.secs * 1000);
      }
    },
    vote: {
      args: { i: { int: [0, MAX_OPTS - 1] } },
      phase: 'vote',
      run: function (s, ctx, mv) {
        if (mv.i >= s.q.opts.length) return 'Lựa chọn này không có';
        s.votes[ctx.player] = mv.i;   // bấm lại = đổi ý
        if (allVoted(s)) reveal(s);
      }
    },
    close: {
      phase: 'vote',
      run: function (s, ctx) {
        if (!isHost(s, ctx.player)) return JGCore.err('forbidden', 'Chỉ chủ phiên chốt được');
        reveal(s);
      }
    },
    next: {
      phase: 'reveal',
      run: function (s, ctx) {
        if (!isHost(s, ctx.player)) return JGCore.err('forbidden', 'Chỉ chủ phiên chuyển câu');
        if (s.round >= s.rounds) return finish(s);
        s.round++;
        s.q = null;
        s.jg.phase = 'ask';
      }
    },
    finish: {
      phase: ['ask', 'reveal'],
      run: function (s, ctx) {
        if (!isHost(s, ctx.player)) return JGCore.err('forbidden', 'Chỉ chủ phiên kết thúc được');
        finish(s);
      }
    }
  },
  tick: function (s) {
    if (s.jg.phase === 'vote' && JGCore.expired(s)) reveal(s);
  },
  onResign: function (s, seat, ctx, resignDefault) {
    s.votes[seat] = null;             // người rời: bỏ phiếu của họ
    resignDefault(s, seat);           // SDK: ván 2 người còn 1 -> kết thúc; ≥ 3 người -> phiên chạy tiếp
    if (s.jg.end) return;
    if (seat === s.host) s.host = JGCore.Seats.next(seat, s.jg.n, function (q) { return !s.jg.out[q]; });
    if (s.jg.phase === 'vote' && allVoted(s)) reveal(s);
  },
  view: function (s, you, v) {
    v.host = s.host;
    v.round = s.round;
    v.rounds = s.rounds;
    v.q = s.q;
    v.voted = s.votes.map(function (x) { return x !== null; });   // ai đã chọn — KHÔNG lộ chọn gì
    v.mine = you >= 0 ? s.votes[you] : null;                         // lựa chọn của chính mình
    v.last = s.last;
    v.history = s.history;
  },
  legal: function (s, seat) {
    var ph = s.jg.phase, host = isHost(s, seat);
    if (ph === 'ask') return host ? [{ type: 'ask', q: 'Tối nay ăn gì?', opts: ['Phở', 'Cơm', 'Bún'] }, { type: 'finish' }] : [];
    if (ph === 'vote') {
      var out = s.q.opts.map(function (o, i) { return { type: 'vote', i: i }; });
      return host ? out.concat([{ type: 'close' }]) : out;
    }
    if (ph === 'reveal') return host ? [{ type: 'next' }, { type: 'finish' }] : [];
    return [];
  }
});
