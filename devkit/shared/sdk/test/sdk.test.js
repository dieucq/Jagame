'use strict';
// Kiểm SDK v2: node --test shared/sdk/test/   (không phụ thuộc đường dẫn cứng — tính từ thư mục file này)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SDK = path.join(__dirname, '..');
const STORE = path.join(SDK, '..', '..');
const { loadGame } = require(path.join(STORE, 'tools', 'sandbox.js'));
const bundle = require(path.join(SDK, 'bundle.js'));
const coreSrc = fs.readFileSync(path.join(SDK, 'server', 'jg-core.js'), 'utf8');

function core() { const f = new Function(coreSrc + '\nreturn JGCore;'); return f(); }   // chỉ trong test (máy thật chạy vm)

test('jg-core không có chữ async/await (máy từ chối nạp) và REASONS khớp reasons.json', () => {
  assert.ok(!/\b(?:async|await)\b/.test(coreSrc));
  const J = core();
  const std = JSON.parse(fs.readFileSync(path.join(SDK, 'reasons.json'), 'utf8')).reasons;
  assert.deepStrictEqual(Object.keys(J.REASONS).sort(), Object.keys(std).sort());
  Object.keys(std).forEach((k) => assert.strictEqual(J.REASONS[k], std[k].by, k));
});

