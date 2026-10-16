/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════
   Jagame — BỘ LÁ BÀI DÙNG CHUNG (v1 · 08/10/2026) — đọc README.md cùng thư mục.
   52 lá + mặt lưng, TỰ VẼ bằng SVG (chất, chữ số, hình người J/Q/K đều là hình của Jagame — không chép bộ bài nào).
   ───────────────────────────────────────────────────────────────────────────────────────────────────────
   Gói game phải tự chứa → DÁN nguyên file này vào ĐẦU client/index.js (bên trong IIFE của game thì JGCards là biến cục bộ)
   + chép cards.css vào client/style.css (đổi tiền tố jgk- nếu muốn, xem README).
   Không dùng id/defs trong SVG → bao nhiêu lá trên trang cũng không đụng nhau. Không phụ thuộc phông ngoài.

   API:
     JGCards.svg('10H')                 → chuỗi <svg> mặt bài (mã: hạng A 2..10 J Q K [T=10] + chất S C D H)
     JGCards.el('QS', {tag:'button'})    → phần tử <button class="jgk-card" data-suit="s"> có sẵn SVG + aria-label "Q bích"
     JGCards.back({tag:'div'})           → phần tử lưng bài (hoa văn CSS theo --accent + huy hiệu SVG)
     JGCards.set(el, code|null)          → đổi mặt (null = úp)
     JGCards.flip(el, code)              → lật 320 ms (úp → ngửa hoặc ngược lại), đổi mặt ở giữa vòng lật
     JGCards.fan(handEl)                 → đặt --k/--k2/--n cho tay bài xòe quạt (.jgk-hand.is-fan)
     JGCards.label('10H')                → "10 cơ"     JGCards.parse('10H') → {rank:'10', suit:'h', red:true}
   Bố cục mặt: lá ≥ 88px rộng tự hiện kiểu "cổ điển" (đủ nút chất 2–10); nhỏ hơn hiện kiểu "điện thoại" (chỉ số + chất TO)
   — CSS chọn bằng container query, không cần JS. Ép một kiểu: {layout:'mobile'|'classic'}.
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */
var JGCards = (function () {
  'use strict';
  var W = 250, H = 350;                                         // hệ tọa độ lá 5:7
  var INK = '#17142b', GOLD = '#e8a81c', SKIN = '#f6cfa6', CREAM = '#fffdf8';
  var NAMES = { s: 'bích', c: 'chuồn', d: 'rô', h: 'cơ' };

  /* ── chất: vẽ trong hộp 100×100, tâm (50,50) ─────────────────────────────────────────────── */
  var SUIT = {
    h: '<path d="M50 93C22 72 3 54 3 31 3 15 15 4 29 4c10 0 17 6 21 15 4-9 11-15 21-15 14 0 26 11 26 27 0 23-19 41-47 62z"/>',
    d: '<path d="M50 2c11 18 25 34 42 48-17 14-31 30-42 48C39 80 25 64 8 50 25 36 39 20 50 2z"/>',
    s: '<path d="M50 3c13 19 46 35 46 60 0 14-10 23-22 23-9 0-16-4-20-11 1 10 5 17 13 23H33c8-6 12-13 13-23-4 7-11 11-20 11C14 86 4 77 4 63 4 38 37 22 50 3z"/>',
    c: '<circle cx="50" cy="27" r="21"/><circle cx="27" cy="60" r="21"/><circle cx="73" cy="60" r="21"/><circle cx="50" cy="52" r="13"/>' +
       '<path d="M50 52c1 21 5 34 17 44H33c12-10 16-23 17-44z"/>'
  };
  function suit(s, cx, cy, size, flip, extra) {
    var k = size / 100;
    return '<g transform="translate(' + (cx - size / 2) + ' ' + (cy - size / 2) + ') scale(' + k + ')' +
      (flip ? ' rotate(180 50 50)' : '') + '"' + (extra || '') + '>' + SUIT[s] + '</g>';
  }

  function parse(code) {
    var c = String(code).toUpperCase().trim();
    var s = c.slice(-1).toLowerCase(), r = c.slice(0, -1);
    if (r === 'T' || r === '1') r = '10';
    if (r === '11') r = 'J'; if (r === '12') r = 'Q'; if (r === '13') r = 'K'; if (r === '14') r = 'A';
    if (!SUIT[s] || !/^(A|[2-9]|10|J|Q|K)$/.test(r)) return null;
    return { rank: r, suit: s, red: s === 'h' || s === 'd', court: /^[JQK]$/.test(r) };
  }
  function label(code) { var p = parse(code); return p ? p.rank + ' ' + NAMES[p.suit] : ''; }

  /* ── chữ số góc: "10" ép ngang bằng textLength để vừa cột chỉ số ─────────────────────────── */
  function rankText(r, x, y, size, anchor) {
    var two = r.length > 1;
    return '<text class="jgk-rk" x="' + x + '" y="' + y + '" font-size="' + size + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') +
      (two ? ' textLength="' + Math.round(size * 1.02) + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + r + '</text>';
  }

  /* ── hình người J/Q/K: nhân vật tròn trĩnh kiểu sticker, áo màu chất, viền mực 3, điểm vàng ── */
  function courtArt(r, s) {
    var o = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
    var g = '';
    if (r === 'Q') g += '<path d="M24 60C20 30 36 26 50 26s30 4 26 34l4 34c-8 2-14-2-16-8H36c-2 6-8 10-16 8z" fill="#5a3320" ' + o + '/>';
    g += '<path d="M8 132C10 104 27 88 50 88s40 16 42 44z" fill="currentColor" ' + o + '/>';          // áo
    g += '<path d="M36 90l14 22 14-22" fill="none" stroke="' + GOLD + '" stroke-width="6" stroke-linejoin="round"/>'; // cổ áo vàng
    g += '<g transform="translate(43 113) scale(.14)" fill="' + CREAM + '">' + SUIT[s] + '</g>';                    // chất trên ngực
    g += '<path d="M44 74h12v16H44z" fill="' + SKIN + '"/>';                                                        // cổ
    g += '<circle cx="50" cy="56" r="21" fill="' + SKIN + '" ' + o + '/>';                                           // đầu
    g += '<circle cx="42.5" cy="56" r="2.8" fill="' + INK + '"/><circle cx="57.5" cy="56" r="2.8" fill="' + INK + '"/>';
    g += '<circle cx="37" cy="63" r="4" fill="#f28b8b" opacity=".55"/><circle cx="63" cy="63" r="4" fill="#f28b8b" opacity=".55"/>';
    g += '<path d="M45 64.5q5 4 10 0" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>';
    if (r === 'K') {
      g += '<path d="M31 70c2 16 11 22 19 22s17-6 19-22c-6 6-32 6-38 0z" fill="#efe7d6" ' + o + '/>';              // râu
      g += '<path d="M43 68q7-4 14 0" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';  // ria
      g += '<path d="M29 42l2-24 10 12 9-18 9 18 10-12 2 24z" fill="' + GOLD + '" ' + o + '/>';                   // vương miện
      g += '<circle cx="50" cy="33" r="3.6" fill="currentColor"/>';
    } else if (r === 'Q') {
      g += '<path d="M30 46q20-14 40 0" fill="none" stroke="' + GOLD + '" stroke-width="6" stroke-linecap="round"/>'; // vương miện mảnh
      g += '<path d="M40 40l3-10 7 8 7-8 3 10z" fill="' + GOLD + '" ' + o + '/><circle cx="50" cy="35" r="3.4" fill="currentColor"/>';
      g += '<circle cx="28.5" cy="66" r="3.4" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2"/><circle cx="71.5" cy="66" r="3.4" fill="' + GOLD + '" stroke="' + INK + '" stroke-width="2"/>';
    } else {
      g += '<path d="M30 46c-1-8 8-12 20-12s21 4 20 12" fill="#5a3320" ' + o + '/>';                                   // tóc mái
      g += '<path d="M66 32c8-14 20-18 28-24-2 14-12 24-26 30z" fill="' + CREAM + '" ' + o + '/>';                  // lông vũ
      g += '<path d="M27 44c0-16 10-22 23-22s23 6 23 22z" fill="currentColor" ' + o + '/>';                        // mũ
      g += '<path d="M24 45h52" stroke="' + GOLD + '" stroke-width="7" stroke-linecap="round"/>';
    }
    return g;
  }

  /* ── vị trí nút chất kiểu cổ điển (cột L C R, hàng y) ─────────────────────────────────────── */
  var L = 90, C = 125, R = 160;
  var PIPS = {
    2: [[C, 68], [C, 282]], 3: [[C, 68], [C, 175], [C, 282]],
    4: [[L, 66], [R, 66], [L, 284], [R, 284]],
    5: [[L, 66], [R, 66], [C, 175], [L, 284], [R, 284]],
    6: [[L, 66], [R, 66], [L, 175], [R, 175], [L, 284], [R, 284]],
    7: [[L, 66], [R, 66], [C, 120], [L, 175], [R, 175], [L, 284], [R, 284]],
    8: [[L, 66], [R, 66], [C, 120], [L, 175], [R, 175], [C, 230], [L, 284], [R, 284]],
    9: [[L, 66], [R, 66], [L, 139], [R, 139], [C, 175], [L, 211], [R, 211], [L, 284], [R, 284]],
    10: [[L, 66], [R, 66], [C, 102], [L, 139], [R, 139], [L, 211], [R, 211], [C, 248], [L, 284], [R, 284]]
  };

  function classic(p) {
    var r = p.rank, s = p.suit, out = '';
    var idx = rankText(r, 37, 74, 62, 'middle') + suit(s, 37, 100, 34);
    out += '<g>' + idx + '</g><g transform="rotate(180 125 175)">' + idx + '</g>';
    if (p.court) {
      out += '<rect x="64" y="34" width="122" height="282" rx="12" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-opacity=".55" stroke-width="3"/>';
      out += suit(s, 125, 100, 84, false, ' opacity=".16"');
      out += '<g transform="translate(65 157.6) scale(1.2)">' + courtArt(r, s) + '</g>';
      out += suit(s, 82, 54, 22) + suit(s, 168, 296, 22, true);
    } else if (r === 'A') {
      out += '<circle cx="125" cy="175" r="72" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>';
      out += suit(s, 125, 175, 104);
    } else {
      PIPS[r].forEach(function (pt) { out += suit(s, pt[0], pt[1], 46, pt[1] > 190); });
    }
    return out;
  }

  function mobile(p) {
    var r = p.rank, s = p.suit, out = '';
    // chỉ số TO trong 45% bề rộng bên trái (phần luôn lòi ra khi xòe bài)
    out += rankText(r, 15, 92, 96) + suit(s, 46, 132, 54);
    if (p.court) {
      out += '<rect x="102" y="160" width="134" height="176" rx="14" fill="currentColor" fill-opacity=".08"/>';
      out += '<g transform="translate(115 193.4) scale(1.08)">' + courtArt(r, s) + '</g>';
    } else if (r === 'A') {
      out += '<circle cx="160" cy="250" r="72" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>';
      out += suit(s, 160, 250, 112);
    } else {
      out += suit(s, 168, 262, 116);
    }
    return out;
  }

  function svg(code, opt) {
    var p = parse(code); opt = opt || {};
    if (!p) return '';
    var lay = opt.layout || 'auto', body = '';
    if (lay !== 'classic') body += '<g class="jgk-m">' + mobile(p) + '</g>';
    if (lay !== 'mobile') body += '<g class="jgk-c">' + classic(p) + '</g>';
    return '<svg class="jgk-face" viewBox="0 0 ' + W + ' ' + H + '" fill="currentColor" aria-hidden="true" focusable="false"' +
      (lay === 'auto' ? '' : ' data-layout="' + lay + '"') + '>' + body + '</svg>';
  }

  /* lưng bài: hoa văn = CSS (theo --accent của giao diện), giữa là huy hiệu SVG (không id) */
  var BACK_SVG = '<svg class="jgk-emblem" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
    '<path d="M50 6l12 20 22-4-4 22 20 6-20 6 4 22-22-4-12 20-12-20-22 4 4-22L0 50l20-6-4-22 22 4z" fill="currentColor" opacity=".9"/>' +
    '<circle cx="50" cy="50" r="23" fill="var(--jgk-back-ink, #fffdf8)"/>' +
    '<g transform="translate(36 36) scale(.28)" fill="var(--jgk-back, #2f54eb)">' + SUIT.s + '</g></svg>';

  function make(tag) {
    var el = document.createElement(tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    el.className = 'jgk-card';
    return el;
  }
  function set(el, code, opt) {
    var p = code ? parse(code) : null;
    el.classList.toggle('is-back', !p);
    if (p) {
      el.dataset.suit = p.suit; el.dataset.code = code;
      el.innerHTML = svg(code, opt);
      el.setAttribute('aria-label', label(code));
    } else {
      delete el.dataset.suit; delete el.dataset.code;
      el.innerHTML = BACK_SVG;
      el.setAttribute('aria-label', 'Lá bài úp');
    }
    return el;
  }
  function el(code, opt) { opt = opt || {}; return set(make(opt.tag), code, opt); }
  function back(opt) { opt = opt || {}; return set(make(opt.tag || 'div'), null); }

  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function flip(node, code, opt) {
    if (reduced()) return set(node, code, opt);
    node.classList.remove('is-flip-a', 'is-flip-b');
    void node.offsetWidth;
    node.classList.add('is-flip-a');                            // 0→90° (160 ms)
    setTimeout(function () {
      set(node, code, opt);
      node.classList.remove('is-flip-a'); node.classList.add('is-flip-b');   // 90→0° (160 ms, nảy nhẹ)
      setTimeout(function () { node.classList.remove('is-flip-b'); }, 200);
    }, 160);
    return node;
  }
  function fan(hand) {
    var cards = hand.querySelectorAll('.jgk-card'), n = cards.length;
    hand.style.setProperty('--n', n);
    for (var i = 0; i < n; i++) {
      var k = i - (n - 1) / 2;
      cards[i].style.setProperty('--i', i);
      cards[i].style.setProperty('--k', k);
      cards[i].style.setProperty('--k2', k * k);
    }
  }

  return { svg: svg, el: el, back: back, set: set, flip: flip, fan: fan, parse: parse, label: label, SUIT_NAMES: NAMES,
    ALL: (function () { var a = []; 'SCDH'.split('').forEach(function (s) { ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
      .forEach(function (r) { a.push(r + s); }); }); return a; })() };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = JGCards;
