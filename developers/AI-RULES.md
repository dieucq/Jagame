# AI-RULES — luật viết và gửi game Jagame (dành cho AI agent)

> Đối tượng: AI agent viết code (Claude Code, Codex, Cursor…). Đọc HẾT tệp này trước khi sửa bất cứ thứ gì. Mọi câu ở đây là luật,
> không phải gợi ý. MUST = bắt buộc · MUST NOT = cấm · SHOULD = nên (bỏ qua phải có lý do). Bản máy đọc: `developers/ai-rules.json`
> (cùng luật; `devkit/check_submission.py` đọc tệp đó). Chi tiết giao thức cho người: `developers/GIAO-THUC.md`.
> Ngôn ngữ giao diện game: tiếng Việt có dấu.

## 0. Tóm tắt 12 dòng
1. Mục tiêu: 1 thư mục `submissions/<id>/` chứa 1 game đúng chuẩn + 1 Pull Request chỉ đụng thư mục đó.
2. Bạn MUST chỉ tạo/sửa tệp trong `submissions/<id>/` (và nháp trong `devkit/games/<id>/`, đã bị `.gitignore`). MUST NOT sửa tệp nào khác.
3. `<id>` MUST khớp `^[a-z][a-z0-9-]{1,31}$`, MUST NOT nằm trong danh sách id cấm (mục 1).
4. Tạo khung bằng `node jagame.js new <id>` trong `devkit/` rồi viết lại thành game CỦA BẠN. MUST NOT gửi bản đổi tên / biến thể nhỏ của
   game mẫu (`oantuti` oẳn tù tì, `nhatque` nhặt que kiểu Nim — gồm "đếm tới 21", `xucxac` gieo xúc xắc) hay của game chính thức: người duyệt từ chối.
5. Luật chơi `server/game.js`: `module.exports = JGCore.game({...})`, hàm thuần trên state JSON, tất định, ngẫu nhiên chỉ `ctx.rng()`.
6. Giao diện `client/index.js`: `JG.defineGame(function (game) { … })`, chỉ vẽ trong `game.root`, chỉ gửi nước bằng `game.send()`.
7. MUST NOT dùng API cấm (mục 4.4) — kể cả trong chuỗi; chữ `async`/`await` cấm kể cả trong chú thích.
8. MUST có `test/cases.json`, `README.md`, `LICENSE`.
9. Chạy lệnh mục 6 ĐÚNG THỨ TỰ; lặp sửa tới khi MỌI lệnh in dòng ĐẠT.
10. Gặp mã lỗi `[E_…]` → tra bảng mục 7, sửa đúng nguyên nhân, chạy lại từ lệnh trượt.
11. Chỉ khi `python3 devkit/check_pr.py` in `PR ĐẠT — giống workflow GitHub` mới push + mở PR theo mẫu mục 8.
12. Không cần hỏi người dùng gì thêm: mọi thứ cần biết nằm trong tệp này + `devkit/games/nhatque/` (mẫu theo lượt) + `devkit/games/xucxac/` (mẫu nhiều người).

## 1. Đặt tên
| Thứ | Luật |
|---|---|
| id game | MUST khớp `^[a-z][a-z0-9-]{1,31}$`: chữ thường a–z, số, `-`; bắt đầu bằng chữ; 2–32 ký tự. Ví dụ đúng: `bongbay`, `ca-ngua-2`, `dua-xe`. Sai: `BongBay`, `bong_bay`, `1game`, `x`. |
| Tiền tố cấm | MUST NOT bắt đầu bằng `local-` hoặc `jg-` |
| id cấm (đã có) | MUST NOT dùng: <!-- RESERVED_IDS -->
`bacay` `baimau` `banmaybay` `baucua` `bietdoi` `cangua` `caro` `chimbay` `chinquan` `chuyentranh` `cotuong` `coup` `covua` `datbom` `dovui` `ganh` `giaithe` `loto` `masoi` `nhatque` `oanquan` `oantuti` `phom` `poker` `tienlen` `vehinh` `xepgach` `xetang` `xidach` `xucxac`
<!-- /RESERVED_IDS --> (nguồn: `ai-rules.json` → `id.reserved_ids`, `devkit/tools/official_ids.json`) |
| Thư mục | MUST là `submissions/<id>/`, đúng bằng `manifest.json` → `"id"` |
| Tên tệp/thư mục | MUST chỉ gồm `A-Z a-z 0-9 . _ - @ +`; MUST NOT bắt đầu bằng `.`; phân biệt hoa/thường; tệp bắt buộc viết đúng như mục 2 (`manifest.json`, `README.md`, `LICENSE` — không `readme.md`, không `License`) |
| Tiền tố lớp CSS | SHOULD là 2–4 chữ viết tắt id + `-` (vd `bb-` cho `bongbay`), mọi lớp của game dùng tiền tố đó |

