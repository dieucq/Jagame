/*
 * Oẳn tù tì — giao diện (trò mẫu devkit). Script thường, CHỈ gọi JG.defineGame. manifest "sdk": "2" → công cụ chèn jg-ui.js lên
 * đầu file này (biến JGUI có sẵn: chip người chơi, đồng hồ, thanh hành động dính đáy, banner).
 * Vẽ trong game.root; gắn sự kiện vào phần tử CON; hiện nước đi ngay (lạc quan), máy chủ từ chối thì vẽ lại theo view.
 */
JG.defineGame(function (game) {
  'use strict';
  var ICON = { bua: '✊', bao: '✋', keo: '✌️' };
  var NAME = { bua: 'Búa', bao: 'Bao', keo: 'Kéo' };
  var root = game.root, stopTimer = function () {}, lastRound = 0;

  root.innerHTML = '<div class="ott">' +
    '<div class="ott-chips"></div>' +
    '<div class="ott-meta"><span class="ott-round"></span><span class="ott-timer"></span></div>' +
    '<div class="ott-arena" aria-live="polite"></div>' +
    '</div>';
  var $ = function (sel) { return JGUI.q(root, sel); };

  function hand(h, hidden) {
    return '<span class="ott-hand' + (hidden ? ' is-hidden' : '') + '">' + (hidden ? '❔' : ICON[h]) + '</span>';
  }

  function render(v) {
    if (!v) return;
    $('.ott-chips').innerHTML = JGUI.chips(game, v);
    $('.ott-round').textContent = v.result ? 'Hết ván' : 'Hiệp ' + v.round + ' · thắng ' + v.target + ' hiệp là thắng';
    stopTimer = JGUI.timer($('.ott-timer'), v.timer);
    var arena = $('.ott-arena');
    if (v.phase === 'reveal' || v.result) {
      var L = v.last;
      arena.innerHTML = L ? '<div class="ott-vs">' + hand(L.hands[0]) + '<b>VS</b>' + hand(L.hands[1]) + '</div>' +
        '<p class="ott-say">' + (L.winner < 0 ? 'Hòa hiệp này!' : JGUI.esc(JGUI.nameOf(game, L.winner)) + ' thắng hiệp ' + L.round) + '</p>' : '';
      if (L && L.round !== lastRound) { lastRound = L.round; JGUI.sound(game, L.winner < 0 ? 'draw' : (L.winner === v.you ? 'win' : 'move-other')); }
    } else {
      arena.innerHTML = '<div class="ott-vs">' + v.seats.map(function (p, i) {
        return i === v.you && v.mine ? hand(v.mine) : hand(null, true) + (v.picked[i] ? '<small>đã chọn</small>' : '');
      }).join('<b>VS</b>') + '</div>' +
        '<p class="ott-say">' + (v.you < 0 ? 'Đang xem hai bạn chọn…' : v.mine ? 'Bạn ra ' + NAME[v.mine] + ' — chờ bạn kia…' : 'Chọn tay của bạn!') + '</p>';
    }
    var canPick = v.you >= 0 && v.phase === 'pick' && !v.mine && !v.result;
    JGUI.bar(root, canPick ? ['bua', 'bao', 'keo'].map(function (h) {
      return { label: ICON[h] + ' ' + NAME[h], key: h, primary: true, onClick: function () { pick(h); } };
    }) : []);
  }

  function pick(h) {
    game.send({ type: 'pick', hand: h });
    JGUI.sound(game, 'move');
    var v = JSON.parse(JSON.stringify(game.view));   // lạc quan: vẽ ngay như đã chọn
    v.mine = h; v.picked[v.you] = true;
    render(v);
  }

  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () { stopTimer(); } };
});
