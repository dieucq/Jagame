/*
 * Bình chọn nhanh — giao diện (mẫu ứng dụng không phải game). Script thường, CHỈ gọi JG.defineGame; có sẵn JGUI (sdk "2").
 * Chạy trong khung iframe cách ly: không mạng, không cookie; chữ người dùng gõ luôn qua JGUI.esc() hoặc textContent.
 */
JG.defineGame(function (game) {
  'use strict';
  var root = game.root;
  var IDEAS = [
    ['Tối nay ăn gì?', ['Phở', 'Cơm nhà', 'Bún chả']],
    ['Cuối tuần đi đâu?', ['Công viên', 'Ở nhà xem phim', 'Về quê']],
    ['Chơi trò gì tiếp?', ['Cờ caro', 'Đố vui', 'Ô ăn quan']],
    ['Mấy giờ cả nhà đi ngủ?', ['21 giờ', '22 giờ', '23 giờ']]
  ];
  var built = '', stopTimer = null, picked = null, ideaAt = 0;

  root.innerHTML = '<div class="bc"><p class="bc-top"></p><div class="bc-body"></div></div>';
  var $ = function (sel) { return JGUI.q(root, sel); };
  var esc = JGUI.esc;

  function hostName(v) { return JGUI.nameOf(game, v.host); }
  function isHost(v) { return v.you >= 0 && v.you === v.host && !v.youDone; }
  function count(arr) { return arr.filter(Boolean).length; }
  function alive(v) { return v.seats.filter(function (p) { return !p.out; }).length; }

  /* ── từng màn ── */
  function askForm() {
    var rows = '';
    for (var i = 0; i < 4; i++) {
      rows += '<input class="bc-in bc-opt" maxlength="30" autocomplete="off" placeholder="Lựa chọn ' + (i + 1) +
        (i < 2 ? '' : ' (có thể bỏ trống)') + '" aria-label="Lựa chọn ' + (i + 1) + '">';
    }
    return '<label class="bc-lab" for="bc-q">Câu hỏi cho cả phòng</label>' +
      '<input id="bc-q" class="bc-in bc-q" maxlength="80" autocomplete="off" placeholder="Ví dụ: Tối nay ăn gì?">' +
      '<div class="bc-opts">' + rows + '</div>' +
      '<button type="button" class="bc-ghost" data-idea>Gợi ý câu hỏi</button>';
  }

  function voteList(v) {
    var mine = picked !== null ? picked : v.mine;
    return '<h2 class="bc-q-text">' + esc(v.q.text) + '</h2><div class="bc-choices" role="group" aria-label="Lựa chọn">' +
      v.q.opts.map(function (o, i) {
        var on = mine === i;
        return '<button type="button" class="bc-choice' + (on ? ' is-on' : '') + '" data-vote="' + i + '" aria-pressed="' + on + '"' +
          (v.you < 0 || v.youDone ? ' disabled' : '') + '><span class="bc-key">' + 'ABCD'.charAt(i) + '</span>' + esc(o) + '</button>';
      }).join('') + '</div>';
  }

  function bars(r) {
    var best = Math.max.apply(null, r.tally);
    return '<h2 class="bc-q-text">' + esc(r.text) + '</h2><ul class="bc-bars">' + r.opts.map(function (o, i) {
      var n = r.tally[i], pct = r.voters ? Math.round(n * 100 / r.voters) : 0;
      return '<li class="bc-bar' + (n === best && n > 0 ? ' is-top' : '') + '"><span class="bc-bar-fill" style="width:' + pct + '%"></span>' +
        '<span class="bc-bar-txt">' + esc(o) + '</span><b class="bc-bar-n">' + n + ' · ' + pct + '%</b></li>';
    }).join('') + '</ul><p class="bc-note">' + r.voters + ' người đã chọn' + (r.voters ? '' : ' — chưa ai kịp chọn') + '</p>';
  }

  function summary(v) {
    if (!v.history.length) return '<h2 class="bc-q-text">Phiên đã kết thúc</h2><p class="bc-note">Chưa có câu hỏi nào.</p>';
    return '<h2 class="bc-q-text">Tổng kết phiên</h2><ol class="bc-sum">' + v.history.map(function (r) {
      var best = Math.max.apply(null, r.tally);
      var top = best > 0 ? r.opts.filter(function (o, i) { return r.tally[i] === best; }).map(esc).join(', ') : 'chưa ai chọn';
      return '<li><span>' + esc(r.text) + '</span><b>' + top + '</b></li>';
    }).join('') + '</ol><p class="bc-note">Không có thắng thua — cảm ơn cả nhà đã góp ý!</p>';
  }

  /* ── vẽ ── */
  function render(v) {
    if (!v) return;
    if (stopTimer) { stopTimer(); stopTimer = null; }
    var phase = v.result ? 'ended' : v.phase;
    var key = phase + ':' + v.round + ':' + (isHost(v) ? 'h' : 'g');
    if (phase !== 'vote') picked = null;
    if (key !== built || phase === 'vote' || phase === 'reveal' || phase === 'ended') {
      var body = $('.bc-body');
      if (phase === 'ask') body.innerHTML = isHost(v) ? askForm() : '<p class="bc-wait">Đang đợi <b>' + esc(hostName(v)) + '</b> đặt câu hỏi…</p>';
      else if (phase === 'vote') body.innerHTML = voteList(v) + '<p class="bc-note"><span class="bc-count"></span> <span class="bc-timer"></span></p>';
      else if (phase === 'reveal') body.innerHTML = bars(v.last);
      else body.innerHTML = summary(v);
      built = key;
    }
    var top = phase === 'ended' ? 'Bình chọn nhanh' : 'Câu ' + v.round + '/' + v.rounds + ' · chủ phiên: ' + hostName(v);
    $('.bc-top').textContent = top;
    if (phase === 'vote') {
      $('.bc-count').textContent = count(v.voted) + '/' + alive(v) + ' người đã chọn.';
      if (v.timer) stopTimer = JGUI.timer($('.bc-timer'), v.timer);
    }
    dock(v, phase);
  }

  function dock(v, phase) {
    var host = isHost(v), items = [];
    if (phase === 'ask' && host) {
      items.push({ label: 'Kết thúc phiên', key: 'finish', onClick: function () { game.send({ type: 'finish' }); } });
      items.push({ label: 'Hỏi cả phòng', key: 'ask', primary: true, onClick: ask });
    } else if (phase === 'vote' && host) {
      items.push({ label: 'Chốt kết quả', key: 'close', primary: true, onClick: function () { game.send({ type: 'close' }); } });
    } else if (phase === 'reveal' && host) {
      items.push({ label: 'Kết thúc phiên', key: 'finish', onClick: function () { game.send({ type: 'finish' }); } });
      items.push({ label: v.round >= v.rounds ? 'Xem tổng kết' : 'Câu tiếp theo', key: 'next', primary: true,
        onClick: function () { game.send({ type: 'next' }); } });
    }
    JGUI.bar(root, items);
  }

  function ask() {
    var q = $('.bc-q');
    var opts = Array.prototype.map.call(root.querySelectorAll('.bc-opt'), function (el) { return el.value.trim(); })
      .filter(function (o) { return o !== ''; });
    if (!q || !q.value.trim()) { game.toast('Gõ câu hỏi trước đã'); if (q) q.focus(); return; }
    if (opts.length < 2) { game.toast('Cần ít nhất 2 lựa chọn'); return; }
    game.send({ type: 'ask', q: q.value.trim(), opts: opts });
    game.sound('send');
  }

  /* ── sự kiện: gắn vào phần tử CON của root (root dùng lại giữa các ván) ── */
  $('.bc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-vote], [data-idea]');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-idea')) {
      var idea = IDEAS[ideaAt++ % IDEAS.length], ins = root.querySelectorAll('.bc-opt');
      $('.bc-q').value = idea[0];
      Array.prototype.forEach.call(ins, function (el, i) { el.value = idea[1][i] || ''; });
      return;
    }
    picked = Number(b.getAttribute('data-vote'));
    game.send({ type: 'vote', i: picked });
    game.sound('move');
    render(game.view);                               // hiện lựa chọn ngay, máy chủ trả view sau
  });
  $('.bc').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('bc-in')) { e.preventDefault(); ask(); }
  });

  game.on('view', function (v) { picked = null; render(v); });
  game.on('error', function (msg) { picked = null; game.toast(msg); game.sound('error'); render(game.view); });
  render(game.view);
  return { destroy: function () { if (stopTimer) stopTimer(); } };
});