## 2. Cây thư mục bắt buộc
```
submissions/<id>/
├── manifest.json        BẮT BUỘC   JSON object, mục 3
├── icon.svg             BẮT BUỘC   (hoặc icon.png 256–1024 px vuông) — SVG: viewBox vuông, ≤ 200 KB, không <script>/on*=/href ngoài
├── server/
│   └── game.js          BẮT BUỘC   luật chơi (server/ CHỈ chứa .js/.json)
├── client/
│   ├── index.js         BẮT BUỘC   giao diện
│   ├── style.css        TÙY CHỌN   (khai ở manifest.entry.style)
│   └── assets/…         TÙY CHỌN   svg png jpg jpeg webp gif mp3 ogg m4a woff2 — tài sản tự làm
├── screenshots/…        TÙY CHỌN   ≤ 6 ảnh png/jpg/webp, mỗi ảnh ≤ 400 KB, cạnh 320–2400 px
├── test/
│   └── cases.json       BẮT BUỘC   ca kiểm, mục 5 (test/ chỉ .json .js .md .txt)
├── README.md            BẮT BUỘC   mô tả, luật chơi, tác giả, giấy phép mã, nguồn + giấy phép từng tài sản không tự làm
├── LICENSE              BẮT BUỘC   (hoặc LICENSE.md / LICENSE.txt) — khớp manifest.license
├── CHANGELOG.md         TÙY CHỌN
└── <id>.jgame           TÙY CHỌN   gói dựng sẵn — kho bỏ qua, tự dựng lại
```
Mục gốc cho phép DUY NHẤT: `manifest.json icon.svg icon.png server client screenshots test README.md LICENSE LICENSE.md LICENSE.txt CHANGELOG.md jagame-submit.json <id>.jgame`.
**CẤM (bị từ chối tự động):** tệp/thư mục chấm (`.DS_Store`, `.env`, `.git`, `.vscode`…) · symlink · submodule · `node_modules/` · `assets/`
ở gốc (để trong `client/assets/`) · `package.json` · `.ts .tsx .jsx .html .zip .exe .wasm` · ROM/BIOS (`.nes .sfc .smc .gb .gbc .gba .iso .rom`…) ·
nhị phân không đúng đuôi · đuôi ngoài `json js css svg png jpg jpeg webp gif mp3 ogg m4a woff2 txt md`.
Giới hạn: ≤ 300 tệp · tổng ≤ 30 MB · gói nén ≤ 10 MB · `server/game.js` sau khi gộp SDK (~26 KB) ≤ 256 KB · mỗi dòng mã ≤ 1000 ký tự (SHOULD ≤ 140).

## 3. Manifest
MUST là JSON hợp lệ (không chú thích, không dấu phẩy thừa), khớp `devkit/shared/sdk/manifest.schema.json`. MUST NOT thêm trường ngoài bảng.

