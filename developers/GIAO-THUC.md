# Chuẩn giao tiếp game Jagame (bản dành cho người viết game)

> Giao thức game **v2**, chạy trên runtime **API 1**. Bản rút gọn này đủ để viết, tự kiểm và gửi một game; mọi chi tiết vận hành
> máy chủ được giữ kín và người viết game không cần biết. Đường dẫn tính **từ thư mục game** (`<game>/…`) hoặc **từ gốc devkit**
> (`devkit/…`).

## Mục lục
1. [Mô hình: khung lo gì, game lo gì](#1-mô-hình)
2. [Gói game = 1 thư mục tự chứa](#2-gói-game)
3. [Manifest v2](#3-manifest-v2)
4. [Luật chơi (server): GameDef, ctx, nước đi, view, kết quả](#4-luật-chơi-server)
5. [Các chế độ chơi (`mode`)](#5-các-chế-độ-chơi)
6. [Lý do kết thúc (`reasons`)](#6-lý-do-kết-thúc)
7. [Mã lỗi chuẩn](#7-mã-lỗi-chuẩn)
8. [Quy ước: ẩn thông tin, đậu ảo, thời gian, sự kiện, nhiều người, máy chơi](#8-quy-ước)
9. [SDK `JGCore` (server)](#9-sdk-jgcore-server)
10. [Client: `JG.defineGame`, đối tượng `game`, `JGUI`](#10-client)
11. [Toàn màn hình, menu, điều khiển cảm ứng](#11-toàn-màn-hình-menu-điều-khiển-cảm-ứng)
12. [Âm thanh, rung, lưu trữ](#12-âm-thanh-rung-lưu-trữ)
13. [Khu cách ly: giới hạn bắt buộc với game cộng đồng](#13-khu-cách-ly)
14. [Ca kiểm `test/cases.json`](#14-ca-kiểm)

---

## 1. Mô hình
Game gồm 2 nửa:
- **Luật chơi** `server/game.js` — hàm thuần trên state JSON: `setup → (move | tick)* → result`. `view(state, ghế)` cắt ra phần mỗi
  người được thấy. Chạy ở máy chủ của hội quán, trong khu cách ly.
- **Giao diện** `client/index.js` (+ `style.css`) — chạy trong trình duyệt, nhận `view`, gửi nước đi bằng `game.send(move)`.

```
Trình duyệt (client)          Khung phòng chơi                Luật chơi (server/game.js)
      │  game.send(move)  ──►   │  move(state, ctx)  ───────►   │  trả {state} hoặc {state, error}
      │                         │  tick(state, ctx)  (nếu có)   │
      │  ◄── game:view (riêng)  │  view(state, ghế) mỗi người   │
      │  ◄── game:result        │  result(state)                │
```

| Khung lo (bạn KHÔNG làm) | Game lo (bạn làm) |
|---|---|
| Sảnh, phòng, ghế, người xem, mời bạn, chat, biểu cảm | Trạng thái ban đầu, nước hợp lệ, chuyển lượt, kết thúc |
| Mạng, nối lại; mất kết nối quá 60 giây thì xử thua `disconnect` | `view`: ẩn thông tin riêng của từng ghế |
| Đồng hồ cờ (`clock`), xin đi lại (`undo`), gợi ý (`hint`), hướng dẫn lần đầu (`tutorial`) | (tùy chọn) `bot`, `legal`, `hint`, `undo` riêng |
| Máy chơi thay, màn kết thúc (thắng/thua/hòa, xếp hạng, Ván mới), nút Đầu hàng | Trả `result.reason` đúng chuẩn |
| Âm thanh hệ thống, rung, 20 giao diện màu, an toàn | Giao diện bàn chơi trong `game.root`, chỉ dùng biến CSS |

Ghế trong luật chơi luôn là **0..n-1 liên tục** theo số người ngồi lúc ván bắt đầu. Ghế `-1` = người xem.

## 2. Gói game
```
<id>/
  manifest.json            bắt buộc (mục 3)
  icon.svg | icon.png      bắt buộc: SVG vuông (viewBox w = h) hoặc PNG vuông 256–1024 px; ≤ 200 KB
  server/game.js           bắt buộc: luật chơi (mục 4). server/ chỉ chứa .js/.json
  client/index.js          bắt buộc: giao diện (mục 10)
  client/style.css         tùy chọn (khai ở entry.style)
  client/assets/*          tùy chọn: hình, âm, phông tự làm (svg png jpg webp gif mp3 ogg m4a woff2)
  screenshots/*.png|jpg|webp   tùy chọn: ≤ 6 ảnh, mỗi ảnh ≤ 400 KB, cạnh 320–2400 px (dọc ~3:4)
  test/cases.json          bắt buộc khi gửi (không vào gói phát hành)
  README.md, LICENSE       bắt buộc khi gửi (xem GUI-GAME.md)
```
**Giới hạn:** gói nén ≤ 10 MB khi gửi · giải nén ≤ 30 MB · ≤ 300 tệp · đuôi chỉ `json js css svg png jpg jpeg webp gif mp3 ogg m4a woff2 txt md`
· tên tệp chỉ `A-Z a-z 0-9 . _ - @ +` · không tệp/thư mục bắt đầu bằng `.` · không symlink · không `..`.
**Icon SVG:** XML hợp lệ, gốc `<svg>` có `viewBox` vuông; **cấm** `<script>`, thuộc tính `on*=`, `<foreignObject>`, `href`/`url()` ra
ngoài (chỉ `#id` nội bộ), `<!ENTITY>`.

## 3. Manifest v2
Nguồn sự thật máy đọc được: **`devkit/shared/sdk/manifest.schema.json`** (JSON Schema). Bài gửi phải có `"manifest": 2` (kiểm chặt:
trường lạ hoặc sai kiểu = trượt).

| Trường | Bắt buộc | Giá trị | Nghĩa |
|---|---|---|---|
| `manifest` | ✔ | `2` | định dạng manifest |
| `id` | ✔ | `^[a-z][a-z0-9-]{1,31}$` | mã duy nhất, = tên thư mục, không bao giờ đổi; không bắt đầu `local-`/`jg-`; không trùng game chính thức |
| `name` | ✔ | 1–40 ký tự | tên hiển thị |
| `version` | ✔ | `X.Y.Z` | bản mới phải lớn hơn bản trước |
| `api` | ✔ | `1` | |
| `sdk` | khuyên | `"2"` | công cụ tự gộp SDK vào gói (mục 9) |
| `app_min` | ✔ | semver | phiên bản Jagame tối thiểu (để `"0.1.0"` nếu không chắc) |
| `group` | ✔ | `co` · `dangian` · `vui` · `bai` | cờ · dân gian · vui cả nhà · bài lá |
| `color` | | `#rrggbb` | màu bìa thẻ |
| `players` | ✔ | `{min, max}`, 1 ≤ min ≤ max ≤ 50 | số người |
| `spectators` | | bool | cho người xem |
| `desc` | ✔ | 1–160 ký tự | mô tả 1 câu |
| `tags` | | ≤ 8 chuỗi ≤ 24 | nhãn tìm kiếm |
| `age` | ✔ | 3–18 | tuổi tối thiểu |
| `content` | | mảng nhãn | `dau-ao` đậu ảo · `so-hai` yếu tố đáng sợ · `chu-nguoi-choi` người chơi gõ chữ cho nhau · `ve-tu-do` vẽ tự do · `an-vai` nhập vai lừa gạt · `tinh-gio` áp lực thời gian |
| `languages` | | `["vi"]` | |
| `icon` | ✔ | `icon.svg` · `icon.png` | |
| `screenshots` | | ≤ 6 đường dẫn `screenshots/…` | |
| `homepage` | | `https://…` | trang của tác giả |
| `author`, `license` | ✔ khi gửi | chuỗi | tác giả, giấy phép (mã SPDX, vd `MIT`) |
| `howto` | | ≤ 10 dòng ≤ 400 ký tự | cách chơi ngắn |
| `news` | | ≤ 240 ký tự | "Có gì mới" |
| `changelog` | ✔ | chuỗi | nhật ký kỹ thuật bản này |
| `entry` | ✔ | `{client, server, style?}` | `client/….js`, `server/….js`, `client/….css` |
| `mode` | khuyên | mục 5 | nhịp chơi |
| `tick_ms` | khi `realtime` | 250–60000 (khu cách ly) | nhịp gọi `tick()` |
| `session` | | `{minutes:[ít, nhiều]}` | độ dài 1 ván |
| `needs` | | `{sound, vibrate, storage, user_text}` bool | nhu cầu trình duyệt, chợ hiện cho chủ nhà |
| `bot`, `bot_simultaneous` | | bool | máy chơi thay (mục 8.7) |
| `clock` | | `true` · mảng `"phút+giây"` | đồng hồ cờ do khung giữ (chỉ game `turn`, không dùng cùng `tick_ms`) |
| `undo`, `undo_max` | | bool, 1–20 | xin đi lại do khung lo |
| `hint`, `hint_max` | | bool, 1–20 | gợi ý 💡 do khung vẽ |
| `tutorial` | | 1–8 bước: chữ hoặc `{text, at?, title?}` | hướng dẫn lần đầu |
| `ui` | | `{players:"game"\|"frame", events:bool, end:"game"\|"frame", fullscreen?:bool, end_banner?:bool}` | game tự vẽ chip ghế / dùng events / tự vẽ màn kết thúc / toàn màn hình |
| `room` | | `{dropin?, persist?}` | vào/ra giữa ván (mục 8.8) |
| `resume` | | bool (mặc định true) | `false` = không khôi phục ván khi máy chủ khởi động lại |
| `options` | | ≤ 10 `{key, label ≤ 60, choices[1–20], default ∈ choices}` | tùy chọn ván, chủ phòng chọn |
| `reasons` | | `{mã: {text, by}}` | lý do kết thúc riêng (mục 6) |

## 4. Luật chơi (server)

### 4.1 Luật môi trường (máy từ chối nạp nếu vi phạm)
- CommonJS thuần, chạy trong khu cách ly: **không** `require`, `import`, `process`, `fs`, `fetch`, timer (`setTimeout`…), `Date`, `Promise`,
  `eval`/`new Function`, `Proxy`, `Reflect`, TypedArray/`ArrayBuffer`, `BigInt`, `WebAssembly`.
- **Chữ `async` hoặc `await` ở BẤT KỲ đâu trong file (kể cả chú thích, chuỗi) → cả gói bị từ chối.**
- Ngẫu nhiên chỉ qua **`ctx.rng()`** (số thực [0,1) tất định theo ván). Thời gian chỉ qua **`ctx.now`** (ms máy chủ, chỉ dùng để so hiệu).
- State đi qua JSON mỗi lần gọi: chỉ object/mảng/số/chuỗi/bool/null (không Map, Set, hàm, `undefined`, `NaN`).
- **Tất định:** cùng state + cùng ctx (cùng seed rng) → cùng kết quả.
- Không giữ gì trong biến toàn cục giữa các lần gọi — biến toàn cục có thể mất bất cứ lúc nào.
- Từ chối nước đi thì không được sửa state đầu vào (SDK lo việc này).
- Giới hạn thời gian/cỡ: mục 13.

### 4.2 API runtime (máy gọi đúng các hàm này — SDK tạo giúp)
```ts
setup(ctx: {players: {id, name, bot?}[], options, rng(), now}): State
move(state, ctx: {player, move, rng(), now}): {state, error?, code?, events?}
view(state, seat): View                       // seat -1 = người xem
result(state): Result | null
tick?(state, {now, rng()}): {state}           // cần manifest tick_ms
legal?(state, seat): Move[]                   // khuyên có: bộ kiểm + máy chơi dùng
bot?(state, seat, {options, rng(), now}): Move | null      // manifest bot: true; chỉ ĐỌC state
hint?(state, seat, ctx): Move | {move, cells?, text?} | null
undo?(state, {player, now, rng()}): {state, error?}
join?(state, {seat, id, name, now}) / leave?(state, {seat, now})   // chỉ khi room.dropin
// Move = {type: string, ...} — JSON ≤ 8 KB; {type:'resign'} luôn phải xử lý (SDK làm sẵn)
```

### 4.3 GameDef — cái bạn viết (với `"sdk": "2"`)
```js
module.exports = JGCore.game({
  kind: 'turn',                 // 'turn' | 'simultaneous' | 'realtime'
  minAlive: 2,                  // còn < minAlive người thì ván kết thúc khi có người rời
  resign: 'leave',              // 'end': 1 người đầu hàng là hết ván; 'leave' (mặc định): ván ≥ 3 người chạy tiếp
  setup: function (s, ctx) {},  // s đã có phong bì s.jg — gắn trường của game vào s
  moves: {                      // mỗi loại nước 1 mục
    place: {
      args: { x: 'int', y: 'int' },  // kiểm kiểu trước khi chạy (mục 9)
      phase: 'play',                 // chỉ hợp lệ trong pha này
      turn: true,                    // chỉ ghế đang tới lượt
      run: function (s, ctx, mv) {   // sửa thẳng s; trả chuỗi / {error, code} để từ chối
      }
    }
  },
  view: function (s, you, v) {},     // gắn trường RIÊNG của game; trường chuẩn SDK tự điền
  tick: function (s, ctx) {},
  onResign: function (s, seat, ctx, resignDefault) {},
  legal: function (s, seat) {}, bot: function (s, seat, ctx) {}, hint: function (s, seat, ctx) {}, undo: function (s, ctx) {},
  turn: function (s, you) {}, phase: function (s) {}, timer: function (s) {}, scores: function (s) {}, logView: function (s, you) {}
});
```
**Phong bì `s.jg`** (SDK tạo): `{n, names[], bots[], out[] (đã rời), done[] (xong phần mình), finish[] (thứ tự về đích), end (Result|null),
now, turn, phase, deadline, log?}`. Đọc/ghi bằng hàm SDK.
**SDK làm sẵn cho mọi nước:** ván xong → `ended`; ghế sai → `seat`; nước không phải `{type: string}` → `bad-move`; ghế đã rời → `you-done`;
`{type:'resign'}` → `onResign` / mặc định; loại nước lạ, `args` sai → `bad-move`; sai `phase` → `wrong-phase`; sai lượt → `not-your-turn`;
chép sâu state rồi gọi `run`, bị từ chối thì trả lại state CŨ.

### 4.4 View chuẩn
SDK tự thêm (game đã đặt trùng tên thì giữ của game):

| Trường | Nghĩa |
|---|---|
| `proto` | `2` |
| `phase` | pha hiện tại (`play`, `bet`, `pick`…; hết ván `ended`) |
| `turn` | ghế đang phải hành động, hoặc `null` (cùng lúc / hết ván) |
| `you` | ghế người nhận, `-1` = người xem |
| `youDone` | người nhận đã rời / xong phần mình (khung ẩn nút Đầu hàng) |
| `resignNote` | (tùy chọn, ≤ 140) câu phụ trong hộp xác nhận Đầu hàng |
| `seats` | `[{name, out, done, bot}]` đủ n phần tử |
| `timer` | `null` hoặc `{left, total, seat?, paused?}` — ms còn lại, **tương đối** |
| `scores` | `null` hoặc `number[n]` — điểm/đậu, dùng cho bảng xếp hạng cuối ván |
| `finishOrder` | thứ tự về đích |
| `result` | `null` hoặc Result |
| `log` | (tùy chọn) ≤ 30 dòng nhật ký cuối, đã lọc bí mật |

### 4.5 Result
```ts
{ winners: number[], reason: string, draw?: true, ranks?: (number|null)[] }   // ranks[ghế] = hạng, 1 = nhất
```

## 5. Các chế độ chơi
| `mode` | Nghĩa | Yêu cầu |
|---|---|---|
| `turn` | Theo lượt: 1 ghế hành động, `view.turn` = ghế đó | khung tô lượt, đồng hồ cờ chạy theo `turn` |
| `simultaneous` | Nhiều người hành động cùng lúc (đặt cược, chọn bí mật, trả lời) | `view.turn = null`; có máy chơi thì `bot_simultaneous: true` |
| `realtime` | Máy tiến theo nhịp (kêu số, đếm giờ) | `tick_ms` + hàm `tick()` |
| `events` | Luồng nước nhỏ liên tục (nét vẽ) phát cho cả phòng | `ui.events: true`, `move()` đẩy `ctx.events` |

Kết hợp được (vd `["simultaneous", "realtime"]`), trừ `turn` + `simultaneous`. Game hành động thời gian thực (`action`) **chỉ dành cho
game chính thức** — bài gửi cộng đồng không dùng được.

**Lớp mẫu theo thể loại** (cấu hình GameDef + hàm SDK):

| Mẫu | Khai | Game mẫu |
|---|---|---|
| Theo lượt | `kind:'turn'`, `moves.x.turn = true`, `s.jg.turn` | `games/nhatque`, `games/xucxac` |
| Cùng lúc | `kind:'simultaneous'`, `bot_simultaneous` | `games/oantuti` |
| Theo nhịp | `kind:'realtime'`, `tick` + `tick_ms`, `JGCore.setDeadline/expired` | `games/oantuti` (đồng hồ hiệp) |
| Ẩn thông tin | `view` che theo `you`, `Cards.mask`, `logView` | bài lá, vai ẩn |
| Lưới | `Grid.make/inside/run`, `args:{x:'int',y:'int'}` | caro, cờ |
| Bài lá | `Cards.deck/shuffle/deal/mask` | |
| Đậu ảo | `Beans.pay/leaders/broke`, `scores: s => s.beans`, `content:["dau-ao"]` | |

## 6. Lý do kết thúc
Danh sách chuẩn: **`devkit/shared/sdk/reasons.json`** (mã → `{text, by}`).
- `by: "winner"` — việc người thắng làm nên (`five`, `win`), `by: "loser"` — người thua gây ra (`resign`, `het-gio`), `by: "none"` — hòa.
- Khung tự gán: `resign`, `disconnect`, `leave`, `het-gio` (hết giờ cờ: khung gửi `{type:'resign'}` thay ghế đó).
- Chung, nên dùng: `win` · `score` · `finish` · `het-nguoi` · `het-van` · `sach-dau` · `het-luot` / `draw`.
- Lý do mới: khai trong manifest `"reasons": {"que-cuoi": {"text": "phải nhặt que cuối cùng", "by": "loser"}}`; mã theo
  `^[a-z][a-z0-9-]{1,23}$`, không khai lại mã chuẩn. Trả lý do không có trong danh sách = trượt kiểm.

## 7. Mã lỗi chuẩn
Nước bị từ chối trả `{state: <cũ>, error: "<chữ tiếng Việt cho người chơi>", code?}`. Chữ lỗi ngắn, nói cách sửa, không dấu chấm cuối,
không lộ bí mật.

| `code` | Chữ mặc định | Khi nào |
|---|---|---|
| `ended` | Ván đã kết thúc | đi sau khi có kết quả |
| `seat` | Bạn không ngồi ở bàn này | ghế ngoài 0..n-1 |
| `bad-move` | Nước đi không hợp lệ | sai dạng / loại lạ / `args` sai |
| `not-your-turn` | Chưa tới lượt bạn | |
| `wrong-phase` | Chưa tới lúc làm việc này | |
| `you-done` | Bạn đã rời ván rồi | |
| `rule` | (chữ của game) | vi phạm luật — mặc định khi `run` trả chuỗi |
| `forbidden` · `limit` · `timeout` | | không có quyền · hết lượt dùng · tới sau hạn |

## 8. Quy ước

### 8.1 Ẩn thông tin
`view(state, seat)` chỉ chứa điều ghế đó được biết: bài người khác thay bằng `-1` cùng số lá (`Cards.mask`), quân úp, vai trò, lựa chọn bí
mật (chỉ gửi "đã chọn" dạng bool), bộ bài còn lại, seed. Người xem (`-1`) không thấy bí mật của ai. `events` tới CẢ phòng — không chứa bí mật.

### 8.2 Đậu ảo
Chỉ "đậu" cho vui, **không bao giờ** tiền thật, không quy đổi, mua bán, nạp. Khai `content:["dau-ao"]`, mô tả ghi "(đậu ảo, không tiền
thật)". Mỗi ván bắt đầu lại. Hết đậu = `done`, kết thúc `sach-dau` / `het-van`.

### 8.3 Thời gian
- Mốc trong state theo `ctx.now`. `JGCore.setDeadline(s, ms, seat?)` rồi kiểm `JGCore.expired(s)` trong `tick`/`move`.
- View gửi **tương đối** `timer:{left, total}`; client đếm lùi bằng `JGUI.timer`. Không gửi mốc tuyệt đối để client so `Date.now()`.
- Game theo lượt không tự giữ giờ — khai `clock` để khung làm.

### 8.4 Sự kiện `events`
Chỉ khi `ui.events: true`: trong `run`, `ctx.events.push({t:'stroke', …})` → khung phát cho cả phòng THAY vì gửi lại view (≤ 16 KB/nước,
không bí mật). Client: `game.on('event', fn(ev))`, `ev.seat` = ghế gửi. Khi có kết quả, đổi lượt, đổi pha → khung vẫn gửi view đầy đủ.

### 8.5 Nhiều người + xếp hạng
≥ 3 người: người "xong phần mình" có `youDone: true`; ván chạy tới khi còn < `minAlive`. Về đích: `s.jg.finish.push(ghế)`. Kết thúc theo điểm:
`JGCore.endByScore(s, scores, 'score', {lowWins?, drawOnTie?})`.

### 8.6 Đầu hàng
`{type:'resign'}` luôn hợp lệ với ghế còn trong ván. 2 người → người kia thắng `resign`. ≥ 3 người → người đó ra khỏi ván, ván chạy tiếp.

### 8.7 Máy chơi
`bot(s, seat, ctx)` chỉ ĐỌC, tất định qua `ctx.rng`, trả đúng dạng nước của `move` (sai/null/lỗi → máy đầu hàng). Theo lượt: khung gọi khi
tới ghế máy. Cùng lúc: `bot_simultaneous: true`, khung hỏi mọi ghế máy, `null` = chưa có việc. Độ khó: option `bot_level`.
**Bot phải nhanh:** trong khu cách ly hạn 250 ms/lần và máy chậm hơn 4–30 lần so với Node thường → tự giới hạn độ sâu tìm kiếm, mục tiêu
≤ 100 ms.

### 8.8 Đi lại · gợi ý · hướng dẫn · đồng hồ cờ · vào giữa ván
Do khung xử lý; game chỉ khai manifest (`undo`, `hint`, `tutorial`, `clock`) và khi cần viết `undo(s, ctx)` / `hint(s, seat, ctx)`.
`room.dropin`: ván giữ đủ `players.max` ghế, ghế trống `{id: null, vacant: true}`; khung gọi `join`/`leave` thay vì xử thua.

## 9. SDK `JGCore` (server)
Tệp `devkit/shared/sdk/server/jg-core.js`, biến toàn cục `JGCore` (với `"sdk": "2"` công cụ tự gộp lên đầu `server/game.js` — game KHÔNG
`require`). Mọi hàm thuần.

| Nhóm | Hàm |
|---|---|
| Khung | `game(def)` · `VERSION` |
| Dữ liệu | `isInt(v)` · `isObj(v)` · `clone(x)` · `fill(n, v\|fn)` · `range(n)` · `sum(a)` |
| Ngẫu nhiên (truyền `ctx.rng`) | `int(rng, n)` · `pick(rng, arr)` · `shuffle(rng, arr)` |
| Lỗi | `ERR` · `err(code, text?)` |
| Kiểm nước | `checkArg(v, spec)` · `checkArgs(mv, args)`; spec: `'int' 'num' 'str' 'bool' 'ints' 'cards'` · `[giá trị…]` · `{int:[min,max]}` · `{str:maxLen}` · `{arr:spec, max}` · `{opt:spec}` |
| Ghế | `Seats.next(from, n, ok?, dir?)` · `Seats.list(n, ok?)` · `Seats.alive(s)` · `Seats.playing(s)` |
| Bài | `Cards.RANKS/SUITS` · `Cards.deck({ranks, suits, copies})` · `Cards.rank(c)` · `Cards.suit(c)` · `Cards.deal(deck, seats, k)` · `Cards.mask(hand)` |
| Đậu ảo | `Beans.pay(beans, from, to, amt, allowNegative?)` · `Beans.broke(beans, i, min?)` · `Beans.leaders(beans, seats)` |
| Lưới | `Grid.make(w, h, v)` · `Grid.inside(w, h, x, y)` · `Grid.run(g, x, y, dx, dy)` · `Grid.DIRS4/DIRS8` |
| Kết thúc | `end(s, {winners, reason, draw?, ranks?, scores?})` · `endByScore(s, scores, reason, opts)` · `ranksByScore(scores, seats, lowWins)` |
| Thời gian | `setDeadline(s, ms, seat?)` · `clearDeadline(s)` · `expired(s)` |
| Nhật ký | `log(s, {t, …})` (≤ 30 dòng, `view.log`) |
| Lý do | `REASONS` · `REASON_RE` |

Số dòng lỗi trong `game.js` = dòng báo − số dòng SDK (bộ kiểm in con số này).

## 10. Client

### 10.1 `JG.defineGame`
```js
JG.defineGame(function mount(game) {
  // game.root     <div> riêng cho bàn chơi (dùng lại giữa các ván — gắn sự kiện vào phần tử CON)
  // game.me {id, name} · game.seat (0..n-1 | -1 người xem) · game.players [{id, name, seat}] · game.options · game.view
  // game.send(move) · game.on('view'|'result'|'error'|'event'|'hint'|'chat', fn)
  // game.toast(text) · game.sound(name) · game.soundNames · game.highlight(sel|phần tử, {ms, label}) · game.openChat() · game.menu()
  return { destroy: function () {} };   // dọn hẹn giờ khi rời phòng / ván mới
});
```
- Script thường (không module, không `import`), chỉ vẽ trong `game.root`.
- Hiện nước đi **ngay** (lạc quan) rồi vẽ lại khi `view`/`error` tới.
- Giao diện chạy trong khung `iframe` cách ly: **không** mạng (`fetch`, `XMLHttpRequest`, `WebSocket`…), không `parent`/`top`/`postMessage`,
  không `alert/confirm/prompt`, không `window.open`, không cookie/`indexedDB`, không Worker, không `eval`. Chiều cao khung tự theo nội dung;
  `100vh` là theo khung, không theo màn hình.

### 10.2 `JGUI` (có sẵn khi `"sdk": "2"`)
| Hàm | Việc |
|---|---|
| `JGUI.esc(s)` | **BẮT BUỘC** cho mọi chữ người chơi (tên…) trước khi vào `innerHTML` |
| `JGUI.q(root, sel)` | `querySelector` trong root |
| `JGUI.still()` | người dùng bật giảm chuyển động |
| `JGUI.nameOf(game, seat)` · `JGUI.turnText(game, view)` | tên ghế · câu "Tới lượt …" |
| `JGUI.sound(game, name)` | phát âm (tên lạ: im lặng) |
| `JGUI.chips(game, view)` | HTML hàng chip ghế từ `seats/turn/scores` |
| `JGUI.timer(el, view.timer)` | đếm lùi, trả hàm dừng |
| `JGUI.bar(root, [{label, onClick, primary?, disabled?, key?}])` | thanh nút `.jg-dock` dính đáy |
| `JGUI.banner(root, text, ms?)` | banner sự kiện |
| `JGUI.pad(root, opts)` | điều khiển cảm ứng (mục 11) |

Chuẩn hình ảnh: xem **GIAO-DIEN.md**.

## 11. Toàn màn hình, menu, điều khiển cảm ứng
- `ui.fullscreen: true`: khi đang chơi, khung phủ trọn màn trên điện thoại và hiện nút ⋯ mở menu trận (Trò chuyện · Âm thanh · Toàn màn
  hình · Rời phòng). Game có nút menu riêng thì gắn thuộc tính **`data-jg-menu`** vào nút đó, hoặc gọi **`game.menu()`**. Khung bắn `resize`
  sau khi đổi chế độ — đo bàn theo `innerWidth/innerHeight`.
- Biến CSS `--jg-stage-h` (khi xoay ngang): chiều cao dùng được cho game; đọc `var(--jg-stage-h, <giá trị cũ>)`.
- **`JGUI.pad(game.root, opts)`** — bộ nút ảo chuẩn (cần analog/D-pad + tối đa 6 nút + bàn phím + tay cầm):
```js
var pad = JGUI.pad(game.root, {
  stick: 'analog',                       // 'analog' | 'dpad4' | 'dpad8' | null
  buttons: [{ id: 'a', label: 'Bắn', hold: true, big: true }, { id: 'b', label: 'Nhảy' }],
  small: ['start', 'menu'], key: 'tengame', onChange: function (s) {}
});
pad.state   // {x, y ∈ [-1,1], mag, dir (-1 | 0..7, 0 = Bắc), up, down, left, right, a, b, …}
pad.took('b')   // true đúng 1 lần mỗi lần bấm mới;  pad.show() / hide() / destroy()
```
  Bàn phím mặc định: WASD/mũi tên = cần; nút 1 = Space/J/Z, 2 = K/X, 3 = L/C; Enter = start, Esc = menu. Người chơi chỉnh cỡ/độ mờ/đổi
  tay/vị trí bằng nút ⚙.

## 12. Âm thanh, rung, lưu trữ
- Âm: `game.sound(name)` với tên trong `game.soundNames`: `move move-other turn win lose draw error tick join leave chat send start capture
  check dice deal chip`. Tên lạ thì im lặng. Khung tự phát `start`, `turn`, `win/lose/draw`. Gọi `move` NGAY khi người chơi bấm.
- Rung: `navigator.vibrate(ms)` hoặc `JG.haptic('tap'|'ok'|'warn')` (đi qua khung).
- Lưu cục bộ: `localStorage`/`sessionStorage` trong khung là **kho giả** cùng API (tổng ≤ 64 KB, theo từng game), hoặc
  `JG.storage.get/set`. Chỉ lưu cài đặt nhỏ (âm lượng, tùy chọn hiển thị). Bộ kiểm tĩnh cảnh báo `localStorage` — dùng `JG.storage`.

## 13. Khu cách ly
Mọi game cộng đồng chạy trong khu cách ly. Vượt giới hạn = bị chặn khi kiểm hoặc trò bị tạm tắt trên hội quán.

| Giới hạn | Giá trị |
|---|---|
| Thời gian mỗi lần gọi | **150 ms** (`bot`/`hint` 250 ms); mục tiêu < 10 ms |
| `server/game.js` sau khi gộp SDK | ≤ **256 KB** |
| State / view trả ra (JSON) | ≤ **256 KB** |
| Bộ nhớ | 64 MB mỗi game |
| `tick_ms` | ≥ **250** (nhỏ hơn thì tự nâng lên 250) |
| CPU mỗi phòng | ≤ 1.000 ms / 10 giây; vượt → ván kết thúc hòa `game-error` |
| Lỗi lặp lại | ≥ 20 lần quá giờ / hết bộ nhớ trong 1 giờ → trò tạm tắt, chủ nhà được báo |
| Không có | `Date`, `Promise`, `Proxy`, `Reflect`, TypedArray, `ArrayBuffer`, `BigInt`, `WebAssembly`, `eval`, `Function()`, `require`, `process`, timer |
| Giao diện | iframe cách ly, không mạng (mục 10.1) |

## 14. Ca kiểm
`test/cases.json`:
```json
{"cases": [{"name": "…", "players": 2, "options": {}, "steps": [
   {"seat": 0, "move": {"type": "take", "n": 1}},
   {"seat": 1, "move": {"type": "take", "n": 9}, "error": "chuỗi con của lỗi"},
   {"tick": 3000}],
  "result": {"winners": [0], "reason": "win"},
  "view": [{"seat": 1, "match": {"left": 14}}, {"seat": -1, "match": {"you": -1}}]}]}
```
Đồng hồ ca kiểm bắt đầu từ 0. Cần đủ: khai cuộc, luật chính, ẩn thông tin (view ghế khác + người xem), các lỗi (sai lượt, sai pha, dữ liệu
rác, ghế lạ), đầu hàng, kết thúc. Ngoài ca kiểm, bộ kiểm còn chạy hàng trăm ván ngẫu nhiên (nước rác, đầu hàng, tất định, máy đấu máy).
