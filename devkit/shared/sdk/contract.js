'use strict';
/*
 * Bộ kiểm HỢP ĐỒNG GIAO THỨC GAME v2 (GAME-PROTOCOL.md mục 4–7) — dùng bởi tools/runner.js (test_game) và devkit.
 * Soi mọi view()/result() mà bộ kiểm gọi trong ca kiểm + ván ngẫu nhiên:
 *   - game v2 (manifest "sdk" hoặc "manifest": 2): sai = LỖI (trượt);
 *   - game v1: chỉ CẢNH BÁO (gom theo loại, in 1 lần) — game cũ vẫn đạt.
 * Không phụ thuộc đường dẫn cứng: đọc reasons.json cạnh file này.
 */
const fs = require('node:fs');
const path = require('node:path');

const STD = JSON.parse(fs.readFileSync(path.join(__dirname, 'reasons.json'), 'utf8')).reasons;
const REASON_RE = /^[a-z][a-z0-9-]{1,23}$/;
const STD_VIEW = ['phase', 'turn', 'you', 'youDone', 'seats', 'timer', 'scores', 'finishOrder', 'result'];

function isInt(v) { return Number.isInteger(v); }

function makeChecker(manifest) {
  const strict = !!(manifest.sdk || manifest.manifest === 2);
  const custom = manifest.reasons && typeof manifest.reasons === 'object' ? manifest.reasons : {};
  const issues = new Map();          // thông điệp -> số lần
  const missing = new Set();         // trường chuẩn v2 vắng mặt (v1)
  const reasons = new Set();
  const note = (msg) => issues.set(msg, (issues.get(msg) || 0) + 1);
  const c = { strict, np: 0 };

  c.view = function (v, seat) {
    const np = c.np;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return note('view(' + seat + ') phải là đối tượng');
    STD_VIEW.forEach((k) => { if (v[k] === undefined) missing.add(k); });
    if (v.phase !== undefined && (typeof v.phase !== 'string' || !v.phase || v.phase.length > 24)) note('view.phase phải là chữ ngắn');
    if (v.turn !== undefined && v.turn !== null && !(isInt(v.turn) && v.turn >= -1 && v.turn < np)) note('view.turn phải là ghế 0..' + (np - 1) + ' hoặc null (-1 = không ai)');
    if (v.you !== undefined && v.you !== (seat >= 0 && seat < np ? seat : -1)) note('view.you phải = ghế người nhận (người xem = -1)');
    if (v.youDone !== undefined && typeof v.youDone !== 'boolean') note('view.youDone phải là true/false (không bỏ trống khi false)');
    if (seat < 0 && v.youDone === true) note('view(-1).youDone phải false (người xem)');
    if (v.seats !== undefined && !(Array.isArray(v.seats) && v.seats.length === np && v.seats.every((p) => p && typeof p.name === 'string'))) note('view.seats phải là mảng ' + np + ' ghế {name, out, done, bot}');
    if (v.timer !== undefined && v.timer !== null && !(typeof v.timer === 'object' && typeof v.timer.left === 'number' && v.timer.left >= 0)) note('view.timer phải là null hoặc {left (ms ≥ 0), total}');
    if (v.scores !== undefined && v.scores !== null && !(Array.isArray(v.scores) && v.scores.length === np && v.scores.every((x) => typeof x === 'number'))) note('view.scores phải là null hoặc mảng ' + np + ' số');
    if (v.finishOrder !== undefined && !(Array.isArray(v.finishOrder) && v.finishOrder.every((x) => isInt(x) && x >= 0 && x < np))) note('view.finishOrder phải là mảng ghế');
    if (v.result !== undefined && v.result !== null && typeof v.result !== 'object') note('view.result phải là null hoặc Result');
    if (strict) {
      ['phase', 'turn', 'you', 'youDone', 'seats', 'timer', 'result'].forEach((k) => { if (v[k] === undefined) note('view thiếu trường chuẩn "' + k + '"'); });
    }
  };

  c.result = function (r) {
    const np = c.np;
    if (r === null || r === undefined) return;
    if (typeof r !== 'object' || Array.isArray(r)) return note('result() phải trả null hoặc {winners, reason, draw?, ranks?}');
    if (!Array.isArray(r.winners) || !r.winners.every((w) => isInt(w) && w >= 0 && w < np) || new Set(r.winners).size !== r.winners.length) note('result.winners phải là mảng ghế không trùng');
    if (r.draw !== undefined && typeof r.draw !== 'boolean') note('result.draw phải là true/false');
    if (r.draw === true && Array.isArray(r.winners) && r.winners.length === 1) note('result.draw = true mà chỉ 1 người thắng');
    if (r.ranks !== undefined && !(Array.isArray(r.ranks) && r.ranks.length === np)) note('result.ranks phải là mảng ' + np + ' hạng (1 = nhất)');
    if (typeof r.reason !== 'string' || !REASON_RE.test(r.reason)) note('result.reason phải khớp ' + REASON_RE);
    else {
      reasons.add(r.reason);
      if (!STD[r.reason] && !custom[r.reason]) note('result.reason "' + r.reason + '" không thuộc lý do chuẩn (shared/sdk/reasons.json) — khai manifest "reasons"');
    }
  };

  /** Sau khi 1 ghế đầu hàng mà ván còn chạy: chính ghế đó phải thấy youDone:true (khung ẩn nút Đầu hàng). */
  c.afterResign = function (v) { if (v && v.youDone !== true) note('ghế đã đầu hàng (ván còn chạy) chưa thấy view.youDone = true'); };

  c.report = function (log) {
    const lines = [];
    if (!strict && missing.size) lines.push('trường chuẩn v2 chưa có trong view: ' + [...missing].join(', '));
    for (const [msg, n] of issues) lines.push(msg + (n > 1 ? ' (' + n + ' lần)' : ''));
    const head = strict ? 'Hợp đồng v2 (game khai sdk/manifest 2 — sai là TRƯỢT):' : 'Hợp đồng v2 (game v1 — chỉ CẢNH BÁO, không trượt):';
    log(head);
    if (!lines.length) log('  ĐẠT   view/result đúng chuẩn v2; lý do kết thúc gặp: ' + ([...reasons].join(', ') || '—'));
    else lines.forEach((l) => log('  ' + (strict ? 'TRƯỢT  ' : 'Lưu ý  ') + l));
    return strict ? issues.size : 0;
  };
  return c;
}

module.exports = { makeChecker, STD_REASONS: STD, REASON_RE };