| Trường | Bắt buộc | Kiểu / giới hạn | Ghi chú |
|---|---|---|---|
| `manifest` | MUST | `2` | |
| `id` | MUST | `^[a-z][a-z0-9-]{1,31}$` | = tên thư mục |
| `name` | MUST | chuỗi 1–40 | tên hiển thị tiếng Việt |
| `version` | MUST | `X.Y.Z` | bản đầu `0.1.0` hoặc `1.0.0`; cập nhật MUST tăng |
| `api` | MUST | `1` | |
| `sdk` | MUST | `"2"` | công cụ gộp `JGCore`/`JGUI` vào gói |
| `app_min` | MUST | semver | dùng `"0.1.0"` |
| `group` | MUST | `co` \| `dangian` \| `vui` \| `bai` | cờ · dân gian · vui cả nhà · bài lá |
| `players` | MUST | `{"min": a, "max": b}`, 1 ≤ a ≤ b ≤ 50 | |
| `desc` | MUST | chuỗi 1–160 | 1 câu |
| `age` | MUST | số nguyên 3–18 | tuổi tối thiểu |
| `icon` | MUST | `"icon.svg"` \| `"icon.png"` | |
| `entry` | MUST | `{"client": "client/index.js", "server": "server/game.js", "style"?: "client/style.css"}` | |
| `changelog` | MUST | chuỗi | |
| `author` | MUST | chuỗi khác rỗng | |
| `license` | MUST | mã SPDX, vd `"MIT"` | khớp tệp LICENSE |
| `mode` | SHOULD | `"turn"` \| `"simultaneous"` \| `"realtime"` \| `"events"` hoặc mảng; MUST NOT `"action"`; MUST NOT `turn`+`simultaneous` | khớp `kind` trong game.js |
| `tick_ms` | khi có `realtime`/`tick()` | số nguyên 250–60000 | MUST NOT dùng cùng `clock` |
| `color` | SHOULD | `"#rrggbb"` | |
| `spectators` | SHOULD | bool | |
| `tags` | tùy chọn | ≤ 8 chuỗi ≤ 24 | |
| `content` | khi cần | mảng con của `dau-ao so-hai chu-nguoi-choi ve-tu-do an-vai tinh-gio` | cược → MUST `dau-ao` |
| `languages` | SHOULD | `["vi"]` | |
| `howto` | SHOULD | mảng ≤ 10 chuỗi ≤ 400 | cách chơi |
| `news` | SHOULD | chuỗi ≤ 240 | |
| `session` | tùy chọn | `{"minutes": [ít, nhiều]}` | |
| `needs` | SHOULD | `{"sound": bool, "vibrate": bool, "storage": bool, "user_text": bool}` | |
| `bot` | tùy chọn | bool | `true` → game.js MUST có `bot()` |
| `bot_simultaneous` | khi game cùng lúc có bot | bool | |
| `hint` / `hint_max` | tùy chọn | bool / 1–20 | `true` → MUST có `hint()` hoặc `bot()` |
| `undo` / `undo_max` | tùy chọn | bool / 1–20 | |
| `clock` | tùy chọn | `true` \| mảng `"phút+giây"` | chỉ game `turn`, không `tick_ms` |
| `tutorial` | tùy chọn | 1–8 chuỗi hoặc `{text, title?, at?}` | |
| `ui` | tùy chọn | `{players?: "game"\|"frame", events?: bool, end?: "game"\|"frame", fullscreen?: bool, end_banner?: bool}` | |
| `options` | tùy chọn | ≤ 10 `{key, label ≤ 60, choices[1–20], default ∈ choices}` | đọc ở `ctx.options[key]` |
| `reasons` | khi dùng lý do riêng | `{"<mã>": {"text": "…", "by": "winner"\|"loser"\|"none"}}` | mã `^[a-z][a-z0-9-]{1,23}$`, không trùng `reasons.json` |
| `screenshots` | tùy chọn | ≤ 6 `"screenshots/…"` | tệp MUST tồn tại |
| `homepage` | MUST NOT | — | địa chỉ `http(s)://` trong manifest bị chặn (`E_EXTERNAL_URL`) |
| `room`, `resume`, `teams`, `soon`, `unlisted`, `action` | MUST NOT | — | dành cho game chính thức / kho |

**`manifest.json` mẫu hợp lệ hoàn chỉnh** (đổi `id`, `name`, nội dung cho game của bạn):
```json
{
  "manifest": 2,
  "id": "bongbay",
  "name": "Bóng bay",
  "version": "0.1.0",
  "api": 1,
  "sdk": "2",
  "app_min": "0.1.0",
  "group": "vui",
  "color": "#ff7aa8",
  "players": { "min": 2, "max": 4 },
  "spectators": true,
  "desc": "Lần lượt bơm bóng, ai làm bóng nổ là thua",
  "tags": ["nhiều người", "may rủi"],
  "age": 6,
  "languages": ["vi"],
  "icon": "icon.svg",
  "entry": { "client": "client/index.js", "server": "server/game.js", "style": "client/style.css" },
  "mode": "turn",
  "session": { "minutes": [2, 5] },
  "needs": { "sound": true, "vibrate": false, "storage": false, "user_text": false },
  "bot": true,
  "options": [ { "key": "size", "label": "Độ bền bóng", "choices": [10, 20], "default": 10 } ],
  "reasons": { "no-bong": { "text": "làm nổ bóng", "by": "loser" } },
  "howto": ["Tới lượt, bấm Bơm 1, 2 hoặc 3 hơi.", "Ai bơm hơi cuối làm bóng nổ là thua."],
  "news": "Bản đầu tiên.",
  "author": "Tên tác giả",
  "license": "MIT",
  "changelog": "0.1.0: bản đầu tiên."
}
```

## 4. Chuẩn giao tiếp