test('bundle Node == Python từng byte (loto, template)', () => {
  const py = 'import sys,os,json; sys.path.insert(0, sys.argv[1]); import jgame\n' +
    'for d in sys.argv[2:]:\n  m=jgame.read_json(os.path.join(d,"manifest.json")); b=jgame.sdk_bundle(d,m)\n' +
    '  import hashlib; print(json.dumps({k: hashlib.sha256(v).hexdigest() for k,v in sorted(b.items())}))';
  const dirs = [path.join(STORE, 'games', 'loto'), path.join(STORE, 'devkit', 'template', 'oantuti')].filter((d) => fs.existsSync(d));
  const r = spawnSync('python3', ['-c', py, path.join(STORE, 'tools')].concat(dirs), { encoding: 'utf8' });
  if (r.error) return;   // máy không có Python: bỏ qua (devkit chỉ cần Node)
  assert.strictEqual(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  dirs.forEach((d, i) => {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
    const want = JSON.parse(lines[i]);
    ['server', 'client'].forEach((k) => {
      const h = require('node:crypto').createHash('sha256').update(bundle.bundled(d, m, k)).digest('hex');
      assert.strictEqual(h, want[m.entry[k]], d + ' ' + k);
    });
  });
});

test('game(): phong bì, kiểm nước, chép sâu, lỗi không đổi state, đầu hàng, kết quả, view chuẩn', () => {
  const src = "'use strict';\n" + coreSrc + `
module.exports = JGCore.game({
  kind: 'turn',
  setup: function (s) { s.jg.turn = 0; s.count = 0; },
  moves: { add: { args: { k: { int: [1, 3] } }, turn: true, run: function (s, ctx, mv) {
    if (s.count + mv.k > 10) return JGCore.err('rule', 'Quá 10');
    s.count += mv.k; ctx.events.push({ t: 'add', k: mv.k });
    if (s.count === 10) JGCore.end(s, { winners: [ctx.player], reason: 'win' });
    else s.jg.turn = JGCore.Seats.next(ctx.player, s.jg.n, function (q) { return !s.jg.out[q]; });
  } } },
  scores: function (s) { return JGCore.fill(s.jg.n, s.count); },
  view: function (s, you, v) { v.count = s.count; }
});`;
  const g = loadGame(src, { timeout: 1000 });
  const P = (n) => Array.from({ length: n }, (_, i) => ({ id: i, name: 'N' + i }));
  let s = g.call('setup', { ctx: { players: P(3), options: {}, now: 5 }, seed: 1 });
  assert.strictEqual(s.jg.n, 3);
  const J = JSON.stringify(s);
  let r = g.call('move', { state: s, ctx: { player: 1, move: { type: 'add', k: 1 }, now: 6 }, seed: 2 });
  assert.match(r.error, /lượt/); assert.strictEqual(r.code, 'not-your-turn'); assert.strictEqual(JSON.stringify(r.state), J);
  r = g.call('move', { state: s, ctx: { player: 0, move: { type: 'add', k: 9 }, now: 6 }, seed: 2 });
  assert.strictEqual(r.code, 'bad-move');
  r = g.call('move', { state: s, ctx: { player: 0, move: { type: 'add', k: 3 }, now: 6 }, seed: 2 });
  assert.ok(!r.error); assert.deepStrictEqual(r.events, [{ t: 'add', k: 3 }]); assert.strictEqual(JSON.stringify(s), J, 'state cũ không bị sửa');
  s = r.state;
  const v = g.call('view', { state: s, seat: 1 });
  assert.strictEqual(v.proto, 2); assert.strictEqual(v.turn, 1); assert.strictEqual(v.you, 1); assert.strictEqual(v.youDone, false);
  assert.strictEqual(v.seats.length, 3); assert.deepStrictEqual(v.scores, [3, 3, 3]); assert.strictEqual(v.result, null); assert.strictEqual(v.count, 3);
  // ghế 1 (đang lượt) đầu hàng: 3 người -> ván tiếp, lượt chuyển ghế 2, youDone
  s = g.call('move', { state: s, ctx: { player: 1, move: { type: 'resign' }, now: 7 }, seed: 3 }).state;
  assert.strictEqual(g.call('result', { state: s }), null);
  assert.strictEqual(g.call('view', { state: s, seat: 1 }).youDone, true);
  assert.strictEqual(g.call('view', { state: s, seat: -1 }).turn, 2);
  assert.match(g.call('move', { state: s, ctx: { player: 1, move: { type: 'add', k: 1 } }, seed: 4 }).error, /rời/);
  s = g.call('move', { state: s, ctx: { player: 2, move: { type: 'resign' }, now: 8 }, seed: 5 }).state;
  assert.deepStrictEqual(g.call('result', { state: s }), { winners: [0], reason: 'resign' });
  assert.match(g.call('move', { state: s, ctx: { player: 0, move: { type: 'add', k: 1 } }, seed: 6 }).error, /kết thúc/);
  assert.strictEqual(g.call('view', { state: s, seat: 0 }).turn, null);
});

test('tiện ích: shuffle tất định, Cards.deck thứ tự chất→hạng, endByScore xếp hạng, Grid.run', () => {
  const J = core();
  let a = 1; const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const d = J.Cards.deck();
  assert.strictEqual(d.length, 52); assert.strictEqual(d[0], 'AS'); assert.strictEqual(d[13], 'AC');
  const x = J.shuffle(rng, J.range(10)); a = 1; const y = J.shuffle(rng, J.range(10));
  assert.deepStrictEqual(x, y);
  const s = { jg: { n: 4, out: [false, false, false, true], done: [], finish: [], end: null } };
  const e = J.endByScore(s, [5, 9, 9, 20], 'score');
  assert.deepStrictEqual(e.winners, [1, 2]); assert.deepStrictEqual(e.ranks, [3, 1, 1, null]);
  const g = J.Grid.make(5, 5, 0); g[2][1] = g[2][2] = g[2][3] = 1;
  assert.strictEqual(J.Grid.run(g, 2, 2, 1, 0), 3);
  assert.strictEqual(J.checkArg('x', ['a', 'b']), 'không thuộc lựa chọn');
  assert.strictEqual(J.checkArg(undefined, { opt: 'int' }), null);
});

test('manifest schema: 20 game kho + trò mẫu không có LỖI; bắt được icon SVG hỏng', () => {
  const mc = require(path.join(SDK, 'manifest-check.js'));
  const games = path.join(STORE, 'games');
  fs.readdirSync(games).forEach((g) => {
    if (!fs.existsSync(path.join(games, g, 'manifest.json'))) return;
    assert.deepStrictEqual(mc.checkGameDir(path.join(games, g)).errors, [], g);
  });
  const t = mc.checkGameDir(path.join(STORE, 'devkit', 'template', 'oantuti'));
  assert.deepStrictEqual(t.errors, []); assert.deepStrictEqual(t.warnings, []);
  assert.ok(mc.svgErrors(Buffer.from('<svg viewBox="0 0 9 9"><g></g></g></svg>'), 'i').some((x) => /XML/.test(x)));
});
