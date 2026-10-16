/*
 * Khung phòng chơi GIẢ cho play.html — cài đặt JG.defineGame theo đúng hợp đồng client (GAME-PROTOCOL.md mục 5):
 *   game = {root, me:{id,name}, seat, players:[{id,name,seat}], options, view, send(move), on(evt, fn), toast, sound, soundNames}
 * Máy chủ giả: chạy server/game.js của game trong trình duyệt, state luôn đi qua JSON như máy thật, rng tất định.
 * Đồng hồ THẬT: ctx.now = Date.now() ở setup/move/bot/tick; manifest tick_ms + tick() -> setInterval gọi tick như máy chủ (ô "⏱ tick"
 * tắt được để dừng đồng hồ lúc soi giao diện). manifest ui.events + move() trả events -> phát on('event') thay vì on('view') (như máy).
 */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var gameId = (qs.get('game') || 'caro').replace(/[^a-z0-9-]/g, '');
  var base = '../games/' + gameId + '/';
  var $ = function (id) { return document.getElementById(id); };

  // ?theme=<khóa>: mặc áo 1 trong 20 giao diện của trang Jagame để xem đúng màu (cần phục vụ thư mục GỐC repo:
  //   python3 -m http.server 7702  ->  http://127.0.0.1:7702/tools/play.html?game=caro&theme=neon)
  // Nhóm Truyện tranh (group 'comic' trong khung Jagame `themes` — chép tay vì trang thử không đọc PHP;
  // thêm giao diện comic mới thì bổ sung ở đây): nạp thêm themes-comic.css + <html class="cm"> như views/partials/head.php.
  var COMIC_THEMES = ['meomay', 'thamtu', 'ngocrong', 'haitac', 'ninja', 'butchi', 'thandong', 'kiemsi', 'batquai', 'chienbinh'];
  var theme = (qs.get('theme') || '').replace(/[^a-z0-9-]/g, '');
  if (theme) {
    var isComic = COMIC_THEMES.indexOf(theme) >= 0;
    document.documentElement.setAttribute('data-theme', theme);
    if (isComic) document.documentElement.classList.add('cm');
    ['fonts/fonts.css', 'css/app.css', 'css/site.css', 'css/themes.css'].concat(isComic ? ['css/themes-comic.css'] : []).forEach(function (f) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = '../../Web/assets/' + f;
      document.head.appendChild(l);
    });
    document.documentElement.classList.add('pl-themed');
  }

  // Tên âm khung thật hỗ trợ (khung Jagame JGSound.names) — trang thử chỉ ghi nhật ký; tên lạ ghi cảnh báo.
  var SOUND_NAMES = ['move', 'move-other', 'turn', 'win', 'lose', 'draw', 'error', 'tick', 'join', 'leave', 'chat', 'send', 'start',
    'capture', 'check', 'dice', 'deal', 'chip'];

  var manifest, server, mountFn, mounted, game, state, handlers, seed, callNo, resultShown, tickTimer;
  var players = [];

  window.JG = window.JG || {};
  window.JG.defineGame = function (fn) { mountFn = fn; };

  function mulberry(a) {
    a >>>= 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rng() { callNo++; return mulberry((Math.imul(seed ^ 0x9E3779B9, 0x85EBCA6B) + callNo * 0xC2B2AE35) >>> 0); }
  var clone = function (o) { return o === undefined ? null : JSON.parse(JSON.stringify(o)); };

  function log(text, cls) {
    var li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    $('pl-log').prepend(li);
  }
  var toastTimer;
  function toast(text) {
    var t = $('pl-toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function emit(evt, arg) {
    (handlers[evt] || []).forEach(function (fn) {
      try { fn(arg, game); } catch (e) { console.error(e); log('Lỗi client (' + evt + '): ' + e.message, 'err'); }
    });
  }

  function currentOptions() {
    var o = {};
    (manifest.options || []).forEach(function (d) {
      var sel = $('pl-opt-' + d.key);
      var v = sel ? sel.value : d.default;
      o[d.key] = typeof d.default === 'number' ? Number(v) : v;
    });
    return o;
  }

  function seatOptions() {
    var sel = $('pl-seat');
    sel.innerHTML = '';
    players.concat([{ seat: -1, name: 'Người xem' }]).forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.seat;
      o.textContent = p.seat < 0 ? 'Người xem' : p.seat + ' — ' + p.name;
      sel.appendChild(o);
    });
  }

  function setSeat(s) {
    game.seat = s;
    var p = players[s];
    game.me = p ? { id: p.id, name: p.name } : { id: 'xem', name: 'Người xem' };
    $('pl-seat').value = String(s);
    game.view = clone(server.view(clone(state), s));
  }

  function afterMove(events, seat) {
    var res = clone(server.result(clone(state)));
    var useEvents = !res && manifest.ui && manifest.ui.events === true && Array.isArray(events) && events.length &&
      events.every(function (e) { return e && typeof e === 'object' && !Array.isArray(e); }) && JSON.stringify(events).length <= 16384;
    (events || []).forEach(function (ev) { log((useEvents ? 'game:event ' : 'events (bị bỏ qua, gửi view) ') + JSON.stringify(ev)); });
    if (useEvents) {
      // Như máy chủ (khung): nước có events -> KHÔNG gửi lại view, mỗi sự kiện gọi on('event') kèm ghế gửi.
      events.forEach(function (ev) { var out = { seat: seat }; Object.keys(ev).forEach(function (k) { out[k] = ev[k]; }); emit('event', clone(out)); });
      var vb = clone(server.view(clone(state), -1));
      if (botAvailable() && $('pl-bot').checked && vb && typeof vb.turn === 'number') scheduleBot();
      return;
    }
    if (res && !resultShown) {
      resultShown = true;
      var b = $('pl-banner');
      b.hidden = false;
      b.textContent = res.draw ? 'Hòa! (' + res.reason + ')' :
        'Thắng: ' + res.winners.map(function (w) { return players[w] ? players[w].name : w; }).join(', ') + ' (' + res.reason + ')';
      log('KẾT QUẢ ' + JSON.stringify(res), 'res');
    }
    var v = clone(server.view(clone(state), 0));
    var botOn = botAvailable() && $('pl-bot').checked;
    if ($('pl-auto').checked && !botOn && !res && v && typeof v.turn === 'number' && v.turn >= 0) setSeat(v.turn);
    else setSeat(game.seat);
    clearHighlight();   // gợi ý chỉ đúng với thế cờ lúc hỏi (như khung thật)
    emit('view', game.view);
    if (res) emit('result', res);
    if (botOn && !res) scheduleBot();
  }

  // Máy chơi thay (manifest "bot": true): ghế tới lượt khác ghế đang chọn -> gọi server.bot sau 600 ms, nước đi qua send().
  function botAvailable() { return !!(manifest && manifest.bot === true && server && typeof server.bot === 'function'); }
  var botTimer;
  function scheduleBot() {
    clearTimeout(botTimer);
    var v = clone(server.view(clone(state), -1));
    var seat, round = seed;
    if (manifest.bot_simultaneous === true && !(v && typeof v.turn === 'number' && v.turn >= 0)) {
      // Như khung thật (bot_simultaneous): hỏi bot() lần lượt các ghế KHÁC ghế đang chọn, ghế đầu tiên có việc thì đi.
      seat = -1;
      for (var q = 0; q < players.length && seat < 0; q++) {
        if (q === game.seat) continue;
        try { if (server.bot(clone(state), q, { options: clone(game.options), rng: rng(), now: Date.now() })) seat = q; } catch (e) { /* báo lúc đi thật */ }
      }
      if (seat < 0) return;
    } else {
      if (!v || typeof v.turn !== 'number' || v.turn < 0 || v.turn === game.seat) return;
      seat = v.turn;
    }
    botTimer = setTimeout(function () {
      if (round !== seed || !$('pl-bot').checked) return;
      var mv;
      try { mv = server.bot(clone(state), seat, { options: clone(game.options), rng: rng(), now: Date.now() }); }
      catch (e) { log('bot() ném lỗi: ' + e.message, 'err'); return; }
      if (mv === null || mv === undefined) { log('bot() không trả nước cho ghế ' + seat, 'err'); return; }
      log('🤖 ghế ' + seat + ' nghĩ ra: ' + JSON.stringify(mv), 'snd');
      send(mv, seat);
    }, 600);
  }

  // Gợi ý 💡 (manifest "hint": true): gọi hint() (không có thì bot()) cho ghế đang chọn rồi phát on('hint') như khung thật (room:hint).
  function hintFn() {
    if (!manifest || manifest.hint !== true || !server) return null;
    return typeof server.hint === 'function' ? 'hint' : (typeof server.bot === 'function' ? 'bot' : null);
  }
  var hintUsed = 0;
  function askHint() {
    var fn = hintFn();
    if (!fn || resultShown) return;
    if (game.seat < 0) return toast('Người xem không xin gợi ý được');
    var v = clone(server.view(clone(state), -1));
    if (!v || v.turn !== game.seat) return toast('Chưa tới lượt ghế ' + game.seat);
    var r;
    try { r = server[fn](clone(state), game.seat, { options: clone(game.options), rng: rng(), now: Date.now() }); }
    catch (e) { log(fn + '() ném lỗi: ' + e.message, 'err'); return; }
    var hint = r && typeof r === 'object' && !Array.isArray(r) && Object.prototype.hasOwnProperty.call(r, 'move') ? clone(r) : { move: clone(r) };
    if (hint.move === null || hint.move === undefined) { log(fn + '() không có gợi ý cho thế này', 'err'); return; }
    hintUsed++;
    hint.left = Math.max(0, (manifest.hint_max || 3) - hintUsed);
    log('💡 ' + fn + '(): ' + JSON.stringify(hint), 'snd');
    if (!(handlers.hint || []).length) toast(hint.text || 'Game chưa nghe on("hint") — khung thật chỉ toast được chữ');
    emit('hint', hint);
  }
  // game.highlight(ô | [ô…] | 'selector', {ms, label}) — vòng sáng đè lên phần tử, như khung Jagame; trả hàm xóa.
  var hl = { layer: null, items: [], timer: 0 };
  function hlPlace() {
    if (!hl.layer) return;
    var sr = hl.layer.parentNode.getBoundingClientRect();
    hl.items.forEach(function (it) {
      var r = it.target.getBoundingClientRect();
      it.node.hidden = !r.width && !r.height;
      it.node.style.transform = 'translate(' + Math.round(r.left - sr.left - 4) + 'px,' + Math.round(r.top - sr.top - 4) + 'px)';
      it.node.style.width = Math.round(r.width + 8) + 'px';
      it.node.style.height = Math.round(r.height + 8) + 'px';
    });
  }
  function clearHighlight() {
    clearTimeout(hl.timer);
    if (hl.layer) { hl.layer.remove(); document.removeEventListener('scroll', hlPlace, true); window.removeEventListener('resize', hlPlace); }
    hl = { layer: null, items: [], timer: 0 };
  }
  function highlight(targets, opts) {
    clearHighlight();
    opts = opts || {};
    var list = [];
    var push = function (t) {
      if (!t) return;
      if (typeof t === 'string') { try { list = list.concat([].slice.call($('pl-root').querySelectorAll(t))); } catch (e) { log('highlight: selector sai ' + t, 'err'); } }
      else if (t.nodeType === 1) list.push(t);
      else if (typeof t.length === 'number') [].forEach.call(t, push);
    };
    push(targets);
    if (!list.length) { log('highlight(): không có phần tử nào', 'err'); return clearHighlight; }
    var layer = document.createElement('div');
    layer.className = 'pl-hl-layer';
    hl.layer = layer;
    hl.items = list.slice(0, 64).map(function (t, i) {
      var n = document.createElement('div');
      n.className = 'pl-hl';
      if (i === 0 && opts.label !== '') { var lb = document.createElement('span'); lb.className = 'pl-hl-label'; lb.textContent = opts.label || '💡'; n.appendChild(lb); }
      layer.appendChild(n);
      return { target: t, node: n };
    });
    $('pl-root').parentNode.appendChild(layer);
    hlPlace();
    document.addEventListener('scroll', hlPlace, true);
    window.addEventListener('resize', hlPlace);
    var ms = Number(opts.ms); if (!(ms >= 0)) ms = 4000;
    if (ms > 0) hl.timer = setTimeout(clearHighlight, ms);
    return clearHighlight;
  }

  function send(move, asSeat) {
    var seat = typeof asSeat === 'number' ? asSeat : game.seat;
    setTimeout(function () {                 // giả độ trễ mạng như socket thật
      var r;
      try {
        r = server.move(clone(state), { player: seat, move: clone(move), rng: rng(), now: Date.now() });
      } catch (e) {
        log('game.js ném lỗi: ' + e.message, 'err');
        emit('error', 'Lỗi máy chủ game');
        return;
      }
      if (!r || r.error) {
        log('Từ chối (ghế ' + seat + '): ' + (r && r.error), 'err');
        emit('error', (r && r.error) || 'Nước đi không hợp lệ');
        return;
      }
      state = clone(r.state);
      log('Ghế ' + seat + ': ' + JSON.stringify(move));
      afterMove(r.events, seat);
    }, 60);
  }

  // Đồng hồ: manifest tick_ms + tick() -> gọi tick(state, {now, rng}) mỗi tick_ms như máy chủ, rồi gửi lại view (và kết quả nếu có).
  function tickAvailable() { return !!(manifest && manifest.tick_ms >= 100 && server && typeof server.tick === 'function'); }
  function startTick() {
    clearInterval(tickTimer);
    if (!tickAvailable() || !$('pl-tick').checked) return;
    tickTimer = setInterval(function () {
      if (resultShown) { clearInterval(tickTimer); return; }
      var r;
      try { r = server.tick(clone(state), { now: Date.now(), rng: rng() }); }
      catch (e) { log('tick() ném lỗi: ' + e.message, 'err'); return; }
      if (!r || !r.state || typeof r.state !== 'object') { log('tick() phải trả {state}', 'err'); return; }
      state = clone(r.state);
      afterMove(null);
    }, Math.min(manifest.tick_ms, 60000));
  }

  /*
   * Game hành động (manifest mode "action", GAME-PROTOCOL.md mục 18): giả khung action — state THƯỜNG TRÚ (sim sửa thẳng), nhịp tick_hz,
   * ảnh chụp send_hz cho ghế đang chọn (vùng nhìn quanh me / cả sân cho người xem), minimap 1 Hz, view 3 s, bot() cho ghế máy, ?lag=ms trễ 1 chiều.
   * game.input(i) -> q; on('snap', fn(s, meta{k, ack, rtt})) nhận ảnh chụp ĐẦY ĐỦ (khung thật giải delta xong mới gọi).
   */
  var actTimer = null;
  function isAction() { var md = manifest && manifest.mode; return Array.isArray(md) ? md.indexOf('action') >= 0 : md === 'action'; }
  function actionMatch(root, options) {
    var A = Object.assign({ tick_hz: 30, send_hz: 15, view: [32, 48], unit: 8, input: { d: [-1, 3], f: [0, 1] } }, manifest.action || {});
    var LAG = Math.max(0, +(qs.get('lag') || 0));
    var want = parseInt(qs.get('players'), 10);
    var n = (want >= 1 && want <= manifest.players.max) ? want : 1;
    var teams = manifest.room && manifest.room.teams ? manifest.room.teams.count : 0;
    var botOn = qs.get('bot') !== '0' && typeof server.bot === 'function';
    var seats = [];
    players = [];
    for (var i = 0; i < manifest.players.max; i++) {
      var p = i < n ? { id: 'p' + (i + 1), name: 'Người ' + (i + 1) } : (botOn && i < Math.max(n, manifest.players.min) + 3 ? { id: -i, name: 'Máy ' + i, bot: true } : null);
      if (p && teams) p.team = i % teams;
      seats.push(p);
      if (p) players.push({ id: p.id, name: p.name, seat: i });
    }
    seatOptions();
    state = server.setup({ players: clone(seats), options: options, rng: rng(), now: Date.now(), seed: seed });
    var world = typeof server.world === 'function' ? clone(server.world(state)) : null;
    var Wd = A.world || (world && world.W && world.H ? [world.W, world.H] : [4096, 4096]);
    var q = Math.floor(Date.now() / 10) % 1e9, inQ = [], ack = 0, k = 0, focus = null, ts = world && world.ts ? world.ts : 0, last = 0, view = A.view.slice();
    handlers = {};
    game = {
      root: root, me: { id: 'p1', name: 'Người 1' }, seat: 0, players: players, options: options, view: null, world: world,
      send: send, on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); }, toast: toast, highlight: highlight,
      soundNames: SOUND_NAMES.slice(), sound: function (name) { if (SOUND_NAMES.indexOf(name) < 0) log('♪ ' + name + ' — tên âm lạ', 'err'); },
      input: function (inp) { q += 1; var o = { q: q }; Object.keys(A.input).forEach(function (key) { var r = A.input[key], v = Math.round(+inp[key] || 0); o[key] = Math.max(r[0], Math.min(r[1], v)); }); setTimeout(function () { inQ.push(o); }, LAG); return q; },
      viewSize: function (w, h) { view = [Math.max(8, Math.min(64, w | 0)), Math.max(8, Math.min(64, h | 0))]; log('vùng nhìn ' + view.join('×')); },
      openChat: function () { toast('(trang thử) mở trò chuyện'); }
    };
    game.view = clone(typeof server.view === 'function' ? server.view(state, 0) : null);
    log('Ván hành động: ' + n + ' người, ' + (players.length - n) + ' máy, ' + A.tick_hz + ' Hz, ' + A.send_hz + ' ảnh chụp/s' + (LAG ? ', trễ ' + LAG + ' ms' : ''));
    mounted = mountFn(game) || {};
    var later = function (fn) { if (LAG) setTimeout(fn, LAG); else fn(); };
    actTimer = setInterval(function () {
      k += 1;
      var inputs = seats.map(function () { return null; }), sm = game.seat;
      while (inQ.length > 3) inQ.shift();
      if (sm >= 0 && seats[sm] && !seats[sm].bot && inQ.length) { var x = inQ.shift(); ack = x.q; x.ff = Math.min(4, Math.round(LAG / (1000 / A.tick_hz))); inputs[sm] = x; }
      seats.forEach(function (p, i) { if (p && (p.bot || i !== sm) && typeof server.bot === 'function' && botOn) { try { inputs[i] = server.bot(state, i, { options: options, rng: rng(), now: Date.now(), k: k }); } catch (e) { log('bot() lỗi: ' + e.message, 'err'); } } });
      var t0 = performance.now();
      try { server.sim(state, inputs, { dt: 1000 / A.tick_hz, k: k, now: Date.now(), rng: rng(), options: options, events: [] }); }
      catch (e) { log('sim() ném lỗi: ' + e.message, 'err'); clearInterval(actTimer); return; }
      if (k % Math.max(1, Math.round(A.tick_hz / A.send_hz)) === 0) {
        var area = sm < 0 || !focus ? [0, 0, Wd[0], Wd[1]] : [Math.floor(focus[0] - view[0] / 2), Math.floor(focus[1] - view[1] / 2), Math.floor(focus[0] + view[0] / 2), Math.floor(focus[1] + view[1] / 2)];
        var sn = clone(server.snapshot(state, sm, area, { k: k, now: Date.now(), last: last }));
        last = k;
        if (sn && Array.isArray(sn.me) && sm >= 0) focus = [sn.me[0] / A.unit, sn.me[1] / A.unit];
        if (typeof server.tiles === 'function') {
          var tl = server.tiles(state, ts, area);
          if (tl && tl.full) { game.world = clone(server.world(state)); later(function () { emit('world', game.world); }); }
          else if (tl && tl.C && tl.C.length) { sn.C = tl.C; sn.ts = tl.ts; }
          if (tl) ts = tl.ts;
        }
        if (k % A.tick_hz === 0 && typeof server.summary === 'function') sn.sum = clone(server.summary(state));
        var meta = { k: k, ack: ack, rtt: LAG * 2, paused: false };
        if ((performance.now() - t0) > 20) log('nhịp ' + k + ': sim + ảnh chụp ' + (performance.now() - t0).toFixed(1) + ' ms (máy: hạn 20 ms)', 'err');
        later(function () { (handlers.snap || []).forEach(function (fn) { try { fn(sn, meta); } catch (e) { console.error(e); log('Lỗi client (snap): ' + e.message, 'err'); } }); });
      }
      var res = clone(server.result(state));
      if ((k % (A.tick_hz * 3) === 0 || res) && typeof server.view === 'function') { game.view = clone(server.view(state, sm)); var gv = game.view; later(function () { emit('view', gv); }); }
      if (res) {
        clearInterval(actTimer);
        resultShown = true;
        $('pl-banner').hidden = false;
        $('pl-banner').textContent = res.draw ? 'Hòa! (' + res.reason + ')' : 'Thắng: ' + res.winners.join(', ') + ' (' + res.reason + ')';
        log('KẾT QUẢ ' + JSON.stringify(res), 'res');
        later(function () { emit('result', res); });
      }
    }, 1000 / A.tick_hz);
  }

  function newMatch() {
    clearInterval(actTimer);
    if (mounted && mounted.destroy) { try { mounted.destroy(); } catch (e) { console.error(e); } }
    var root = $('pl-root');
    root.innerHTML = '';
    $('pl-banner').hidden = true;
    $('pl-log').innerHTML = '';
    resultShown = false;
    hintUsed = 0;
    clearHighlight();
    seed = (Date.now() & 0xffffffff) >>> 0;
    callNo = 0;
    clearInterval(tickTimer);
    if (isAction()) { actionMatch(root, currentOptions()); return; }
    // ?players=N (min ≤ N ≤ max) để thử ván nhiều người; mặc định = số người tối thiểu.
    var want = parseInt(new URLSearchParams(location.search).get('players'), 10);
    var n = (want >= manifest.players.min && want <= manifest.players.max) ? want : manifest.players.min;
    players = [];
    for (var i = 0; i < n; i++) players.push({ id: 'p' + (i + 1), name: 'Người ' + (i + 1), seat: i });
    seatOptions();
    var options = currentOptions();
    state = clone(server.setup({ players: clone(players), options: options, rng: rng(), now: Date.now() }));
    handlers = {};
    game = {
      root: root, me: null, seat: 0, players: players, options: options, view: null,
      send: send,
      on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
      toast: toast,
      highlight: highlight,
      soundNames: SOUND_NAMES.slice(),
      sound: function (name) {
        if (SOUND_NAMES.indexOf(name) >= 0) log('♪ ' + name, 'snd');
        else log('♪ ' + name + ' — tên âm lạ, khung thật sẽ im lặng (xem GAME-STORE.md mục 5)', 'err');
      }
    };
    setSeat(0);
    log('Ván mới: ' + JSON.stringify(options) + ', seed ' + seed);
    mounted = mountFn(game) || {};
    clearTimeout(botTimer);
    if (botAvailable() && $('pl-bot').checked) scheduleBot();
    startTick();
  }

  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { fail(new Error('Không tải được ' + src)); };
      document.body.appendChild(s);
    });
  }

  fetch(base + 'manifest.json').then(function (r) { return r.json(); }).then(function (m) {
    manifest = m;
    document.title = 'Chơi thử ' + m.name + ' — Jagame dev';
    $('pl-name').textContent = m.name;
    $('pl-ver').textContent = m.version || '';
    (m.options || []).forEach(function (d) {
      var lab = document.createElement('label');
      lab.textContent = d.label + ' ';
      var sel = document.createElement('select');
      sel.id = 'pl-opt-' + d.key;
      d.choices.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c; o.textContent = c; if (c === d.default) o.selected = true;
        sel.appendChild(o);
      });
      var want = qs.get(d.key);
      if (want !== null) sel.value = want;
      lab.appendChild(sel);
      $('pl-opts').appendChild(lab);
    });
    if (m.entry.style) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = base + m.entry.style;
      document.head.appendChild(l);
    }
    // manifest "sdk": "2": ghép SDK như lúc đóng gói (shared/sdk/bundle.js) — jg-core trước game.js, jg-ui trước client.
    var getText = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('Không tải được ' + u); return r.text(); }); };
    var srvP = getText(base + m.entry.server);
    if (!m.sdk) return srvP;
    return Promise.all([getText('../shared/sdk/server/jg-core.js'), srvP]).then(function (t) {
      return "'use strict';\n" + t[0] + '\n/* ===== ' + m.entry.server + ' (mã game) ===== */\n' + t[1];
    });
  }).then(function (src) {
    var mod = { exports: {} };
    new Function('module', 'exports', src)(mod, mod.exports);   // chỉ ở trang thử; máy thật chạy trong vm
    server = mod.exports;
    return (manifest.sdk ? loadScript('../shared/sdk/client/jg-ui.js') : Promise.resolve()).then(function () {
      return loadScript(base + manifest.entry.client);
    });
  }).then(function () {
    if (typeof mountFn !== 'function') throw new Error('client không gọi JG.defineGame(mount)');
    $('pl-new').addEventListener('click', newMatch);
    $('pl-resign').addEventListener('click', function () {
      if (game.seat < 0) return toast('Người xem không đầu hàng được');
      send({ type: 'resign' });
    });
    $('pl-seat').addEventListener('change', function () {
      setSeat(Number(this.value));
      emit('view', game.view);
    });
    $('pl-opts').addEventListener('change', newMatch);
    if (tickAvailable()) {
      $('pl-tick-wrap').hidden = false;
      $('pl-tick-ms').textContent = manifest.tick_ms;
      if (qs.get('tick') === '0') $('pl-tick').checked = false;   // ?tick=0: dừng đồng hồ để soi giao diện
      $('pl-tick').addEventListener('change', startTick);
    } else if (manifest.tick_ms || (server && typeof server.tick === 'function')) {
      log('Lưu ý: cần CẢ manifest tick_ms (≥ 100) và hàm tick() thì máy mới gọi tick', 'err');
    }
    if (hintFn()) {
      $('pl-hint').hidden = false;
      $('pl-hint').addEventListener('click', askHint);
    } else if (manifest.hint === true) {
      log('TRƯỢT: manifest "hint": true nhưng game.js không có hint() lẫn bot()', 'err');
    } else if (typeof server.hint === 'function') {
      log('Lưu ý: game.js có hint() nhưng manifest chưa khai "hint": true -> máy tự host KHÔNG hiện nút 💡', 'err');
    }
    if (botAvailable()) {
      $('pl-bot-wrap').hidden = false;
      if (qs.get('bot') === '1') $('pl-bot').checked = true;   // ?bot=1: bật sẵn máy chơi ghế khác
      $('pl-bot').addEventListener('change', function () { if (this.checked) scheduleBot(); else clearTimeout(botTimer); });
    }
    newMatch();
    // Móc cho kiểm thử tự động: cho ghế khác đi 1 nước mà KHÔNG đổi ghế đang xem (giả "đối thủ" ở máy khác).
    window.__pl = { moveAs: function (seat, move) { send(move, seat); } };
  }).catch(function (e) {
    console.error(e);
    $('pl-root').textContent = 'Lỗi: ' + e.message;
  });
})();