### 4.1 Luật chơi `server/game.js` (MUST đúng khuôn này)
```js
'use strict';
// JGCore có sẵn (công cụ gộp SDK lên đầu tệp). MUST NOT require/import gì.
module.exports = JGCore.game({
  kind: 'turn',                       // 'turn' | 'simultaneous' | 'realtime' — khớp manifest.mode
  setup: function (s, ctx) {          // ctx = {players:[{id,name,bot?}], options:{key:value}, rng(), now}
    s.size = ctx.options.size === 20 ? 20 : 10;   // MUST kiểm/giới hạn option, có mặc định
    s.air = 0;
    s.jg.phase = 'play';              // s.jg = phong bì SDK: n (số ghế), turn, phase, out[], done[], end…
    s.jg.turn = 0;                    // game theo lượt MUST đặt ghế đi trước
  },
  moves: {
    pump: {
      args: { n: { int: [1, 3] } },   // SDK kiểm kiểu trước khi gọi run; sai → bị từ chối 'bad-move'
      phase: 'play',
      turn: true,                     // chỉ ghế đang tới lượt
      run: function (s, ctx, mv) {    // ctx = {player, move, rng(), now, events[]}; SỬA THẲNG s
        s.air += mv.n;
        if (s.air >= s.size) {          // người làm nổ bóng thua, mọi người còn lại thắng
          JGCore.end(s, { winners: JGCore.Seats.alive(s).filter(function (i) { return i !== ctx.player; }), reason: 'no-bong' });
          return;                       // run trả undefined = nước được nhận
        }
        s.jg.turn = JGCore.Seats.next(ctx.player, s.jg.n, function (q) { return !s.jg.out[q]; });
        // từ chối: return 'Chữ tiếng Việt cho người chơi'  (state tự quay về như cũ)
      }
    }
  },
  view: function (s, you, v) {        // you = ghế người nhận, -1 = người xem. Gắn trường RIÊNG vào v; MUST NOT lộ bí mật
    v.air = s.air; v.size = s.size;
  },
  legal: function (s, seat) {         // SHOULD có: mảng mọi nước hợp lệ của ghế; [] nếu không tới lượt/hết ván
    if (s.jg.end || s.jg.turn !== seat) return [];
    return [1, 2, 3].map(function (n) { return { type: 'pump', n: n }; });
  },
  bot: function (s, seat, ctx) {      // MUST có nếu manifest bot:true. Chỉ ĐỌC s, trả 1 nước hợp lệ hoặc null
    if (s.jg.end || s.jg.turn !== seat) return null;
    return { type: 'pump', n: 1 + JGCore.int(ctx.rng, 3) };
  }
  // tùy chọn: tick(s, ctx{now, rng}) (cần manifest tick_ms), hint(s, seat, ctx) → {move, text?}, scores(s) → number[n],
  //           onResign(s, seat, ctx, resignDefault), undo(s, ctx), logView(s, you)
});
```
| Hàm | Tham số | Trả về | Luật |
|---|---|---|---|
| `setup(s, ctx)` | `s` có sẵn `s.jg`; `ctx.players`, `ctx.options`, `ctx.rng()`, `ctx.now` | không cần (sửa `s`) | MUST tất định theo `ctx.rng` |
| `moves.<type>.run(s, ctx, mv)` | `mv = {type: '<type>', …}` ≤ 8 KB | `undefined` = nhận · chuỗi / `{error, code}` = từ chối | `{type:'resign'}` do SDK lo, MUST NOT khai `resign` |
| `view(s, you, v)` | `you` ∈ 0..n-1 hoặc -1 | không cần (gắn vào `v`) | SDK tự thêm `proto, phase, turn, you, youDone, seats, timer, scores, finishOrder, result` |
| `legal(s, seat)` | | `Move[]` | bộ kiểm dùng để chơi ngẫu nhiên — có `legal` thì kiểm kỹ hơn |
| `bot(s, seat, ctx)` | `ctx = {options, rng(), now}` | `Move` \| `null` | ≤ 250 ms (SHOULD ≤ 10 ms) |
| `tick(s, ctx)` | `ctx = {now, rng()}` | không cần | chỉ khi manifest `tick_ms` |
| `scores(s)` | | `number[n]` \| `null` | bảng điểm cuối ván |
| Kết thúc | `JGCore.end(s, {winners:[ghế], reason, draw?})` · `JGCore.endByScore(s, scores, reason, {lowWins?, drawOnTie?})` | | `reason` MUST thuộc `devkit/shared/sdk/reasons.json` hoặc `manifest.reasons` |

Lý do chuẩn hay dùng: `win` (thắng theo luật) · `score` (điểm cao nhất) · `finish` (về đích) · `het-nguoi` · `het-van` · `draw` · `resign` (SDK tự gán).
SDK `JGCore`: `int(rng,n) pick(rng,arr) shuffle(rng,arr) clone fill(n,v) range sum isInt` · `Seats.next/list/alive/playing` · `Cards.deck/deal/mask` ·
`Grid.make/inside/run` · `Beans.pay/broke/leaders` · `setDeadline(s,ms)/expired(s)/clearDeadline` · `log(s,{t,…})` · `end/endByScore`.

