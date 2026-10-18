/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════
   Jagame SDK — jg-ui (phía trình duyệt) · giao thức game v2 · CHUAN-GIAO-TIEP.md
   Manifest "sdk": "2" → công cụ tự chèn file này lên ĐẦU client/index.js (biến JGUI có sẵn). Không phụ thuộc thư viện ngoài.
   Chỉ dùng biến CSS của khung (--accent --accent-ink --paper --ink --line --soft --muted --radius --f-head) → hợp mọi giao diện.
   Mọi chữ từ người chơi đi qua JGUI.esc() trước khi vào innerHTML.

     JGUI.esc(s) · JGUI.q(root, sel) · JGUI.still() · JGUI.nameOf(game, seat) · JGUI.sound(game, name)
     JGUI.chips(game, view)                → HTML hàng chip người chơi (từ view.seats/turn/scores/timer chuẩn v2)
     JGUI.timer(el, view.timer)            → đồng hồ đếm lùi tự chạy trong el; trả hàm dừng
     JGUI.bar(root, [{label, onClick, primary?, disabled?, key?}]) → thanh .jg-dock dính đáy, đặt --jg-dock-h trên root
     JGUI.banner(root, text, ms?)          → dải thông báo ngắn trên bàn (tự ẩn)
     JGUI.pad(root, {stick, buttons, small, onChange}) → điều khiển cảm ứng (joystick/D-pad + nút) + bàn phím + tay cầm — CHUAN-GIAO-TIEP.md
     JGUI.turnText(game, view)             → "Lượt của bạn" / "Lượt của An" / "" theo view.turn
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
var JGUI = (function () {
  'use strict';
  var VERSION = '2.0.0';
  // --jg-obj-*: mực/giấy CỐ ĐỊNH cho đồ vật (lá bài, tờ dò, mặt quân) — không giao diện nào ghi đè (GAME-POLISH-2 §1.1).
  // .jg-dock: thanh hành động dính đáy chuẩn (§1.4); JGUI.bar đặt --jg-dock-h (px) trên game.root để khung đẩy bong bóng chat lên.
  var CSS = '' +
    ':root{--jg-obj-ink:#17142b;--jg-obj-paper:#fffdf6;--jg-obj-line:rgba(23,20,43,.22)}' +
    '.jgui-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}' +
    '.jgui-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 10px;border-radius:999px;' +
    'background:var(--soft,#f2f0ea);color:var(--ink,#222);border:2px solid transparent;font-size:14px;max-width:100%}' +
    '.jgui-chip b{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:9em}' +
    '.jgui-chip.is-turn{border-color:var(--accent,#e0457b)}.jgui-chip.is-me b{text-decoration:underline}' +
    '.jgui-chip.is-out{opacity:.45}.jgui-chip .jgui-sc{font-variant-numeric:tabular-nums;color:var(--muted,#666)}' +
    '.jgui-timer{font-variant-numeric:tabular-nums;font-weight:700}.jgui-timer.is-low{color:var(--accent,#e0457b)}' +
    '.jg-dock.jgui-bar{position:sticky;bottom:calc(var(--app-tabbar-h,0px) + 8px);z-index:6;display:flex;flex-wrap:wrap;gap:8px;' +
    'justify-content:center;margin:12px 0 0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-radius:calc(var(--radius,12px) + 4px);' +
    'background:color-mix(in srgb,var(--paper,#fff) 94%,transparent);border:1px solid var(--line,#ddd);box-shadow:0 -10px 24px -16px rgba(0,0,0,.45)}' +
    '.jg-dock.jgui-bar.is-idle{visibility:hidden}' +
    '.jgui-bar button{min-height:52px;min-width:44px;padding:0 16px;border-radius:var(--radius,12px);border:2px solid var(--line,#ddd);' +
    'background:var(--paper,#fff);color:var(--ink,#222);font:inherit;font-size:16px;cursor:pointer}' +
    '.jgui-bar button.is-primary{background:var(--accent,#e0457b);color:var(--accent-ink,#fff);border-color:transparent}' +
    '.jgui-bar button:disabled{opacity:.45;cursor:default}' +
    '.jgui-banner{margin:0 0 8px;padding:8px 12px;border-radius:var(--radius,12px);background:var(--accent,#e0457b);' +
    'color:var(--accent-ink,#fff);font-family:var(--f-head,inherit);text-align:center;transition:opacity .3s}' +
    '.jgui-banner.is-gone{opacity:0}' +
    '@media (prefers-reduced-motion:reduce){.jgui-banner{transition:none}}';

  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('jgui-css')) return;
    var st = document.createElement('style');
    st.id = 'jgui-css';
    st.textContent = CSS;
    document.head.appendChild(st);
    var sp = document.createElement('style'); sp.id = 'jgpad-css'; sp.textContent = PAD_CSS; document.head.appendChild(sp);
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function q(root, sel) { return root ? root.querySelector(sel) : null; }
  function still() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function nameOf(game, seat) {
    var v = game && game.view;
    if (v && v.seats && v.seats[seat]) return v.seats[seat].name;
    var p = game && game.players ? game.players.filter(function (x) { return x.seat === seat; })[0] : null;
    return p ? p.name : 'Ghế ' + (seat + 1);
  }
  function sound(game, name) { try { if (game && game.sound) game.sound(name); } catch (e) { /* khung cũ: im lặng */ } }

  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return s >= 60 ? Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : String(s);
  }

  /** Đồng hồ đếm lùi từ timer chuẩn v2 {left, total, paused?} (ms TƯƠNG ĐỐI lúc view tới). Trả hàm dừng. */
  function timer(el, t) {
    if (!el) return function () {};
    if (el.__jguiStop) el.__jguiStop();
    if (!t || typeof t.left !== 'number') { el.textContent = ''; return function () {}; }
    el.classList.add('jgui-timer');
    var start = Date.now(), id = null;
    function paint() {
      var left = t.paused ? t.left : t.left - (Date.now() - start);
      el.textContent = (t.paused ? '⏸ ' : '⏱ ') + fmt(left);
      el.classList.toggle('is-low', !t.paused && left <= 5000);
      if (left <= 0 || t.paused) stop();
    }
    function stop() { if (id !== null) { clearInterval(id); id = null; } }
    paint();
    if (!t.paused) id = setInterval(paint, 250);
    el.__jguiStop = stop;
    return stop;
  }

  /** HTML hàng chip người chơi theo view v2: tên, ★ tới lượt, điểm (view.scores), mờ khi đã rời. */
  function chips(game, v) {
    injectCss();
    if (!v || !v.seats) return '';
    return '<div class="jgui-chips">' + v.seats.map(function (p, i) {
      var cls = 'jgui-chip' + (v.turn === i ? ' is-turn' : '') + (v.you === i ? ' is-me' : '') + (p.out ? ' is-out' : '');
      var sc = v.scores && typeof v.scores[i] === 'number' ? '<span class="jgui-sc">' + esc(v.scores[i]) + '</span>' : '';
      return '<span class="' + cls + '" data-seat="' + i + '">' + (p.bot ? '🤖 ' : '') + '<b>' + esc(p.name) + '</b>' + sc + '</span>';
    }).join('') + '</div>';
  }

  /** Thanh hành động dính đáy (tái dùng phần tử .jgui-bar con của root). items: [{label, onClick, primary?, disabled?, key?}]. */
  function bar(root, items) {
    injectCss();
    var el = q(root, ':scope > .jgui-bar');
    if (!el) {
      el = document.createElement('div'); el.className = 'jg-dock jgui-bar'; root.appendChild(el);
      var setH = function () { root.style.setProperty('--jg-dock-h', (el.classList.contains('is-idle') ? 0 : el.offsetHeight) + 'px'); };
      if (typeof ResizeObserver === 'function') new ResizeObserver(setH).observe(el);
      el.__jguiSetH = setH;
    }
    el.innerHTML = '';
    (items || []).forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.key) b.setAttribute('data-key', it.key);
      if (it.primary) b.className = 'is-primary';
      b.disabled = !!it.disabled;
      b.addEventListener('click', function () { if (!b.disabled && it.onClick) it.onClick(); });
      el.appendChild(b);
    });
    // Chưa có việc: giữ chỗ (visibility) để bàn không giật lên xuống.
    el.classList.toggle('is-idle', !(items && items.length));
    if (el.__jguiSetH) el.__jguiSetH();
    return el;
  }

  function banner(root, text, ms) {
    injectCss();
    var el = document.createElement('div');
    el.className = 'jgui-banner';
    el.setAttribute('role', 'status');
    el.textContent = text;
    root.insertBefore(el, root.firstChild);
    setTimeout(function () { el.classList.add('is-gone'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, still() ? 0 : 320); }, ms || 2200);
    return el;
  }

  function turnText(game, v) {
    if (!v || typeof v.turn !== 'number' || v.turn < 0 || v.result) return '';
    return v.turn === v.you ? 'Lượt của bạn' : 'Lượt của ' + nameOf(game, v.turn);
  }

  /* ───────────────────────────── JGUI.pad — điều khiển cảm ứng dùng chung (CHUAN-GIAO-TIEP.md) ───────────────────────────── */
  var PAD_CSS = '' +
    '.jgpad{position:absolute;left:0;top:0;right:0;bottom:0;z-index:20;pointer-events:none;touch-action:none;-webkit-user-select:none;user-select:none;' +
    '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font-family:var(--f-head,inherit);--jgp-o:.62;--jgp-u:72px;--jgp-dz:0px}' +
    '.jgpad *{box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none}' +
    '.jgpad.is-off{display:none}.jgpad.is-away .jgpad-g,.jgpad.is-away .jgpad-gear{opacity:0}.jgpad.is-kb{visibility:hidden}' +
    '.jgpad-g{position:absolute;pointer-events:auto;opacity:var(--jgp-o);transition:opacity .25s}' +
    '.jgpad-zone{position:absolute;top:18%;bottom:0;pointer-events:auto;opacity:1}' +
    '.jgpad-stick{position:absolute;width:calc(var(--jgp-u)*2);height:calc(var(--jgp-u)*2);margin:calc(var(--jgp-u)*-1) 0 0 calc(var(--jgp-u)*-1);' +
    'border-radius:50%;border:3px solid rgba(255,255,255,.55);background:rgba(20,20,30,.28);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;opacity:var(--jgp-o)}' +
    '.jgpad-stick.is-idle{opacity:calc(var(--jgp-o)*.55)}' +
    '.jgpad-knob{position:absolute;left:50%;top:50%;width:calc(var(--jgp-u)*.9);height:calc(var(--jgp-u)*.9);margin:calc(var(--jgp-u)*-.45) 0 0 calc(var(--jgp-u)*-.45);' +
    'border-radius:50%;background:rgba(255,255,255,.8);border:2px solid rgba(0,0,0,.25);box-shadow:0 2px 6px rgba(0,0,0,.4)}' +
    '.jgpad-dpad{width:calc(var(--jgp-u)*2.4);height:calc(var(--jgp-u)*2.4)}' +
    '.jgpad-dpad i{position:absolute;background:rgba(20,20,30,.42);border:2px solid rgba(255,255,255,.55);border-radius:10px;transition:background .06s,transform .06s}' +
    '.jgpad-dpad i.h{left:0;right:0;top:34%;bottom:34%}.jgpad-dpad i.v{top:0;bottom:0;left:34%;right:34%}' +
    '.jgpad-dpad .jgpad-arw{position:absolute;color:rgba(255,255,255,.9);font-size:calc(var(--jgp-u)*.34);line-height:1;transition:color .06s}' +
    '.jgpad-dpad.d-u .a-u,.jgpad-dpad.d-d .a-d,.jgpad-dpad.d-l .a-l,.jgpad-dpad.d-r .a-r{color:var(--accent,#ffd23f);transform:scale(1.35)}' +
    '.jgpad-btns,.jgpad-small{width:calc(var(--jgp-u)*2.7);height:calc(var(--jgp-u)*2.7)}' +
    '.jgpad-b{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;line-height:1.05;' +
    'color:#fff;background:rgba(20,20,30,.42);border:3px solid rgba(255,255,255,.6);box-shadow:0 3px 8px rgba(0,0,0,.35);text-shadow:0 1px 2px rgba(0,0,0,.6);' +
    'transition:transform .06s,background .06s,box-shadow .06s;pointer-events:none;padding:2px;overflow:hidden}' +
    '.jgpad-b.is-hold{border-style:double;border-width:5px}.jgpad-b.is-on{transform:scale(.88);background:var(--accent,#e0457b);color:var(--accent-ink,#fff);box-shadow:0 0 0 4px rgba(255,255,255,.35),0 0 16px var(--accent,#e0457b)}' +
    '.jgpad-b.is-turbo::after{content:"⚡";position:absolute;right:6%;top:2%;font-size:.7em}' +
    '.jgpad-smallrow{display:flex;gap:10px;position:absolute;left:0;right:0;bottom:0;justify-content:center}' +
    '.jgpad-small{height:auto;width:auto}' +
    '.jgpad-s{position:relative;pointer-events:none;min-width:64px;height:34px;padding:0 14px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;' +
    'background:rgba(20,20,30,.5);border:2px solid rgba(255,255,255,.55);transition:transform .06s,background .06s}' +
    '.jgpad-s.is-on{background:var(--accent,#e0457b);transform:scale(.92)}' +
    '.jgpad-gear{position:absolute;pointer-events:auto;width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(20,20,30,.4);color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0;opacity:.5}' +
    '.jgpad.is-edit .jgpad-g{outline:2px dashed var(--accent,#ffd23f);outline-offset:4px;opacity:.9;cursor:move}' +
    '.jgpad.is-edit .jgpad-zone{display:none}.jgpad.is-away .jgpad-stick.is-idle{opacity:0}' +
    '.jgpad-panel{position:fixed;pointer-events:auto;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,94vw);max-height:94vh;max-height:94dvh;overflow:auto;padding:12px 14px;border-radius:14px;' +
    'background:var(--paper,#fff);color:var(--ink,#222);border:1px solid var(--line,#ddd);box-shadow:0 10px 40px rgba(0,0,0,.5);font-size:15px;font-family:var(--f-body,inherit);opacity:1;z-index:3}' +
    '.jgpad-panel h4{margin:0 0 8px;font-size:16px}.jgpad-panel .row{display:flex;align-items:center;gap:8px;margin:8px 0;flex-wrap:wrap;min-height:36px}' +
    '.jgpad-panel .row>span{min-width:64px}.jgpad-panel button{min-height:40px;min-width:44px;padding:0 12px;border-radius:10px;border:2px solid var(--line,#ddd);background:var(--paper,#fff);color:inherit;font:inherit;cursor:pointer}' +
    '.jgpad-panel button.is-sel{background:var(--accent,#e0457b);color:var(--accent-ink,#fff);border-color:transparent}.jgpad-panel input[type=range]{flex:1;min-width:100px}' +
    '.jgpad-panel input[type=checkbox]{width:22px;height:22px}' +
    '@media (max-height:480px){.jgpad-panel{width:min(620px,96vw);display:grid;grid-template-columns:1fr 1fr;column-gap:16px;padding:8px 14px}' +
    '.jgpad-panel h4{grid-column:1/-1;margin:0 0 2px}.jgpad-panel .row{margin:3px 0;min-height:0;flex-wrap:nowrap}.jgpad-panel .row:last-child{grid-column:1/-1}' +
    '.jgpad-panel .row>span{min-width:48px}.jgpad-panel button{padding:0 10px}}' +
    '@media (prefers-reduced-motion:reduce){.jgpad *{transition:none!important}}';

  var PAD_LAYOUT = [[0, 0], [1.2, .15], [.3, 1.2], [1.5, 1.3], [2.7, .15], [2.7, 1.3]];   // [cách mép phải, cách đáy] theo đơn vị u: A, B, X, Y …
  var PAD_SIZE = { s: 56, m: 72, l: 92 };
  var PAD_KEYS = [[' ', 'KeyJ', 'KeyZ'], ['KeyK', 'KeyX'], ['KeyL', 'KeyC'], ['KeyI', 'KeyV'], ['KeyU'], ['KeyO']];
  var PAD_SKEYS = { start: ['Enter'], select: ['ShiftRight', 'Tab'], menu: ['Escape'] };
  var PAD_GP = [0, 1, 2, 3, 4, 5];

  function padCoarse() {
    try { return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window); } catch (e) { return false; }
  }

  /**
   * JGUI.pad(root, opts) → {state, get(), took(id), destroy(), show(), hide(), reset(), openSettings(), settings}
   *  opts.stick: 'analog'|'dpad4'|'dpad8'|null · opts.buttons: [{id,label,hold?,turbo?,key?,big?}] (tối đa 6) · opts.small: ['start','select','menu' | {id,label,key?}]
   *  opts.combo: ['a','b'] → thêm nút kép A+B · opts.key: khóa lưu cài đặt (mặc định theo đường dẫn trang) · opts.show: 'auto'|true|false
   *  opts.scale (hệ số cỡ nút .6–1.2) · opts.opacity (độ mờ mặc định) · opts.floating (analog, mặc định true) · opts.dead (vùng chết 0..0.5, mặc định .18) · opts.settings (mặc định true: nút ⚙) · opts.keys: bật bàn phím/tay cầm (mặc định true)
   *  opts.onChange(state) mỗi khi state đổi. state: {x,y(-1..1, y>0 = xuống), mag, dir(-1|0..7 từ Bắc theo chiều kim đồng hồ), up,down,left,right, <id>:bool…, src}
   */
  function pad(root, opts) {
    injectCss();
    opts = opts || {};
    var doc = root.ownerDocument || document, win = doc.defaultView || window;
    var mode = opts.stick === undefined ? 'analog' : opts.stick;
    var btnDefs = (opts.buttons || []).slice(0, 6).map(function (b, i) { return typeof b === 'string' ? { id: b, label: b.toUpperCase() } : b; });
    var smallDefs = (opts.small || []).map(function (s) {
      var o = typeof s === 'string' ? { id: s, label: { start: 'Start', select: 'Select', menu: '☰ Menu' }[s] || s } : s;
      return o;
    });
    var dead = typeof opts.dead === 'number' ? Math.min(.5, Math.max(0, opts.dead)) : .18;
    var storeKey = 'jgpad:' + (opts.key || (win.location && win.location.pathname) || 'game');
    var DEF = { size: 'm', opacity: Math.min(1, Math.max(.2, +opts.opacity || .62)), swap: false, haptic: true, turbo: false, stick: '', pos: {} };
    var cfg = load();
    // opts.stickChoice = ['dpad4','analog']: người chơi chọn kiểu cần trong ⚙ (lưu cfg.stick); đổi → gọi opts.onRestick(kiểu) để game dựng lại pad
    var choices = (opts.stickChoice || []).filter(function (m) { return m === 'analog' || m === 'dpad4' || m === 'dpad8'; });
    if (choices.length > 1 && choices.indexOf(cfg.stick) >= 0) mode = cfg.stick;
    function load() {
      var c = {}, k; for (k in DEF) c[k] = DEF[k];
      try { var j = JSON.parse(win.localStorage.getItem(storeKey) || 'null'); if (j && typeof j === 'object') { for (k in DEF) if (j[k] !== undefined && typeof j[k] === typeof DEF[k]) c[k] = j[k]; } } catch (e) { /* không có localStorage */ }
      if (!PAD_SIZE[c.size]) c.size = 'm';
      c.opacity = Math.min(1, Math.max(.2, +c.opacity || DEF.opacity));
      if (!c.pos || typeof c.pos !== 'object' || c.pos instanceof Array) c.pos = {};
      ['stick', 'btns', 'small'].forEach(function (k) { var v = c.pos[k]; if (v !== undefined && !(v instanceof Array && v.length === 2 && isFinite(v[0]) && isFinite(v[1]))) delete c.pos[k]; });
      return c;
    }
    function save() { try { win.localStorage.setItem(storeKey, JSON.stringify(cfg)); } catch (e) { /* bỏ qua */ } }

    // ── state hợp nhất (cảm ứng + bàn phím + tay cầm) ──
    var st = { x: 0, y: 0, mag: 0, dir: -1, up: false, down: false, left: false, right: false, src: '' };
    var ids = btnDefs.map(function (b) { return b.id; }).concat(smallDefs.map(function (s) { return s.id; }));
    var comboId = null;
    if (opts.combo && opts.combo.length === 2) comboId = opts.combo.join('');
    if (comboId) ids.push(comboId);
    ids.forEach(function (id) { st[id] = false; });
    var touchV = { x: 0, y: 0 }, keyV = { x: 0, y: 0 }, gpV = { x: 0, y: 0 };
    var down = {}, holdUntil = {}, edge = {}, keyDown = {}, gpDown = {}, turboOn = false, turboPhase = false, destroyed = false;
    var lastSig = '';

    function dirOf(x, y) {   // 8 hướng, 0 = Bắc, theo chiều kim đồng hồ
      if (!x && !y) return -1;
      var a = Math.atan2(x, -y) * 180 / Math.PI; if (a < 0) a += 360;
      return Math.floor((a + 22.5) / 45) % 8;
    }
    var now = function () { return Date.now(); };
    function recompute(src) {
      var n = now(), v = touchV, s = 'touch';
      var m = function (o) { return Math.sqrt(o.x * o.x + o.y * o.y); };
      if (m(touchV) <= 0) { v = m(keyV) > 0 ? keyV : gpV; s = m(keyV) > 0 ? 'key' : (m(gpV) > 0 ? 'pad' : ''); }
      var mg = Math.min(1, m(v));
      var x = mg ? v.x : 0, y = mg ? v.y : 0;
      var d = mode === 'analog' || m(v) > 0 ? dirOf(x, y) : -1;
      var next = { x: x, y: y, mag: mg, dir: d, up: y < -.4, down: y > .4, left: x < -.4, right: x > .4, src: s };
      ids.forEach(function (id) {
        var held = (down[id] || 0) > 0 || (holdUntil[id] || 0) > n || !!keyDown[id] || !!gpDown[id];
        var def = btnDefs.filter(function (b) { return b.id === id; })[0];
        if (held && turboOn && def && def.turbo && !def.hold) held = turboPhase;
        next[id] = held;
        if (held && !st[id]) edge[id] = true;
      });
      var sig = JSON.stringify(next);
      for (var k in next) st[k] = next[k];
      if (sig !== lastSig) {
        lastSig = sig;
        paintButtons();
        if (opts.onChange) { try { opts.onChange(st); } catch (e) { /* lỗi game không phá pad */ } }
      }
    }
    var recTimer = 0;
    function recomputeLater(ms) { clearTimeout(recTimer); recTimer = setTimeout(function () { recompute(); }, ms); }

    // ── DOM ──
    var cs = win.getComputedStyle(root);
    if (cs.position === 'static') root.style.position = 'relative';
    var layer = doc.createElement('div');
    layer.className = 'jgpad';
    layer.setAttribute('aria-hidden', 'true');
    layer.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.appendChild(layer);
    var G = {};   // cụm: stick (zone/ring/dpad), btns, small
    var btnEls = {};
    function mk(cls, parent, html) { var e = doc.createElement('div'); e.className = cls; if (html) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }

    var zone = null, ring = null, knob = null, dpadEl = null;
    if (mode === 'analog') {
      G.stick = mk('jgpad-g jgpad-stick-home', layer);
      G.stick.style.cssText = 'width:calc(var(--jgp-u)*2.4);height:calc(var(--jgp-u)*2.4);';
      G.stick.dataset.g = 'stick';
      ring = mk('jgpad-stick is-idle', null);
      ring.style.left = '50%'; ring.style.top = '50%';
      knob = mk('jgpad-knob', ring);
      G.stick.appendChild(ring);
      zone = mk('jgpad-zone', layer); zone.dataset.g = 'zone';
    } else if (mode === 'dpad4' || mode === 'dpad8') {
      G.stick = mk('jgpad-g jgpad-dpad', layer); G.stick.dataset.g = 'dpad';
      dpadEl = G.stick;
      G.stick.innerHTML = '<i class="h"></i><i class="v"></i><span class="jgpad-arw a-u" style="left:50%;top:6%;transform:translateX(-50%)">▲</span>' +
        '<span class="jgpad-arw a-d" style="left:50%;bottom:6%;transform:translateX(-50%)">▼</span><span class="jgpad-arw a-l" style="left:7%;top:50%;transform:translateY(-50%)">◀</span>' +
        '<span class="jgpad-arw a-r" style="right:7%;top:50%;transform:translateY(-50%)">▶</span>';
    }
    if (btnDefs.length || comboId) {
      G.btns = mk('jgpad-g jgpad-btns', layer); G.btns.dataset.g = 'btns';
      btnDefs.forEach(function (b, i) {
        var e = mk('jgpad-b' + (b.hold ? ' is-hold' : '') + (b.turbo ? ' is-turbo' : ''), G.btns);
        e.textContent = b.label === undefined ? b.id.toUpperCase() : b.label;
        e.dataset.id = b.id; e.dataset.i = i; btnEls[b.id] = e;
      });
      if (comboId) {
        var ce = mk('jgpad-b', G.btns); ce.textContent = opts.combo.join('+').toUpperCase(); ce.dataset.id = comboId; ce.dataset.combo = '1'; btnEls[comboId] = ce;
      }
    }
    if (smallDefs.length) {
      G.small = mk('jgpad-g jgpad-small', layer); G.small.dataset.g = 'small';
      var row = mk('jgpad-smallrow', G.small);
      smallDefs.forEach(function (s) { var e = mk('jgpad-s', row); e.textContent = s.label; e.dataset.id = s.id; e.dataset.small = '1'; btnEls[s.id] = e; });
    }
    var gear = null;
    if (opts.settings !== false) {
      gear = doc.createElement('button'); gear.type = 'button'; gear.className = 'jgpad-gear'; gear.textContent = '⚙'; gear.setAttribute('aria-label', 'Tùy chỉnh nút');
      gear.addEventListener('click', function () {
        if (editMode) { setEdit(false); if (panel) { panel.style.display = ''; var eb = panel.querySelector('[data-edit]'); if (eb) eb.textContent = 'Kéo đặt vị trí'; } else openSettings(); } else openSettings();
      });
      layer.appendChild(gear);
    }

    function paintButtons() {
      ids.forEach(function (id) { var e = btnEls[id]; if (e) e.classList.toggle('is-on', !!st[id]); });
      if (dpadEl) {
        dpadEl.classList.toggle('d-u', !!st.up); dpadEl.classList.toggle('d-d', !!st.down);
        dpadEl.classList.toggle('d-l', !!st.left); dpadEl.classList.toggle('d-r', !!st.right);
      }
    }

    // ── bố cục ──
    var U = 72;
    function place() {
      U = Math.round(PAD_SIZE[cfg.size] * Math.min(1.2, Math.max(.6, +opts.scale || 1)));
      layer.style.setProperty('--jgp-u', U + 'px'); layer.style.setProperty('--jgp-o', cfg.opacity);
      var W = layer.clientWidth || root.clientWidth, H = layer.clientHeight || root.clientHeight, sw = cfg.swap;
      var sx = function (k) { return ((cfg.pos[k] || [0, 0])[0]) * W; }, sy = function (k) { return ((cfg.pos[k] || [0, 0])[1]) * H; };
      var inset = 'calc(16px + env(safe-area-inset-';
      function anchor(el, key, side) {   // side 'l'|'r'; vị trí gốc cách mép + độ lệch người chơi (tỉ lệ)
        el.style.left = el.style.right = el.style.bottom = el.style.top = '';
        var dx = sx(key), dy = sy(key);
        if (side === 'l') el.style.left = inset + 'left,0px) + ' + dx + 'px)'; else el.style.right = inset + 'right,0px) - ' + dx + 'px)';
        el.style.bottom = 'calc(14px + env(safe-area-inset-bottom,0px) - ' + dy + 'px)';
      }
      var stickSide = sw ? 'r' : 'l', btnSide = sw ? 'l' : 'r';
      if (G.stick) anchor(G.stick, 'stick', stickSide);
      if (G.btns) {
        anchor(G.btns, 'btns', btnSide);
        var els = G.btns.children;
        for (var i = 0; i < btnDefs.length; i++) {
          var b = btnDefs[i], e = btnEls[b.id], big = b.big || i === 0, d = (big ? U : U * .86);
          var p = PAD_LAYOUT[i] || [0, 0];
          e.style.width = e.style.height = d + 'px';
          e.style.fontSize = Math.round(d * .27) + 'px';
          e.style.bottom = (p[1] * U) + 'px';
          e.style[btnSide === 'r' ? 'right' : 'left'] = (p[0] * U) + 'px'; e.style[btnSide === 'r' ? 'left' : 'right'] = '';
        }
        if (comboId) {
          var c = btnEls[comboId], cd = U * .62;
          c.style.width = c.style.height = cd + 'px'; c.style.fontSize = Math.round(cd * .3) + 'px';
          c.style[btnSide === 'r' ? 'right' : 'left'] = (U * 1.45) + 'px'; c.style[btnSide === 'r' ? 'left' : 'right'] = '';
          c.style.bottom = (-U * .05) + 'px';
        }
      }
      if (G.small) {
        G.small.style.left = G.small.style.right = '';
        G.small.style.width = (smallDefs.length * 92) + 'px';
        G.small.style.left = 'calc(50% - ' + (smallDefs.length * 46) + 'px + ' + sx('small') + 'px)';
        if (W < 560) { G.small.style.bottom = ''; G.small.style.top = 'calc(10px + env(safe-area-inset-top,0px) + ' + sy('small') + 'px)'; }   // màn hẹp: lên đỉnh để khỏi đè cụm nút
        else { G.small.style.top = ''; G.small.style.bottom = 'calc(10px + env(safe-area-inset-bottom,0px) - ' + sy('small') + 'px)'; }
        G.small.style.height = '40px';
      }
      if (zone) { zone.style.left = zone.style.right = ''; zone.style[sw ? 'right' : 'left'] = '0'; zone.style.width = '50%'; }
      if (gear) { gear.style.left = gear.style.right = ''; gear.style.top = 'calc(10px + env(safe-area-inset-top,0px))'; gear.style[sw ? 'left' : 'right'] = 'calc(10px + env(safe-area-inset-' + (sw ? 'left' : 'right') + ',0px))'; }
      if (typeof clampAll === 'function') clampAll();
    }
    // kẹp mỗi cụm vào vùng nhìn (trừ safe-area): đo hộp thật rồi dịch pos (tỉ lệ) cho vừa; dữ liệu lưu cũ ra ngoài cũng được kéo về
    var probe = mk('jgpad-probe', layer);
    probe.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    var clamping = false;
    function groupBox(k) {
      var els = k === 'btns' ? [].slice.call(G.btns ? G.btns.children : []) : [k === 'small' ? G.small : G.stick];
      var l = 1e9, t = 1e9, r = -1e9, b = -1e9, n = 0;
      els.forEach(function (e) {
        if (!e) return; var q = e.getBoundingClientRect(); if (!q.width) return; n++;
        l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      });
      return n ? { l: l, t: t, r: r, b: b } : null;
    }
    function clampAll() {
      if (clamping) return; clamping = true;
      try {
        var L = layer.getBoundingClientRect(); if (L.width < 20 || L.height < 20) return;
        var cs = win.getComputedStyle(probe), pt = parseFloat(cs.paddingTop) || 0, pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0;
        var minX = L.left + pl, maxX = L.right - pr, minY = L.top + pt, maxY = L.bottom - pb, changed = false;
        ['stick', 'btns', 'small'].forEach(function (k) {
          if (k === 'stick' ? !G.stick : !G[k]) return;
          var bx = groupBox(k); if (!bx) return;
          var dx = 0, dy = 0;
          if (bx.r - bx.l > maxX - minX) dx = minX - bx.l; else if (bx.l < minX) dx = minX - bx.l; else if (bx.r > maxX) dx = maxX - bx.r;
          if (bx.b - bx.t > maxY - minY) dy = minY - bx.t; else if (bx.t < minY) dy = minY - bx.t; else if (bx.b > maxY) dy = maxY - bx.b;
          if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
          var cur = cfg.pos[k] || [0, 0];
          cfg.pos[k] = [cur[0] + dx / L.width, cur[1] + dy / L.height]; changed = true;
        });
        if (changed) { clamping = false; place(); save(); }
      } finally { clamping = false; }
    }
    var ro = (typeof win.ResizeObserver === 'function') ? new win.ResizeObserver(function () { place(); }) : null;
    if (ro) ro.observe(root);
    win.addEventListener('resize', place);
    win.addEventListener('orientationchange', function () { win.setTimeout(place, 120); });
    place();

    // ── trạng thái hiển thị ──
    var active = opts.show === true || (opts.show !== false && padCoarse());
    var away = false, kbOpen = false;
    function vis() {
      layer.classList.toggle('is-off', !active); layer.classList.toggle('is-away', away); layer.classList.toggle('is-kb', kbOpen);
    }
    vis();
    function haptic() {
      if (!cfg.haptic) return;
      try {
        if (win.JG && typeof win.JG.hapticOn === 'function' && !win.JG.hapticOn()) return;
        var ua = win.navigator.userActivation; if (win.navigator.vibrate && (ua ? ua.hasBeenActive : win.__jgTouched)) win.navigator.vibrate(12);
      } catch (e) { /* bỏ qua */ }
    }

    // ── con trỏ ──
    var ptrs = {};   // id → {kind, ...}
    function lp(ev) { var r = layer.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, r: r }; }
    function press(id) { down[id] = (down[id] || 0) + 1; holdUntil[id] = now() + 90; recomputeLater(95); }
    function release(id) { down[id] = Math.max(0, (down[id] || 0) - 1); if (holdUntil[id] > now()) recomputeLater(holdUntil[id] - now() + 5); }
    function btnTargets(ev) {   // các nút (id) mà điểm chạm đang đè: tròn to ×1.25 cho nút chính, hình chữ nhật cho nút nhỏ
      var out = [], px = ev.clientX, py = ev.clientY, c;
      ids.forEach(function (id) {
        var e = btnEls[id]; if (!e) return;
        var r = e.getBoundingClientRect();
        if (e.dataset.small) { if (px >= r.left - 6 && px <= r.right + 6 && py >= r.top - 6 && py <= r.bottom + 6) out.push({ id: id, d: 0 }); return; }
        var rad = r.width / 2, dx = px - (r.left + rad), dy = py - (r.top + r.height / 2), d = Math.sqrt(dx * dx + dy * dy);
        if (d <= rad * (e.dataset.combo ? 1.1 : 1.25)) out.push({ id: id, d: d });
      });
      if (out.length > 1) {   // đè lên nút kép thì chỉ tính nút kép (đang là A+B)
        var cb = out.filter(function (o) { return o.id === comboId; })[0];
        if (cb) out = [cb];
      }
      var res = {}; out.forEach(function (o) { res[o.id] = 1; });
      if (comboId && res[comboId]) { opts.combo.forEach(function (i) { res[i] = 1; }); }
      return res;
    }
    function setBtns(p, set) {
      var id;
      for (id in p.held) if (!set[id]) { release(id); delete p.held[id]; }
      for (id in set) if (!p.held[id]) { p.held[id] = 1; press(id); haptic(); }
      recompute();
    }
    // stick analog nổi
    var stickR = function () { return U * 1.0; };
    function stickMove(p, ev) {
      var q = lp(ev), R = stickR(), dx = q.x - p.ox, dy = q.y - p.oy, d = Math.sqrt(dx * dx + dy * dy);
      var k = d > R ? R / d : 1, kx = dx * k, ky = dy * k, mag = Math.min(1, d / R);
      if (knob) knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
      if (mag < dead) { touchV = { x: 0, y: 0 }; }
      else { var s = (mag - dead) / (1 - dead); touchV = { x: dx / d * s, y: dy / d * s }; }
      recompute();
    }
    var dirLatch = -1;
    function dpadMove(p, ev) {
      var r = G.stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      var dx = ev.clientX - cx, dy = ev.clientY - cy, d = Math.sqrt(dx * dx + dy * dy), x = 0, y = 0;
      if (d > R * .2) {
        if (mode === 'dpad8') {
          var a = Math.atan2(dx, -dy) * 180 / Math.PI; if (a < 0) a += 360;
          var sec = Math.floor((a + 22.5) / 45) % 8;
          x = [0, 1, 1, 1, 0, -1, -1, -1][sec]; y = [-1, -1, 0, 1, 1, 1, 0, -1][sec];
        } else {
          // 4 hướng: trục trội, có độ trễ (giữ trục cũ tới khi trục kia trội hơn 1.3 lần) → trượt ngón không giật
          var ax = Math.abs(dx), ay = Math.abs(dy), horiz = p.axis === 'x' ? ax * 1.3 >= ay : ax > ay * 1.3;
          if (p.axis === undefined) horiz = ax >= ay;
          p.axis = horiz ? 'x' : 'y';
          if (horiz) x = dx > 0 ? 1 : -1; else y = dy > 0 ? 1 : -1;
        }
      }
      var n = (x && y) ? Math.SQRT1_2 : 1;
      var nv = { x: x * n, y: y * n };
      if (nv.x !== touchV.x || nv.y !== touchV.y) { if (x || y) haptic(); }
      touchV = nv; recompute();
    }
    layer.addEventListener('pointerdown', function (ev) {
      if (ev.target === gear || (ev.target.closest && ev.target.closest('.jgpad-panel'))) return;
      if (editMode) { return editDown(ev); }
      var g = ev.target.closest ? ev.target.closest('[data-g]') : null;
      if (!g) return;
      away = false; vis(); ev.preventDefault();
      var kind = g.dataset.g, p = null, q = lp(ev);
      if (kind === 'zone' || (kind === 'stick' && mode === 'analog')) {
        if (ptrs.stick) return;
        var R = stickR(), W = q.r.width, H = q.r.height;
        var ox = Math.min(W - R - 8, Math.max(R + 8, q.x)), oy = Math.min(H - R - 8, Math.max(R + 8, q.y));
        p = { kind: 'stick', ox: ox, oy: oy, held: {} };
        if (opts.floating === false) { var hr = G.stick.getBoundingClientRect(); p.ox = hr.left + hr.width / 2 - q.r.left; p.oy = hr.top + hr.height / 2 - q.r.top; }
        ptrs.stick = ev.pointerId;
        ring.classList.remove('is-idle');
        ring.style.position = 'absolute';
        if (opts.floating === false) { ring.style.left = '50%'; ring.style.top = '50%'; }
        else { layer.appendChild(ring); ring.style.left = p.ox + 'px'; ring.style.top = p.oy + 'px'; }
        knob.style.transform = '';
        haptic();
      } else if (kind === 'dpad') {
        if (ptrs.stick) return;
        p = { kind: 'dpad', held: {} }; ptrs.stick = ev.pointerId;
      } else {
        p = { kind: 'btn', held: {} };
      }
      ptrs[ev.pointerId] = p;
      try { g.setPointerCapture(ev.pointerId); } catch (e) { /* bỏ qua */ }
      if (p.kind === 'btn') setBtns(p, btnTargets(ev)); else if (p.kind === 'stick') stickMove(p, ev); else dpadMove(p, ev);
    });
    layer.addEventListener('pointermove', function (ev) {
      var p = ptrs[ev.pointerId]; if (!p) return;
      ev.preventDefault();
      if (p.kind === 'btn') setBtns(p, btnTargets(ev)); else if (p.kind === 'stick') stickMove(p, ev); else dpadMove(p, ev);
    });
    function up(ev) {
      var p = ptrs[ev.pointerId]; if (!p) return;
      delete ptrs[ev.pointerId];
      if (p.kind === 'btn') { setBtns(p, {}); }
      else {
        delete ptrs.stick; touchV = { x: 0, y: 0 };
        if (p.kind === 'stick' && ring) {
          knob.style.transform = ''; ring.classList.add('is-idle');
          G.stick.appendChild(ring); ring.style.left = '50%'; ring.style.top = '50%';
        }
        recompute();
      }
    }
    layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', up);
    layer.addEventListener('lostpointercapture', up);
    // mất focus tab: nhả hết
    function releaseAll() {
      Object.keys(ptrs).forEach(function (k) { if (k === 'stick') return; up({ pointerId: +k }); });
      keyDown = {}; keyV = { x: 0, y: 0 }; recompute();
    }
    win.addEventListener('blur', releaseAll);

    // chạm lần đầu (khi chưa hiện) → bật; có thao tác chuột/bàn phím → mờ đi
    function rootDown(ev) {
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
        if (!active) { active = true; vis(); place(); }
        else if (away) { away = false; vis(); }
      }
    }
    root.addEventListener('pointerdown', rootDown, true);
    function focusChange() {
      var a = doc.activeElement, tag = a && a.tagName;
      kbOpen = !!(a && (tag === 'INPUT' || tag === 'TEXTAREA' || a.isContentEditable)); vis();
    }
    doc.addEventListener('focusin', focusChange); doc.addEventListener('focusout', function () { setTimeout(focusChange, 0); });

    // ── bàn phím ──
    var keyMap = {};   // code|key → {btn:id} | {dir:'up'..}
    function bindKeys(codes, v) { codes.forEach(function (c) { keyMap[c] = v; }); }
    bindKeys(['ArrowUp', 'KeyW'], { dir: 'up' }); bindKeys(['ArrowDown', 'KeyS'], { dir: 'down' });
    bindKeys(['ArrowLeft', 'KeyA'], { dir: 'left' }); bindKeys(['ArrowRight', 'KeyD'], { dir: 'right' });
    btnDefs.forEach(function (b, i) { var ks = b.key ? [].concat(b.key) : (PAD_KEYS[i] || []); bindKeys(ks, { btn: b.id }); });
    smallDefs.forEach(function (s) { var ks = s.key ? [].concat(s.key) : (PAD_SKEYS[s.id] || []); bindKeys(ks, { btn: s.id }); });
    var dirs = {};
    function keyEvt(ev, isDown) {
      var t = ev.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var m = keyMap[ev.code] || keyMap[ev.key];
      if (!m) return;
      if (ev.key === 'Tab' || ev.code === 'Space' || ev.key.indexOf('Arrow') === 0) ev.preventDefault();
      if (m.dir) dirs[m.dir] = isDown; else keyDown[m.btn] = isDown;
      keyV = { x: (dirs.right ? 1 : 0) - (dirs.left ? 1 : 0), y: (dirs.down ? 1 : 0) - (dirs.up ? 1 : 0) };
      if (keyV.x && keyV.y) { keyV.x *= Math.SQRT1_2; keyV.y *= Math.SQRT1_2; }
      if (mode === 'dpad4' && keyV.x && keyV.y) { keyV = { x: 0, y: keyV.y }; }
      if (isDown) { away = true; vis(); }
      recompute();
    }
    var kd = function (e) { keyEvt(e, true); }, ku = function (e) { keyEvt(e, false); };
    var useInput = opts.keys !== false;
    if (useInput) { win.addEventListener('keydown', kd); win.addEventListener('keyup', ku); }

    // ── tay cầm (Gamepad API) ──
    var raf = 0;
    function pollGp() {
      raf = 0; if (destroyed) return;
      var list = []; try { list = (win.navigator.getGamepads && win.navigator.getGamepads()) || []; } catch (e) { /* bỏ qua */ }
      var gp = null; for (var i = 0; i < list.length; i++) if (list[i] && list[i].connected) { gp = list[i]; break; }
      if (gp) {
        var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, m = Math.sqrt(ax * ax + ay * ay), b = gp.buttons;
        var pr = function (n) { return !!(b[n] && (b[n].pressed || b[n].value > .5)); };
        var x = 0, y = 0;
        if (m > .22) { var s = Math.min(1, (m - .22) / .78); x = ax / m * s; y = ay / m * s; }
        if (pr(14)) x = -1; if (pr(15)) x = 1; if (pr(12)) y = -1; if (pr(13)) y = 1;
        if ((pr(12) || pr(13)) && (pr(14) || pr(15))) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
        var nd = {};
        btnDefs.forEach(function (bd, i) { nd[bd.id] = pr(PAD_GP[i]); });
        smallDefs.forEach(function (sd) { nd[sd.id] = pr(sd.id === 'select' ? 8 : 9); });
        var any = m > .22 || Object.keys(nd).some(function (k) { return nd[k]; }) || pr(12) || pr(13) || pr(14) || pr(15);
        var changed = x !== gpV.x || y !== gpV.y || Object.keys(nd).some(function (k) { return !!nd[k] !== !!gpDown[k]; });
        gpV = { x: x, y: y }; gpDown = nd;
        if (any && !away) { away = true; vis(); }
        if (changed) recompute();
      } else if (gpV.x || gpV.y || Object.keys(gpDown).length) { gpV = { x: 0, y: 0 }; gpDown = {}; recompute(); }
      raf = win.requestAnimationFrame(pollGp);
    }
    function gpOn() { if (!raf && !destroyed) raf = win.requestAnimationFrame(pollGp); }
    if (useInput) { win.addEventListener('gamepadconnected', gpOn); try { if ((win.navigator.getGamepads || function () { return []; }).call(win.navigator).length) gpOn(); } catch (e) { /* bỏ qua */ } }

    // turbo: nháy 12 Hz khi giữ nút có `turbo`
    var turboTimer = setInterval(function () {
      if (!turboOn) return;
      var any = btnDefs.some(function (b) { return b.turbo && !b.hold && ((down[b.id] || 0) > 0 || keyDown[b.id] || gpDown[b.id]); });
      if (any || turboPhase === false) { turboPhase = !turboPhase; if (any) recompute(); }
    }, 42);
    turboOn = !!cfg.turbo;

    // ── tùy chỉnh ──
    var editMode = false, panel = null, drag = null;
    function editDown(ev) {
      var g = ev.target.closest ? ev.target.closest('[data-g]') : null;
      if (!g || g.dataset.g === 'zone') return;
      ev.preventDefault();
      var key = g.dataset.g === 'dpad' ? 'stick' : g.dataset.g;
      var r = layer.getBoundingClientRect(), cur = cfg.pos[key] || [0, 0];
      drag = { id: ev.pointerId, key: key, x: ev.clientX, y: ev.clientY, base: cur.slice(), W: r.width, H: r.height };
      try { g.setPointerCapture(ev.pointerId); } catch (e) { /* bỏ qua */ }
    }
    layer.addEventListener('pointermove', function (ev) {
      if (!editMode || !drag || ev.pointerId !== drag.id) return;
      // pos[cụm] = [dịch sang phải, dịch xuống] theo tỉ lệ bề rộng/cao khung (cùng nghĩa cho cả cụm trái lẫn phải)
      cfg.pos[drag.key] = [Math.max(-1.5, Math.min(1.5, drag.base[0] + (ev.clientX - drag.x) / drag.W)), Math.max(-1.5, Math.min(1.5, drag.base[1] + (ev.clientY - drag.y) / drag.H))];
      place();
    });
    function dragEnd(ev) { if (drag && ev.pointerId === drag.id) { drag = null; save(); } }
    layer.addEventListener('pointerup', dragEnd); layer.addEventListener('pointercancel', dragEnd);

    function setEdit(on) {
      editMode = !!on; layer.classList.toggle('is-edit', editMode);
      if (editMode) { active = true; away = false; vis(); }
    }
    function closePanel() { if (panel && panel.parentNode) panel.parentNode.removeChild(panel); panel = null; }
    function openSettings() {
      if (panel) { closePanel(); setEdit(false); return; }
      active = true; away = false; vis();
      panel = mk('jgpad-panel', layer);
      var swapTxt = G.stick ? ['Đổi tay (cần sang phải)', 'Cần bên phải (đổi lại)'] : ['Đổi tay (nút sang trái)', 'Nút bên trái (đổi lại)'];
      var turboAny = btnDefs.some(function (b) { return b.turbo && !b.hold; });
      var h = '<h4>Tùy chỉnh nút</h4>' +
        '<div class="row"><span>Cỡ nút</span>' + ['s', 'm', 'l'].map(function (k) { return '<button type="button" data-size="' + k + '" class="' + (cfg.size === k ? 'is-sel' : '') + '">' + k.toUpperCase() + '</button>'; }).join('') + '</div>' +
        '<div class="row"><span>Độ mờ</span><input type="range" min="20" max="100" value="' + Math.round(cfg.opacity * 100) + '" data-op aria-label="Độ mờ"></div>' +
        (choices.length > 1 ? '<div class="row"><span>Kiểu cần</span>' + choices.map(function (m) { return '<button type="button" data-stick="' + m + '" class="' + (mode === m ? 'is-sel' : '') + '">' + (m === 'analog' ? 'Cần nổi' : m === 'dpad4' ? 'Nút 4 hướng' : 'Nút 8 hướng') + '</button>'; }).join('') + '</div>' : '') +
        '<div class="row"><span>Tay</span><button type="button" data-swap>' + (cfg.swap ? swapTxt[1] : swapTxt[0]) + '</button></div>' +
        '<div class="row"><label><input type="checkbox" data-haptic ' + (cfg.haptic ? 'checked' : '') + '> Rung khi bấm</label></div>' +
        (turboAny ? '<div class="row"><label><input type="checkbox" data-turbo ' + (cfg.turbo ? 'checked' : '') + '> Bấm giữ = nháy liên tục (turbo ⚡)</label></div>' : '') +
        '<div class="row"><button type="button" data-edit>' + (editMode ? 'Xong kéo' : 'Kéo đặt vị trí') + '</button><button type="button" data-reset>Đặt lại</button><button type="button" data-close>Đóng</button></div>';
      panel.innerHTML = h;
      panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      panel.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.size) { cfg.size = t.dataset.size; save(); place(); [].forEach.call(panel.querySelectorAll('[data-size]'), function (b) { b.classList.toggle('is-sel', b.dataset.size === cfg.size); }); }
        else if (t.dataset.stick) { if (t.dataset.stick !== mode) { cfg.stick = t.dataset.stick; save(); if (typeof opts.onRestick === 'function') opts.onRestick(cfg.stick); } }
        else if (t.hasAttribute('data-swap')) { cfg.swap = !cfg.swap; save(); place(); t.textContent = cfg.swap ? swapTxt[1] : swapTxt[0]; }
        else if (t.hasAttribute('data-edit')) { setEdit(!editMode); t.textContent = editMode ? 'Xong kéo' : 'Kéo đặt vị trí'; if (editMode) panel.style.display = 'none'; }
        else if (t.hasAttribute('data-reset')) { reset(); }
        else if (t.hasAttribute('data-close')) { closePanel(); setEdit(false); }
      });
      panel.addEventListener('input', function (e) {
        if (e.target.hasAttribute('data-op')) { cfg.opacity = Math.min(1, Math.max(.2, e.target.value / 100)); save(); layer.style.setProperty('--jgp-o', cfg.opacity); }
      });
      panel.addEventListener('change', function (e) {
        if (e.target.hasAttribute('data-haptic')) { cfg.haptic = !!e.target.checked; save(); }
        if (e.target.hasAttribute('data-turbo')) { cfg.turbo = !!e.target.checked; turboOn = cfg.turbo; save(); btnDefs.forEach(function (b) { if (btnEls[b.id]) btnEls[b.id].classList.toggle('is-turbo', !!(b.turbo && !b.hold && cfg.turbo)); }); }
      });
    }
    // đang kéo đặt: chạm vào nền (ngoài cụm) hiện lại bảng
    function reset() {
      var k; for (k in DEF) cfg[k] = (k === 'pos') ? {} : DEF[k];
      turboOn = false; save(); place();
      if (panel) { closePanel(); setEdit(false); openSettings(); }
    }
    btnDefs.forEach(function (b) { if (btnEls[b.id]) btnEls[b.id].classList.remove('is-turbo'); });
    if (turboOn) btnDefs.forEach(function (b) { if (b.turbo && !b.hold && btnEls[b.id]) btnEls[b.id].classList.add('is-turbo'); });

    function destroy() {
      destroyed = true; clearInterval(turboTimer); clearTimeout(recTimer);
      if (raf) win.cancelAnimationFrame(raf);
      win.removeEventListener('keydown', kd); win.removeEventListener('keyup', ku); win.removeEventListener('resize', place);
      win.removeEventListener('blur', releaseAll); win.removeEventListener('gamepadconnected', gpOn);
      root.removeEventListener('pointerdown', rootDown, true);
      if (ro) ro.disconnect();
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }
    recompute();
    return {
      state: st, destroy: destroy, openSettings: openSettings, reset: reset, settings: cfg, el: layer,
      get: function () { return JSON.parse(JSON.stringify(st)); },
      took: function (id) { var v = !!edge[id]; edge[id] = false; return v; },
      show: function () { active = true; away = false; vis(); place(); },
      hide: function () { active = false; vis(); }
    };
  }

  return { VERSION: VERSION, pad: pad, esc: esc, q: q, still: still, nameOf: nameOf, sound: sound, fmt: fmt,
    timer: timer, chips: chips, bar: bar, banner: banner, turnText: turnText, injectCss: injectCss };
})();
