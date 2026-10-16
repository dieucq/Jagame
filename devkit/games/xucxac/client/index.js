/*
 * Xúc xắc may rủi — giao diện (game mẫu devkit). Script thường, CHỈ gọi JG.defineGame; có sẵn JGUI (sdk "2").
 */
JG.defineGame(function (game) {
  'use strict';
  var root = game.root, lastKey = '';
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  root.innerHTML = '<div class="xx">' +
    '<div class="xx-chips"></div>' +
    '<div class="xx-board"><div class="xx-die" aria-hidden="true"></div>' +
    '<div class="xx-info"><b class="xx-pts"></b><span class="xx-say" aria-live="polite"></span></div></div>' +
    '<p class="xx-goal"></p>' +
    '</div>';
  var $ = function (sel) { return JGUI.q(root, sel); };

  function die(d) {
    var cells = '';
    for (var i = 0; i < 9; i++) cells += '<i' + ((PIPS[d] || []).indexOf(i) >= 0 ? ' class="on"' : '') + '></i>';
    return cells;
  }

  function render(v) {
    if (!v) return;
    $('.xx-chips').innerHTML = JGUI.chips(game, v);
    var r = v.lastRoll;
    var dieEl = $('.xx-die');
    dieEl.innerHTML = die(r ? r.d : 0);
    dieEl.classList.toggle('is-bust', !!(r && r.bust));
    $('.xx-pts').textContent = v.result ? '' : 'Điểm lượt: ' + v.turnPts;
    var say = '';
    if (r && r.bust) say = JGUI.esc(JGUI.nameOf(game, r.seat)) + ' gieo ra 1 — mất lượt!';
    else if (!v.result) say = JGUI.esc(JGUI.turnText(game, v));
    $('.xx-say').innerHTML = say;
    $('.xx-goal').textContent = 'Ai đạt ' + v.target + ' điểm trước là thắng';
    var key = r ? r.seat + ':' + r.d + ':' + v.turnPts : '';
    if (key && key !== lastKey) {
      JGUI.sound(game, r.bust ? 'error' : 'dice');
      if (!JGUI.still()) { dieEl.classList.remove('is-roll'); void dieEl.offsetWidth; dieEl.classList.add('is-roll'); }
    }
    lastKey = key;
    var mine = v.you >= 0 && v.turn === v.you && !v.result;
    JGUI.bar(root, [
      { label: '🎲 Gieo', key: 'roll', primary: true, disabled: !mine, onClick: function () { send({ type: 'roll' }); } },
      { label: '✋ Giữ điểm', key: 'hold', disabled: !mine || v.turnPts <= 0, onClick: function () { send({ type: 'hold' }); } }
    ]);
  }

  function send(mv) {
    game.send(mv);
    var v = JSON.parse(JSON.stringify(game.view));   // khóa nút ngay, chờ máy chủ gieo
    v.turn = null;
    render(v);
  }

  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () {} };
});