### 4.2 Giao diện `client/index.js` (MUST đúng khuôn này)
```js
JG.defineGame(function (game) {
  'use strict';
  var root = game.root;                               // MUST chỉ vẽ trong root
  root.innerHTML = '<div class="bb"><div class="bb-chips"></div><p class="bb-say"></p></div>';
  function render(v) {
    if (!v) return;
    JGUI.q(root, '.bb-chips').innerHTML = JGUI.chips(game, v);
    JGUI.q(root, '.bb-say').textContent = v.result ? 'Hết ván' : JGUI.turnText(game, v) + ' · hơi ' + v.air + '/' + v.size;
    var mine = v.you >= 0 && v.turn === v.you && !v.result;
    JGUI.bar(root, [1, 2, 3].map(function (n) {
      return { label: 'Bơm ' + n, key: 'p' + n, primary: n === 1, disabled: !mine,
               onClick: function () { game.send({ type: 'pump', n: n }); JGUI.sound(game, 'move'); } };
    }));
  }
  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () {} };                // MUST trả về; dọn hẹn giờ nếu có
});
```
Được dùng: `game.root · game.me {id,name} · game.seat · game.players [{id,name,seat}] · game.options · game.view · game.send(move) ·
game.on('view'|'result'|'error'|'event'|'hint'|'chat', fn) · game.toast(text) · game.sound(name) · game.soundNames · game.highlight(sel,{ms,label}) ·
game.openChat() · game.menu()` · `JGUI.esc q still nameOf turnText sound chips timer bar banner pad` · `JG.storage.get/set` · `JG.haptic('tap'|'ok'|'warn')`.
Âm hợp lệ: `move move-other turn win lose draw error tick join leave chat send start capture check dice deal chip`.
MUST: mọi chữ từ người chơi (tên) qua `JGUI.esc()` trước khi vào `innerHTML` (hoặc dùng `textContent`) · chỉ biến CSS của khung
(`var(--ink) var(--paper) var(--accent) var(--line) var(--soft) var(--muted) var(--radius)`; đồ vật: `var(--jg-obj-ink) var(--jg-obj-paper)`) ·
vùng bấm ≥ 44 px · không tràn ngang ở 360 px · `@media (prefers-reduced-motion: reduce)` tắt animation.

### 4.3 Tất định + thời gian
- MUST: cùng state + cùng seed `ctx.rng` → cùng kết quả. Ngẫu nhiên CHỈ `ctx.rng()` / `JGCore.int(ctx.rng, n)`. Hệ thống cấp seed.
- MUST: state chỉ chứa object/mảng/số/chuỗi/bool/null. MUST NOT Map, Set, hàm, `undefined`, `NaN`, biến toàn cục giữ trạng thái.
- Thời gian CHỈ qua `ctx.now` (ms) — dùng `JGCore.setDeadline(s, ms)` + `JGCore.expired(s)` trong `tick`.

### 4.4 API CẤM (bộ quét tĩnh — chặn tự động)
`server/` (đã bỏ chú thích; **chuỗi vẫn bị quét** — đừng viết các chữ này cả trong chuỗi):
`require` · `import` · `process` · `Date` · `Promise` · `setTimeout`/`setInterval` · `eval(` · `Function(`/`new Function` · `constructor.constructor` ·
`__proto__` · `Proxy` · `Reflect` · `WebAssembly` · `SharedArrayBuffer`/`Atomics` · `ArrayBuffer` `DataView` `BigInt` `Int8Array`…`Float64Array` ·
`globalThis[` · và chữ **`async`/`await` ở BẤT KỲ đâu kể cả chú thích**. (Không có `fs`, `net`, `http`, `child_process` — `require` đã bị cấm.)
`client/`: `fetch(` · `XMLHttpRequest` · `WebSocket` · `EventSource` · `RTCPeerConnection` · `sendBeacon` · `document.cookie` · `localStorage` ·
`sessionStorage` · `indexedDB` (dùng `JG.storage`) · `window.parent`/`top`/`opener` · `postMessage` · `eval(` · `Function(` · `setTimeout("…")` ·
`import` · `Worker` · `serviceWorker` · `importScripts` · `WebAssembly` · `<iframe` `<object` `<embed`.
Mọi tệp chữ (trừ `README.md`, `test/`): MUST NOT chứa `http://` / `https://` (trừ `http://www.w3.org/` trong SVG).

