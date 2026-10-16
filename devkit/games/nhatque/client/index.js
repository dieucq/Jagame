/*
 * Nhặt que — giao diện (game mẫu devkit). Script thường, CHỈ gọi JG.defineGame; manifest "sdk": "2" → có sẵn JGUI.
 * Mọi chữ lấy từ người chơi (tên) phải qua JGUI.esc trước khi vào innerHTML.
 */
JG.defineGame(function (game) {
  'use strict';
  var root = game.root, lastLeft = null;

  root.innerHTML = '<div class="nq">' +
    '<div class="nq-chips"></div>' +
    '<p class="nq-say" aria-live="polite"></p>' +
    '<div class="nq-pile" role="img"></div>' +
    '</div>';
  var $ = function (sel) { return JGUI.q(root, sel); };

  function render(v) {
    if (!v) return;
    $('.nq-chips').innerHTML = JGUI.chips(game, v);
    var pile = '';
    for (var i = 0; i < v.total; i++) pile += '<span class="nq-stick' + (i >= v.left ? ' is-gone' : '') + '"></span>';
    var p = $('.nq-pile');
    p.innerHTML = pile;
    p.setAttribute('aria-label', 'Còn ' + v.left + ' que');
    var say;
    if (v.result) say = 'Hết ván';
    else if (v.turn === v.you) say = 'Tới lượt bạn — còn ' + v.left + ' que';
    else say = JGUI.esc(JGUI.turnText(game, v)) + ' · còn ' + v.left + ' que';
    if (v.last && !v.result) say = JGUI.esc(JGUI.nameOf(game, v.last.seat)) + ' nhặt ' + v.last.n + ' · ' + say;
    $('.nq-say').innerHTML = say;
    if (lastLeft !== null && v.left < lastLeft && v.last && v.last.seat !== v.you) JGUI.sound(game, 'move-other');
    lastLeft = v.left;
    var mine = v.you >= 0 && v.turn === v.you && !v.result;
    var btns = [];
    for (var n = 1; n <= 3; n++) {
      btns.push({ label: 'Nhặt ' + n, key: 'n' + n, primary: n === 1, disabled: !mine || n > v.maxTake, onClick: takeFn(n) });
    }
    JGUI.bar(root, btns);
  }

  function takeFn(n) {
    return function () {
      game.send({ type: 'take', n: n });
      JGUI.sound(game, 'move');
      var v = JSON.parse(JSON.stringify(game.view));   // lạc quan: vẽ ngay, máy chủ từ chối thì vẽ lại theo view
      v.left -= n; v.last = { seat: v.you, n: n }; v.turn = null;
      render(v);
    };
  }

  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () {} };
});