### 4.5 Giới hạn chạy (khu cách ly)
| Giới hạn | Giá trị |
|---|---|
| Mỗi lần gọi `setup/move/view/result/tick/legal` | ≤ 150 ms (bộ kiểm cục bộ báo lỗi > 250 ms; SHOULD < 5 ms) |
| `bot` / `hint` | ≤ 250 ms (SHOULD < 10 ms) |
| `server/game.js` sau gộp SDK | ≤ 256 KB |
| State / view (JSON) | ≤ 256 KB |
| Bộ nhớ | 64 MB |
| `tick_ms` | ≥ 250 |
| CPU mỗi phòng | ≤ 1000 ms / 10 s |
| Nước đi (JSON) | ≤ 8 KB; `events` ≤ 16 KB |

## 5. `test/cases.json` (MUST)
```json
{"cases": [
  {"name": "khai cuộc", "players": 2, "steps": [], "result": null,
   "view": [{"seat": 0, "match": {"proto": 2, "phase": "play", "turn": 0, "air": 0}}, {"seat": -1, "match": {"you": -1}}]},
  {"name": "sai lượt + nước rác", "steps": [
     {"seat": 1, "move": {"type": "pump", "n": 1}, "error": "Chưa tới lượt"},
     {"seat": 0, "move": {"type": "pump", "n": 9}, "error": "không hợp lệ"},
     {"seat": 0, "move": {"type": "hack"}, "error": "không hợp lệ"},
     {"seat": 7, "move": {"type": "pump", "n": 1}, "error": "không ngồi"}]},
  {"name": "đầu hàng 2 người", "steps": [{"seat": 1, "move": {"type": "resign"}}], "result": {"winners": [0], "reason": "resign"}},
  {"name": "cả ván tới kết thúc", "options": {"size": 10}, "steps": [
     {"seat": 0, "move": {"type": "pump", "n": 3}}, {"seat": 1, "move": {"type": "pump", "n": 3}},
     {"seat": 0, "move": {"type": "pump", "n": 3}}, {"seat": 1, "move": {"type": "pump", "n": 1}}],
   "result": {"winners": [0], "reason": "no-bong"}}
]}
```
- `players` mặc định = `players.min`; `options` mặc định = `default` của manifest; đồng hồ bắt đầu từ 0; `{"tick": ms}` là 1 bước tick.
- `error` = CHUỖI CON của lỗi trả về; MUST NOT để `""`. Chữ lỗi SDK: `Chưa tới lượt bạn` · `Nước đi không hợp lệ` · `Bạn không ngồi ở bàn này` ·
  `Ván đã kết thúc` · `Chưa tới lúc làm việc này` · `Bạn đã rời ván rồi`.
- `view[].match` so KHỚP MỘT PHẦN. MUST có ca: khai cuộc, luật chính, ≥ 3 lỗi (sai lượt, nước rác, ghế lạ), đầu hàng; game có bí mật MUST có
  ca view ghế khác + người xem KHÔNG thấy bí mật (vd `"match": {"secret": null}`).
- SHOULD có 1 ca chơi tới kết thúc. Kết quả phụ thuộc giá trị ngẫu nhiên ẩn (số bí mật, bài chia…) thì MAY bỏ ca này — khi đó 200 ván
  ngẫu nhiên của bộ kiểm là bằng chứng kết thúc; ghi 1 dòng giải thích trong mô tả PR.
- Ngoài ca kiểm, bộ kiểm chơi 200 ván ngẫu nhiên (từ `legal`/`bot`), nước rác, đầu hàng, so tất định 2 lần, kiểm hợp đồng view/result.
  Ván ngẫu nhiên MUST kết thúc (không vòng lặp vô tận); 2 người đầu hàng MUST kết thúc ván.

## 6. Lệnh tự test — chạy ĐÚNG THỨ TỰ, từ GỐC repo, lặp tới khi tất cả ĐẠT
| # | Lệnh | ĐẠT khi in |
|---|---|---|
| 1 | `cd devkit && node jagame.js new <id> --name "<Tên>" --author "<Tác giả>"` | `Đã tạo …/devkit/games/<id>` |
| 2 | (viết game trong `devkit/games/<id>/`) `node jagame.js check <id>` | dòng cuối `KẾT QUẢ: ĐẠT — 0 lỗi` |
| 3 | (tùy chọn, có trình duyệt) `node jagame.js play <id>` → mở `http://127.0.0.1:7788/tools/play.html?game=<id>&bot=1` | chơi hết 1 ván, không lỗi console; Ctrl+C để dừng |
| 4 | `node jagame.js submit <id> && cd ..` | `Đã chép sang …/submissions/<id>` |
| 5 | `python3 devkit/check_submission.py submissions/<id>` | dòng `KẾT QUẢ: ĐẠT — 0 lỗi, N lưu ý`. MUST đọc từng dòng `LƯU Ý`: `innerHTML` là bình thường NẾU mọi chữ từ người chơi đã qua `JGUI.esc()` (kiểm lại từng dòng được nêu); thiếu `screenshots/` được phép |
| 6 | `git checkout -b gui-<id> && git add submissions/<id> && git commit -m "Gửi game <id> <version>"` | `git status` sạch ngoài `devkit/games/` |
| 7 | `python3 devkit/check_pr.py` (chạy y như workflow GitHub) | dòng cuối `PR ĐẠT — giống workflow GitHub` |
Mỗi lần sửa mã: sửa trong `devkit/games/<id>/` rồi chạy lại từ bước 2 (bước 4 chép đè), hoặc sửa thẳng `submissions/<id>/` rồi chạy lại từ bước 5
(`node jagame.js check ../submissions/<id>` cũng chạy được). MUST NOT mở PR khi còn bất kỳ dòng `TRƯỢT`.

## 7. Mã lỗi từ chối
Bộ kiểm in `TRƯỢT [E_…]` và dòng cuối `KẾT QUẢ: TRƯỢT — … · mã: E_…`. Sửa theo bảng:
<!-- ERROR_CODES -->
| Mã | Nguyên nhân | Cách sửa |
|---|---|---|
| `E_PATH_OUTSIDE` | PR đổi tệp nằm ngoài submissions/<id>/ (kể cả README.md gốc, devkit/, .github/, submissions/README.md) | git restore/revert mọi tệp ngoài submissions/<id>/; chỉ commit thư mục game |
| `E_MULTI_GAME` | PR đụng từ 2 thư mục submissions/<id>/ trở lên | mỗi PR đúng 1 game; tách thành nhiều nhánh/PR |
| `E_ID_INVALID` | tên thư mục / manifest.id không khớp ^[a-z][a-z0-9-]{1,31}$ | đổi id: chữ thường a-z, số, '-', bắt đầu bằng chữ, 2–32 ký tự |
| `E_ID_RESERVED` | id bắt đầu bằng tiền tố dành riêng (local-, jg-) | đổi id khác |
| `E_ID_TAKEN` | id trùng game chính thức hoặc game mẫu (danh sách reserved_ids) | đổi id khác, không có trong reserved_ids |
| `E_ID_MISMATCH` | manifest.id khác tên thư mục submissions/<id>/ | đặt manifest.id = tên thư mục |
| `E_DOTFILE` | có tệp/thư mục bắt đầu bằng '.' (.DS_Store, .env, .git…) | xóa; không commit tệp chấm |
| `E_SYMLINK` | có symlink hoặc submodule | thay bằng tệp thật |
| `E_FILE_NAME` | tên/đường dẫn tệp sai (ký tự ngoài A-Z a-z 0-9 . _ - @ +, '..', mục gốc không cho phép như assets/, node_modules/) | đổi tên; chỉ dùng các mục gốc trong allowed_top; tài sản để ở client/assets/ |
| `E_FILE_TYPE` | đuôi tệp không cho phép (ROM .nes .sfc .gb…, .zip, .exe, .ts, .html…), hoặc server/ chứa tệp không phải .js/.json | chỉ dùng đuôi trong allowed_ext |
| `E_FAKE_BINARY` | nội dung không khớp đuôi (png giả, ROM đổi đuôi) hoặc tệp chữ không phải UTF-8 | dùng tệp đúng định dạng; tệp chữ lưu UTF-8 |
| `E_SIZE` | vượt giới hạn cỡ / số tệp (limits) | nén ảnh, bỏ tệp thừa |
| `E_ZIP` | gói zip hỏng (chỉ đường gửi zip) | đóng gói lại bằng node jagame.js pack |
| `E_README_MISSING` | thiếu README.md | thêm README.md: mô tả, luật chơi, tác giả, giấy phép mã + nguồn/giấy phép tài sản |
| `E_LICENSE_MISSING` | thiếu LICENSE / LICENSE.md / LICENSE.txt | thêm LICENSE (vd MIT) khớp manifest.license |
| `E_MANIFEST_MISSING` | không có manifest.json ở gốc thư mục game | tạo manifest.json |
| `E_MANIFEST_JSON` | manifest.json không phải JSON object hợp lệ | sửa cú pháp JSON (không chú thích, không dấu phẩy thừa) |
| `E_MANIFEST` | manifest sai luật: thiếu "manifest": 2, thiếu author/license, giá trị sai | sửa theo bảng manifest trong AI-RULES.md |
| `E_MANIFEST_SCHEMA` | manifest sai JSON Schema v2 (trường lạ, sai kiểu, sai giới hạn), icon/ảnh chụp không hợp lệ | sửa theo devkit/shared/sdk/manifest.schema.json |
| `E_FILES_MISSING` | thiếu tệp manifest trỏ tới (icon, entry.client, entry.server, entry.style) hoặc test/cases.json | tạo tệp hoặc sửa đường dẫn trong manifest |
| `E_FORBIDDEN_API` | server/ dùng API cấm (require, import, process, Date, Promise, eval, Function, Proxy, Reflect, TypedArray, BigInt, WebAssembly, setTimeout, chữ async/await…) | bỏ API đó; dùng ctx.now, ctx.rng(), tick(); xóa chữ async/await kể cả trong chú thích |
| `E_FORBIDDEN_API_CLIENT` | client/ dùng API cấm (fetch, XMLHttpRequest, WebSocket, localStorage, postMessage, parent/top, cookie, Worker, iframe, eval…) | bỏ API đó; lưu trữ dùng JG.storage; không gọi mạng |
| `E_EXTERNAL_URL` | có địa chỉ http(s):// ngoài (trừ README.md, test/) | xóa liên kết / tài nguyên ngoài; tự chứa mọi tài sản |
| `E_MINIFIED` | mã nén/làm rối (dòng > 1000 ký tự) | gửi mã nguồn đọc được |
| `E_SVG` | SVG có <script>, on*=, <foreignObject>, href/url() ngoài, <!ENTITY> | vẽ lại SVG thuần hình |
| `E_PACKAGE` | đóng gói .jgame thất bại (luật máy hội quán) | đọc chi tiết; thường là tên tệp / cấu trúc |
| `E_ISOLATION` | vượt giới hạn khu cách ly (server/game.js sau gộp SDK > 256 KB, mode action) | thu gọn mã; không dùng mode action |
| `E_RULES_TEST` | bộ chạy luật chơi trượt: ca kiểm sai, ván ngẫu nhiên lỗi/không tất định, view/result sai hợp đồng v2, lý do kết thúc lạ, lần gọi > 250 ms | chạy node devkit/jagame.js check <id> rồi sửa từng dòng TRƯỢT |
| `E_TIMEOUT` | bộ chạy luật chơi quá thời gian (vòng lặp vô hạn / quá chậm) | sửa vòng lặp, giới hạn bot |
| `E_RECEIPT` | jagame-submit.json không khớp mã (gói zip bị sửa sau khi đóng) | đóng gói lại |
| `E_SYSTEM` | lỗi công cụ kiểm (không phải lỗi bài gửi) | chạy lại; báo chủ kho nếu lặp lại |
<!-- /ERROR_CODES -->

## 8. Checklist cuối + mẫu PR
- [ ] `git diff --name-only <nhánh gốc>...HEAD` chỉ có `submissions/<id>/…`
- [ ] Bước 2, 5, 7 mục 6 đều ĐẠT; đã đọc mọi dòng `LƯU Ý`
- [ ] `manifest.name/desc/howto`, `README.md`, icon, giao diện đều là của game MỚI (không còn chữ "Oẳn tù tì"/"oantuti")
- [ ] `README.md` có: mô tả, luật chơi, tác giả, giấy phép mã, nguồn + giấy phép tài sản (hoặc "tự vẽ bằng SVG/CSS")
- [ ] Không nhân vật / tên / hình / nhạc có bản quyền; không ROM; không tiền thật; nội dung hợp gia đình 8+ tuổi
- [ ] `view` không lộ bí mật; mọi tên người chơi qua `JGUI.esc` (đã soát từng dòng `innerHTML` mà bộ kiểm nêu)
- [ ] Không push lên `main`; PR mở từ nhánh `gui-<id>` của bản fork

**Tiêu đề PR:** `Gửi game <id> <version>` (vd `Gửi game bongbay 0.1.0`)
**Mô tả PR** (điền mẫu `.github/pull_request_template.md`):
```
## Game
- id: `<id>` · phiên bản: `<version>` · tên: <Tên>
- Mô tả ngắn / luật chơi: <1–3 câu>
- Số người: <min>–<max> · Bản mới
## Tự kiểm
- [x] PR chỉ đụng submissions/<id>/
- [x] python3 devkit/check_submission.py submissions/<id> → KẾT QUẢ: ĐẠT
- [x] python3 devkit/check_pr.py → PR ĐẠT — giống workflow GitHub
- [x] view không lộ bí mật · README.md + LICENSE · không tài sản có bản quyền · hợp gia đình
- Viết bởi AI agent: <tên công cụ> (người gửi chịu trách nhiệm nội dung)
```
