# Chuẩn giao tiếp Jagame — game và ứng dụng nhỏ chạy trong hội quán

> **Phiên bản chuẩn: 2.2.0** (Giao thức v2.2) · `manifest: 2` · `api: 1` · `sdk: "2"` (SDK `JGCore` 2.1.0 / `JGUI` 2.0.0) · cập nhật 18/10/2026.
>
> Đây là tài liệu **chính thức và đầy đủ** về cách một gói (game, hoặc ứng dụng nhỏ như bình chọn, bảng điểm, đố vui tự soạn, công cụ
> chơi chung…) nói chuyện với hội quán Jagame. Người hay AI chỉ cần đọc tệp này là viết được một gói chạy thật.
>
> | Câu hỏi | Nguồn sự thật |
> |---|---|
> | Giao diện lập trình: gói, manifest, hàm, đối tượng, thông điệp, giới hạn | **tệp này** |
> | Quy trình gửi bài: nhánh, tiêu đề, mô tả PR, 3 lệnh kiểm, duyệt | [`QUY-TAC-GUI-GAME.md`](QUY-TAC-GUI-GAME.md) |
> | Luật máy đọc (regex, giới hạn, API cấm, mã lỗi) | [`developers/ai-rules.json`](developers/ai-rules.json) — bộ kiểm đọc tệp này |
> | Schema manifest · lý do kết thúc chuẩn | `devkit/shared/sdk/manifest.schema.json` · `devkit/shared/sdk/reasons.json` |
>
> Khi tài liệu khác nói khác tệp này về giao diện lập trình, **tệp này đúng**. Bộ công cụ: [`devkit/`](devkit/README.md).

## Mục lục
0. [Đọc nhanh](#0-đọc-nhanh)
1. [Phiên bản và tương thích](#1-phiên-bản-và-tương-thích)
2. [Mô hình: khung lo gì, gói lo gì](#2-mô-hình)
3. [Gói: cây thư mục và giới hạn tệp](#3-gói)
4. [`manifest.json`](#4-manifestjson)
5. [Phía máy chủ: luật / logic](#5-phía-máy-chủ)
6. [Phía trình duyệt: giao diện](#6-phía-trình-duyệt)
7. [Thông điệp giữa trình duyệt và máy chủ](#7-thông-điệp)
8. [Ca kiểm `test/cases.json`](#8-ca-kiểm)
9. [Được sửa / cấm sửa](#9-được-sửa--cấm-sửa)
10. [Ứng dụng không phải game](#10-ứng-dụng-không-phải-game)
11. [Tự kiểm và chạy thử trên hội quán thật](#11-tự-kiểm-và-chạy-thử)
12. [Ví dụ đầy đủ: game theo lượt](#12-ví-dụ-đầy-đủ-game-theo-lượt)
13. [Bảng mã lỗi](#13-bảng-mã-lỗi)
— [English summary](#english-summary)

---

## 0. Đọc nhanh
1. Một gói = **1 thư mục** `submissions/<id>/`: `manifest.json` + `icon.svg` + `server/game.js` (luật) + `client/index.js` (giao diện) +
   `test/cases.json` + `README.md` + `LICENSE`. PR chỉ được đụng thư mục đó (mục 9).
2. `manifest.json` có `"manifest": 2`, `"api": 1`, `"sdk": "2"`, đúng schema, không trường lạ (mục 4).
3. Luật: `module.exports = JGCore.game({ kind, setup, moves, view, … })` — hàm thuần, đồng bộ, **tất định** trên state JSON (mục 5).
4. Ngẫu nhiên chỉ `ctx.rng()`, thời gian chỉ `ctx.now`. Cấm `require import process Date Promise Proxy Reflect eval Function` timer,
   TypedArray/`ArrayBuffer`/`BigInt`/`WebAssembly`, và chữ `async`/`await` ở BẤT KỲ đâu, kể cả chú thích (mục 5.1).
5. `view(s, you, v)` chỉ gửi điều ghế `you` được biết; `you = -1` là người xem (mục 5.6).
6. Hết ván / hết phiên: `JGCore.end(s, {winners, reason})`; ứng dụng không thắng thua dùng `JGCore.end(s, {scored: false, reason})` =
   "Xong phiên", không tính điểm (mục 5.7, 10).
7. Giao diện: `JG.defineGame(function (game) { … return { destroy }; })`, chỉ vẽ trong `game.root`, gửi bằng `game.send(move)`, mọi chữ
   người dùng qua `JGUI.esc()` (mục 6).
8. Giao diện chạy trong `iframe` cách ly: không mạng, không cookie, không `localStorage` (dùng `JG.storage`), không cửa sổ mới (mục 6.6).
9. Mỗi nước đi là JSON ≤ **2 KB**, gửi ≤ ~8 nước/giây (mục 7). Mỗi lần gọi luật ≤ **150 ms** (`bot`/`hint` 250 ms) (mục 5.10).
10. Chạy `node devkit/jagame.js check <id>` tới khi `KẾT QUẢ: ĐẠT — 0 lỗi`, rồi đúng 7 lệnh của `QUY-TAC-GUI-GAME.md` R10 (mục 11).

## 1. Phiên bản và tương thích
Chuẩn đánh số `CHÍNH.PHỤ.VÁ` (hiện **2.2.0**). Số CHÍNH trùng số giao thức game (`view.proto = 2`).

| Thay đổi | Tăng | Gói cũ |
|---|---|---|
| Sửa chữ, làm rõ, thêm ví dụ — không đổi hành vi | VÁ (2.2.0 → 2.2.1) | chạy y nguyên |
| Thêm trường manifest / hàm / tham số **tùy chọn**, thêm âm, biến CSS, lý do chuẩn; nới giới hạn | PHỤ (2.2 → 2.3) | chạy y nguyên; gói **dùng** tính năng mới phải đặt `app_min` = bản Jagame đầu tiên có tính năng đó (hội quán cũ hơn từ chối cài với mã `E_INCOMPAT` thay vì chạy sai) |
| Bỏ / đổi nghĩa trường hay hàm, siết giới hạn, đổi định dạng thông điệp | CHÍNH (2 → 3) + tăng `manifest` hoặc `api` | vẫn chạy **ít nhất 12 tháng** kể từ ngày ra chuẩn mới (cam kết chính thức của Jagame); bộ kiểm cảnh báo trước khi ngừng; ngày ngừng ghi ở đầu tệp này |

- Hội quán đọc `manifest` + `api` của từng gói để chọn cách chạy, nên gói đúng chuẩn 2.x chạy được trên mọi hội quán hỗ trợ `api: 1`.
- Manifest cũ (không có trường `"manifest"`) vẫn được nạp; bài gửi mới bắt buộc `"manifest": 2`.
- Gói đã phát hành không bao giờ đổi byte: sửa gì cũng phải tăng `version` của gói.
- Các phiên bản: 2.0 (giao thức v2 + SDK 2.0.0) · 2.1 (gộp tài liệu thành một chuẩn chính thức, ứng dụng không phải game, nêu rõ cỡ
  nước đi 2 KB và tần suất gửi) · **2.2** (tệp này, Jagame 0.4.0, SDK `JGCore` 2.1.0: kết quả **"không tính điểm"** — `Result.scored: false`,
  `JGCore.game({scored: false})`, manifest `"scored": false` (mục 5.7); chữ trong nước đi của gói cộng đồng / tự cài **qua bộ lọc từ** của
  hội quán (mục 5.4)). Gói 2.1 chạy y nguyên; gói dùng `Result.scored` vẫn chạy ở hội quán cũ (ở đó phiên được ghi là hòa như 2.1).

## 2. Mô hình
Gói gồm 2 nửa, nối với nhau qua **khung** (phần mềm hội quán):
```
Trình duyệt (iframe cách ly)          Khung (hội quán)                     Luật (server/game.js, khu cách ly)
  client/index.js                       sảnh, phòng, ghế, người xem,         setup(ctx) -> state
    game.send(move) ───────────────►    mạng, nối lại, chat, kết thúc  ───►  move(state, ctx) -> {state, error?}
    game.on('view', v) ◄──── view riêng của từng người ◄──────────────────  view(state, ghế)
    game.on('result', r) ◄───────────── kết quả ◄────────────────────────  result(state)
                                        nhịp tick_ms  ─────────────────────►  tick(state, ctx)   (nếu có)
```

| Khung lo (gói KHÔNG làm) | Gói lo |
|---|---|
| Sảnh, tạo/vào phòng, ghế, người xem, mời bạn, chat, biểu cảm, thanh "Rời ván" | Trạng thái ban đầu, nước hợp lệ, chuyển lượt / pha, kết thúc |
| Mạng, nối lại; mất kết nối quá 60 giây khi đang chơi → khung đi `{type:'resign'}` thay ghế đó (lý do `disconnect`) | `view`: che thông tin riêng của từng ghế |
| Lưu ván qua khởi động lại máy chủ, đồng hồ cờ (`clock`), xin đi lại (`undo`), gợi ý 💡 (`hint`), hướng dẫn lần đầu | (tùy chọn) `bot`, `legal`, `hint`, `undo` riêng |
| Máy chơi thay, màn kết thúc mặc định, ghi ván, xếp hạng, huy hiệu | Trả `reason` đúng chuẩn |
| Âm hệ thống, rung, 20+ giao diện màu, chế độ tối, an toàn | Vẽ trong `game.root`, chỉ dùng biến CSS |

Ghế trong luật luôn là `0..n-1` liên tục theo số người ngồi lúc bắt đầu (`n` = `s.jg.n`). Ghế `-1` = người xem.

## 3. Gói
```
submissions/<id>/
├── manifest.json        BẮT BUỘC  mục 4
├── icon.svg | icon.png  BẮT BUỘC  SVG vuông (viewBox w = h) hoặc PNG vuông 256–1024 px; ≤ 200 KB
├── server/game.js       BẮT BUỘC  luật / logic (server/ CHỈ chứa .js .json)
├── client/index.js      BẮT BUỘC  giao diện
├── client/style.css     tùy chọn  khai ở manifest.entry.style
├── client/assets/…      tùy chọn  hình, âm, phông TỰ LÀM: svg png jpg jpeg webp gif mp3 ogg m4a woff2
├── screenshots/*.png    nên có    ≤ 6 ảnh png/jpg/webp, mỗi ảnh ≤ 400 KB, cạnh 320–2400 px (dọc ~3:4)
├── test/cases.json      BẮT BUỘC  ca kiểm, mục 8 (test/ chỉ .json .js .md .txt; không vào gói phát hành)
├── README.md            BẮT BUỘC  mô tả, cách chơi/dùng, tác giả, giấy phép mã, nguồn + giấy phép từng tài sản không tự làm
├── LICENSE              BẮT BUỘC  (hoặc LICENSE.md / LICENSE.txt), khớp manifest.license
└── CHANGELOG.md         tùy chọn
```
- Mục gốc cho phép DUY NHẤT: `manifest.json icon.svg icon.png server client screenshots test README.md LICENSE LICENSE.md LICENSE.txt
  CHANGELOG.md jagame-submit.json <id>.jgame` (hai mục cuối do công cụ tạo).
- Giới hạn: ≤ 300 tệp · giải nén ≤ 30 MB · gói nén ≤ 10 MB · tên tệp chỉ `A-Z a-z 0-9 . _ - @ +`, phân biệt hoa/thường · đường dẫn ≤ 200 ký tự ·
  mỗi dòng mã ≤ 1000 ký tự (nên ≤ 140) · tệp chữ là UTF-8.
- Cấm: tệp/thư mục bắt đầu bằng `.` · symlink · submodule · `node_modules/` · `package.json` · thư mục `assets/` ở gốc (để trong
  `client/assets/`) · đuôi `.ts .tsx .jsx .html .zip .exe .wasm` · ROM/BIOS · nhị phân không khớp đuôi · địa chỉ `http(s)://` trong mọi tệp
  trừ `README.md` và `test/` (riêng `http://www.w3.org/` trong SVG được phép).
- Icon SVG: XML hợp lệ, gốc `<svg>` có `viewBox` vuông; cấm `<script>`, thuộc tính `on*=`, `<foreignObject>`, `href`/`url()` ra ngoài
  (chỉ `#id` nội bộ), `<!ENTITY>`.
- Công cụ đóng gói tự gộp SDK: `jg-core` lên đầu `server/game.js`, `jg-ui` lên đầu `client/index.js` (vì `"sdk": "2"`). Gói **không**
  tự chép SDK vào.

## 4. `manifest.json`
JSON hợp lệ (không chú thích, không dấu phẩy thừa), khớp `devkit/shared/sdk/manifest.schema.json`. Có `"manifest": 2` = kiểm CHẶT:
trường lạ, sai kiểu hay vượt giới hạn đều trượt (`E_MANIFEST_SCHEMA`).

Cột "Gửi": **✔** bắt buộc · **khuyên** nên có · **—** tùy chọn · **✗** KHÔNG dùng trong bài gửi (dành cho game chính thức / kho; bị chặn
hoặc bị từ chối khi duyệt).

| Trường | Gửi | Kiểu / giới hạn | Nghĩa |
|---|---|---|---|
| `manifest` | ✔ | `2` | định dạng manifest |
| `id` | ✔ | `^[a-z][a-z0-9-]{1,31}$`; không `local-`/`jg-`; không trùng id có sẵn | mã duy nhất = tên thư mục, không bao giờ đổi |
| `name` | ✔ | chuỗi 1–40 | tên hiển thị tiếng Việt |
| `version` | ✔ | `X.Y.Z` | bản đầu `0.1.0` (hoặc `1.0.0`); mỗi lần gửi lại phải tăng |
| `api` | ✔ | `1` | phiên bản máy chạy |
| `sdk` | ✔ | `"2"` | công cụ gộp `JGCore`/`JGUI` |
| `app_min` | ✔ | semver | bản Jagame tối thiểu; không chắc thì `"0.1.0"` |
| `group` | ✔ | `co` \| `dangian` \| `vui` \| `bai` | cờ · dân gian · vui cả nhà · bài lá (ứng dụng: dùng `vui`) |
| `color` | khuyên | `#rrggbb` | màu bìa thẻ |
| `players` | ✔ | `{"min": a, "max": b}`, 1 ≤ a ≤ b ≤ 50 | số người ngồi ghế (`min: 1` = dùng một mình được) |
| `spectators` | khuyên | bool | cho người xem (ghế −1) |
| `desc` | ✔ | chuỗi 1–160 | 1 câu mô tả |
| `tags` | — | ≤ 8 chuỗi, mỗi chuỗi 1–24 | nhãn tìm kiếm |
| `age` | ✔ | số nguyên 3–18 | tuổi tối thiểu |
| `content` | khi cần | mảng con, không trùng: `dau-ao` `so-hai` `chu-nguoi-choi` `ve-tu-do` `an-vai` `tinh-gio` | đậu ảo · yếu tố đáng sợ · người dùng gõ chữ cho nhau xem · vẽ tự do · nhập vai lừa gạt · áp lực thời gian. Có cược → MUST `dau-ao`; có ô gõ chữ cho người khác xem → MUST `chu-nguoi-choi` |
| `languages` | khuyên | `["vi"]` (mã `xx` hoặc `xx-YY`, 1–8) | |
| `icon` | ✔ | `"icon.svg"` \| `"icon.png"` | |
| `screenshots` | — | ≤ 6 `"screenshots/<tên>.png\|jpg\|jpeg\|webp"`, tệp phải tồn tại | |
| `homepage` | ✗ | — | địa chỉ `http(s)://` trong manifest bị chặn (`E_EXTERNAL_URL`); ghi trang của bạn trong `README.md` |
| `author` | ✔ | chuỗi ≤ 80, khác rỗng | tác giả |
| `license` | ✔ | mã SPDX ≤ 40, vd `"MIT"` | khớp tệp LICENSE |
| `howto` | khuyên | ≤ 10 chuỗi, mỗi chuỗi 1–400 | cách chơi / cách dùng, hiện ở hướng dẫn lần đầu |
| `news` | khuyên | chuỗi 1–240 | "Có gì mới" cho người dùng |
| `changelog` | ✔ | chuỗi khác rỗng | nhật ký kỹ thuật bản này |
| `entry` | ✔ | `{"client": "client/….js", "server": "server/….js", "style"?: "client/….css"}` | tệp vào |
| `mode` | khuyên | `"turn"` \| `"simultaneous"` \| `"realtime"` \| `"events"` hoặc mảng 1–4 giá trị không trùng; KHÔNG `turn`+`simultaneous`; KHÔNG `"action"` | nhịp giao tiếp (mục 5.2); khớp `kind` |
| `tick_ms` | khi `realtime` | số nguyên 250–60000 | nhịp gọi `tick()`; không dùng cùng `clock` |
| `session` | — | `{"minutes": [ít, nhiều]}`, mỗi số 1–240 | độ dài 1 ván / phiên |
| `needs` | khuyên | `{"sound", "vibrate", "storage", "user_text"}` đều bool | nhu cầu trình duyệt, chợ hiện cho chủ nhà; `user_text: true` khi người dùng gõ chữ hiện cho người khác |
| `bot` | — | bool | `true` → MUST có `bot()` |
| `bot_simultaneous` | khi gói cùng lúc có bot | bool | khung hỏi mọi ghế máy cùng lúc |
| `clock` | — | `true` \| mảng ≤ 8 chuỗi `"phút+giây"` (vd `"5+3"`) | đồng hồ cờ do khung giữ; chỉ `turn`, không `tick_ms` |
| `undo` / `undo_max` | — | bool / 1–20 | xin đi lại do khung lo (gói có thể viết `undo()` riêng) |
| `hint` / `hint_max` | — | bool / 1–20 | gợi ý 💡; `true` → MUST có `hint()` hoặc `bot()` |
| `tutorial` | — | 1–8 bước: chuỗi ≤ 240 hoặc `{text, title?, at?}`; hoặc `{"steps": […]}` | hướng dẫn lần đầu do khung vẽ (thiếu thì khung dùng `howto`) |
| `ui` | — | `{players?: "game"\|"frame", events?: bool, end?: "game"\|"frame", fullscreen?: bool, end_banner?: bool}` | `players:"game"` gói tự vẽ chip ghế · `events` bật luồng sự kiện · `end:"game"` gói tự vẽ màn kết thúc (khung chỉ để nút Chơi lại) · `end_banner` giữ banner gọn khi `end:"game"` · `fullscreen` phủ trọn màn điện thoại |
| `options` | — | ≤ 10 `{key ^[a-zA-Z][a-zA-Z0-9_]{0,31}$, label 1–60, choices[1–20] (số / bool / chuỗi ≤ 40), default ∈ choices}` | tùy chọn chủ phòng chọn trước ván, đọc ở `ctx.options[key]` |
| `reasons` | khi dùng lý do riêng | ≤ 20 `{"<mã>": {"text": 1–60, "by": "winner"\|"loser"\|"none"}}`; mã `^[a-z][a-z0-9-]{1,23}$`, không trùng mã chuẩn | lý do kết thúc riêng (mục 5.7) |
| `scored` | khi là ứng dụng | `false` (mặc định `true`); có trường này thì `app_min` ≥ `"0.4.0"` | gói không có thắng thua: MỌI kết thúc (kể cả rời phòng, khung tự kết thúc) là "Xong phiên", không tính điểm (mục 5.7). Muốn chạy cả trên hội quán cũ hơn 0.4.0: bỏ trường này, dùng `JGCore.game({scored: false})` |
| `resume` | ✗ | bool | khôi phục ván sau khởi động lại — mặc định đã bật cho mọi gói |
| `room` | ✗ | `{dropin?, persist?, teams?}` | vào/ra giữa ván — chỉ game chính thức |
| `teams` | ✗ | `{count, size}` | chơi theo đội — chỉ game chính thức |
| `action` | ✗ | — | game hành động thời gian thực — chưa nhận ở hạng cộng đồng |
| `soon`, `unlisted` | ✗ | bool | cờ của kho |

**Quy tắc `players`** (máy kiểm + khung cùng áp):
- `min` = số người ngồi ghế tối thiểu để chủ phòng bấm **Bắt đầu**; đủ `max` thì phòng tự bắt đầu. `1 ≤ min ≤ max ≤ 50`.
- `min: 1` = dùng một mình được (ứng dụng, trò luyện tập). Khi đó `setup` phải chạy đúng với `n = 1` và có cách kết thúc khi chỉ 1 người.
- Bất kể `min`, ván/phiên đang có **2 người mà 1 người rời thì PHẢI kết thúc** (bộ kiểm bắt buộc); ≥ 3 người thì chạy tiếp tới khi còn < `minAlive` (mục 5.2).
- Ca kiểm không ghi `players` thì dùng `min`; bộ kiểm chơi ngẫu nhiên với mọi số người từ `min` tới `max` — luật phải đúng với cả hai đầu.
- Không có cách giữ chỗ cho người tới sau (vào giữa ván): ghế cố định từ lúc bắt đầu. Người tới sau là người xem (`spectators: true`).

Ví dụ manifest của một ứng dụng: mục 10.2. Ví dụ của một game: mục 12.1.

## 5. Phía máy chủ

### 5.1 Môi trường (khu cách ly)
Mọi bài gửi chạy trong **khu cách ly**: một máy JavaScript riêng (ES2023) cho mỗi gói, không chạm được ổ đĩa, mạng hay phần còn lại của hội
quán. Bộ quét tĩnh chặn trước (mã `E_FORBIDDEN_API`), máy chạy chặn lần nữa:
- **Không có:** `require`, `import`, `process`, `fs`/mạng, timer (`setTimeout`/`setInterval`), `Date`, `Promise`, `eval`, `Function(…)`/`new
  Function` (kể cả `constructor.constructor`), `__proto__`, `Proxy`, `Reflect`, `WebAssembly`, `SharedArrayBuffer`/`Atomics`, `ArrayBuffer`,
  `DataView`, mọi TypedArray, `BigInt`, `globalThis[…]`, `Math.random`. Bộ quét đọc cả chuỗi — đừng viết các chữ này kể cả trong chuỗi.
- **Chữ `async` hoặc `await` ở BẤT KỲ đâu (kể cả chú thích) → cả gói bị từ chối.**
- Đồng bộ hoàn toàn: mỗi hàm nhận state, trả kết quả, xong. Không giữ gì trong biến toàn cục giữa các lần gọi (có thể mất bất cứ lúc nào).
- **State là JSON thuần:** object, mảng, số hữu hạn, chuỗi, bool, `null`. Không `Map`, `Set`, hàm, `undefined`, `NaN`, `Infinity`, vòng tham chiếu.
- **Tất định:** cùng state + cùng ctx (cùng chuỗi `ctx.rng()`) → cùng kết quả. Bộ kiểm chạy lại 20 ván để so.
- Ngẫu nhiên CHỈ `ctx.rng()` (số thực [0, 1), hệ thống cấp hạt giống theo ván) hoặc `JGCore.int/pick/shuffle(ctx.rng, …)`.
  Thời gian CHỈ `ctx.now` (ms của máy chủ — chỉ dùng để so hiệu, không đọc ra ngày giờ; ca kiểm bắt đầu từ 0).

### 5.2 `JGCore.game(def)` — thứ bạn viết
```js
'use strict';
// JGCore có sẵn (công cụ gộp SDK lên đầu tệp). KHÔNG nạp module gì.
module.exports = JGCore.game({
  kind: 'turn',            // 'turn' | 'simultaneous' | 'realtime' — khớp manifest.mode
  minAlive: 2,             // còn < minAlive người (sau khi có người rời) thì ván kết thúc. Mặc định 2
  resign: 'leave',         // 'leave' (mặc định): ván ≥ 3 người chạy tiếp khi 1 người rời · 'end': 1 người rời là hết ván
  setup: function (s, ctx) { /* gắn trường của gói vào s; s.jg đã có sẵn */ },
  moves: {
    place: {
      args: { x: 'int', y: 'int' },   // kiểm kiểu trước khi chạy (mục 5.9); sai -> 'bad-move'
      phase: 'play',                  // chuỗi hoặc mảng pha hợp lệ; sai -> 'wrong-phase'
      turn: true,                     // chỉ ghế đang tới lượt; sai -> 'not-your-turn'
      whenDone: false,                // true = ghế đã "xong phần mình" vẫn đi được
      phaseError: 'Chưa tới lúc đặt quân', doneError: 'Bạn xong phần mình rồi',   // chữ lỗi riêng (tùy chọn)
      run: function (s, ctx, mv) { /* SỬA THẲNG s; trả undefined = nhận; trả chuỗi / JGCore.err(…) = từ chối */ }
    }
  },
  view: function (s, you, v) { /* gắn trường RIÊNG vào v; trường chuẩn SDK tự điền */ },
  // tùy chọn:
  tick: function (s, ctx) {},                       // cần manifest tick_ms
  onResign: function (s, seat, ctx, resignDefault) { resignDefault(s, seat); },
  legal: function (s, seat) { return []; },         // mọi nước hợp lệ của ghế — KHUYÊN CÓ (bộ kiểm + máy chơi dùng)
  bot: function (s, seat, ctx) { return null; },    // manifest bot:true; chỉ ĐỌC s
  hint: function (s, seat, ctx) { return null; },   // nước hoặc {move, cells?, text?}
  undo: function (s, ctx) {},                       // đi lại riêng; trả chuỗi = từ chối
  turn: function (s, you) {}, phase: function (s) {}, timer: function (s) {}, scores: function (s) {}, logView: function (s, you) {},
  result: function (s) { return null; }             // hiếm khi cần — dùng JGCore.end
});
```
Thay cho `moves` có thể viết một hàm `move: function (s, ctx, mv) {}` tự phân loại nước (khi đó tự kiểm kiểu, pha, lượt).

| Khóa | Bắt buộc | Chữ ký | Việc |
|---|---|---|---|
| `kind` | khuyên | `'turn'` \| `'simultaneous'` \| `'realtime'` | `turn`: `s.jg.turn` là ghế đang đi, `view.turn` = ghế đó · `simultaneous`: mọi người đi cùng lúc, `view.turn = null` · `realtime`: như `simultaneous` + `tick` |
| `minAlive` | — | số | ngưỡng người còn lại; dưới ngưỡng thì `resign` kết thúc ván |
| `resign` | — | `'leave'` \| `'end'` | xem trên |
| `setup` | ✔ | `(s, ctx)` | ctx = `{players: [{id, name, bot?}], options, rng(), now}`; đặt `s.jg.phase` (mặc định `'play'`), với `turn` đặt `s.jg.turn` |
| `moves` | ✔ (hoặc `move`) | `{loại: {args?, phase?, turn?, whenDone?, phaseError?, doneError?, run}}` | `run(s, ctx, mv)`, ctx = `{player, move, now, rng(), events[]}` |
| `view` | ✔ | `(s, you, v)` | mục 5.6 |
| `tick` | khi `realtime` | `(s, ctx)` | ctx = `{now, rng()}`; gọi mỗi `tick_ms` khi ván đang chạy |
| `onResign` | — | `(s, seat, ctx, resignDefault)` | dọn riêng khi 1 ghế rời (chuyển quyền, bỏ phiếu…), rồi gọi `resignDefault(s, seat)` |
| `legal` | khuyên | `(s, seat) → Move[]` | `[]` khi ghế không có việc; bộ kiểm chơi ngẫu nhiên bằng danh sách này |
| `bot` | khi `bot:true` | `(s, seat, ctx) → Move \| null` | ctx = `{options, rng(), now}`; trả đúng dạng nước của `moves`; sai/`null`/lỗi khi tới lượt → máy đầu hàng |
| `hint` | khi `hint:true` | `(s, seat, ctx) → Move \| {move, cells?, text?} \| null` | `cells` ≤ 64 phần tử, `text` ≤ 200 ký tự |
| `undo` | — | `(s, ctx)` | trả chuỗi để từ chối |
| `turn` · `phase` · `timer` · `scores` | — | `(s, you)` · `(s)` · `(s)` · `(s)` | ghi đè `view.turn` / `view.phase` / `view.timer` / `view.scores` |
| `logView` | — | `(s, you) → mảng` | lọc nhật ký `s.jg.log` theo người nhận |
| `result` | — | `(s) → Result \| null` | chỉ khi không dùng `JGCore.end` |

**SDK làm sẵn cho MỌI nước** (theo thứ tự): ván đã xong → `ended` · ghế ngoài `0..n-1` → `seat` · nước không phải `{type: chuỗi ≤ 32}` →
`bad-move` · ghế đã rời → `you-done` · `{type:'resign'}` → `onResign` hoặc mặc định · loại lạ / `args` sai → `bad-move` · sai `phase` →
`wrong-phase` · sai lượt → `not-your-turn` · ghế đã xong mà nước không `whenDone` → `you-done` · chép sâu state rồi mới gọi `run`; bị từ chối
thì trả lại state CŨ nguyên vẹn. **Không khai nước `resign`** — SDK lo.

**Phong bì `s.jg`** (SDK tạo, đọc thoải mái, ghi qua hàm SDK hoặc đúng các trường sau):

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `n` | số | số ghế |
| `names[]` · `bots[]` | chuỗi ≤ 40 · bool | tên, ghế máy |
| `out[]` · `done[]` · `finish[]` | bool · bool · ghế | đã rời · đã xong phần mình · thứ tự về đích (gói tự `push`) |
| `phase` | chuỗi ≤ 24 | pha hiện tại — gói GHI |
| `turn` | ghế \| `null` | ghế đang đi (`kind:'turn'`) — gói GHI |
| `now` | số | `ctx.now` của lần gọi này |
| `deadline` · `timerTotal` · `timerSeat` | | do `JGCore.setDeadline/clearDeadline` ghi |
| `end` | Result \| `null` | do `JGCore.end` ghi |
| `log` | mảng ≤ 30 | do `JGCore.log` ghi |

### 5.3 Vòng đời một ván / phiên
1. Phòng chờ: người vào ghế. Chủ phòng bấm **Bắt đầu** khi đủ `players.min` (đầy `players.max` thì tự bắt đầu).
2. Khung gọi `setup` một lần với người đang ngồi → state đầu. Từ đây ghế cố định `0..n-1`.
3. Mỗi lần ai đó `game.send(move)`: khung gọi `move` → nhận thì lưu state mới + gửi `view` mới cho TỪNG người; từ chối thì chỉ người gửi
   nhận `error`. Gói `realtime`: khung gọi `tick` mỗi `tick_ms` (tối thiểu 250).
4. Người rời / mất kết nối quá lâu: khung đi `{type:'resign'}` thay ghế đó (ván 2 người → người kia thắng; ≥ 3 người → ghế đó `out`, ván
   chạy tiếp tới khi còn < `minAlive`).
5. Khi `result(state)` khác `null` (sau `JGCore.end`): khung gửi `result`, hiện màn kết thúc (hoặc để gói tự vẽ nếu `ui.end:"game"`), ghi ván.
6. **Chơi lại** = ván MỚI: `setup` chạy lại từ đầu, không mang gì từ ván trước. Muốn giữ dữ liệu qua nhiều câu / nhiều lượt → làm trong
   CÙNG một ván (mục 10).
7. Máy chủ khởi động lại giữa ván: state được lưu sau mỗi nước và dựng lại — vì vậy state phải đủ để chạy tiếp (không dựa biến toàn cục).
   Khung có thể tự kết thúc ván với lý do riêng của khung: `game-error` (gói lỗi/quá ngân sách CPU), `server-restart`, `room-abandoned` —
   đều là hòa, không phải việc của gói.

### 5.4 Nước đi
- `Move = {type: "<loại>", …}` — JSON, ≤ **2 KB** (2048 byte UTF-8) sau khi tuần tự hóa; lớn hơn bị khung từ chối trước khi tới luật.
- Kiểm và giới hạn mọi giá trị trong `args` (độ dài chuỗi, khoảng số, cỡ mảng); không tin client.
- Chữ người dùng gõ (câu hỏi, tên đội…) là dữ liệu thô: làm sạch (bỏ ký tự điều khiển, cắt độ dài) ở luật; hiển thị luôn qua `JGUI.esc`.
  Khai `content: ["chu-nguoi-choi"]` + `needs.user_text: true` để chủ nhà biết.
- **Bộ lọc từ cấm (chuẩn 2.2, gói hạng cộng đồng / tự cài):** trước khi đưa nước đi cho luật, hội quán chạy bộ lọc từ (đúng chế độ chủ nhà
  đang bật ở Quản trị → Kiểm duyệt) trên **mọi chuỗi** trong nước đi, kể cả khóa của đối tượng, tối đa **8 tầng** lồng và **256 chuỗi** (khóa +
  giá trị):
  - chế độ **tắt**: nước đi nguyên vẹn;
  - chế độ **che**: chuỗi có từ cấm được thay phần đó bằng `***` (cùng kiểu, cùng cấu trúc) rồi mới tới luật; người gửi nhận thông báo "đã che";
  - chế độ **chặn** (hoặc người nhỏ tuổi khi chủ nhà bật chế độ chặt): cả nước đi bị từ chối với lỗi `filtered`, luật KHÔNG được gọi;
  - từ cấm nằm trong **khóa** đối tượng, hoặc nước đi vượt 8 tầng / 256 chuỗi → từ chối (`filtered`) ở mọi chế độ trừ tắt.
  Hệ quả cho gói: chữ luật nhận có thể chứa `***`; không dùng chữ người gõ làm khóa đối tượng hay mã định danh; giữ nước đi phẳng. Game
  chính thức không qua bước này (kho đã duyệt).
- Từ chối: `return 'Chữ tiếng Việt cho người dùng'` hoặc `return JGCore.err('forbidden', 'Chỉ chủ phiên làm được')`. Chữ ngắn, nói cách sửa,
  không dấu chấm cuối, không lộ bí mật.

### 5.5 Thời gian
- Hạn giờ: `JGCore.setDeadline(s, ms, seat?)` rồi `if (JGCore.expired(s)) …` trong `tick` (hoặc `move`). `clearDeadline(s)` khi xong.
- View gửi `timer` **tương đối** `{left, total, seat?, paused?}` (ms); client đếm lùi bằng `JGUI.timer`. Không gửi mốc tuyệt đối.
- Game theo lượt không tự giữ giờ cờ — khai `clock` để khung làm (khung đi `resign` thay ghế hết giờ, lý do `het-gio`).

### 5.6 View — mỗi người một bản
`view(s, you, v)` được gọi cho TỪNG ghế và cho người xem (`you = -1`). Chỉ gắn vào `v` điều người đó được biết: bài/quân úp của người
khác (thay bằng `-1` cùng số lá — `JGCore.Cards.mask`), vai ẩn, đáp án, phiếu bầu, lựa chọn bí mật (chỉ gửi "đã chọn" dạng bool), bộ bài còn
lại, hạt giống. Người xem không thấy bí mật của ai. `events` (mục 7) tới CẢ phòng — không chứa bí mật.

SDK tự thêm trường chuẩn (gói đặt trùng tên thì giữ của gói):

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `proto` | `2` | số giao thức |
| `phase` | chuỗi ≤ 24 | pha; hết ván `"ended"` |
| `turn` | ghế \| `null` | ghế đang phải hành động; `null` khi cùng lúc / hết ván |
| `you` | ghế \| `-1` | người nhận |
| `youDone` | bool | người nhận đã rời / xong phần mình (khung ẩn nút Rời ván) |
| `resignNote` | chuỗi ≤ 140 (tùy chọn, gói đặt) | câu phụ trong hộp xác nhận Rời ván |
| `seats` | `[{name, out, done, bot}]` đủ `n` phần tử | |
| `timer` | `null` \| `{left, total, seat?, paused?}` | |
| `scores` | `null` \| `number[n]` | điểm, dùng cho bảng cuối ván (từ `scores(s)`) |
| `finishOrder` | ghế[] | thứ tự về đích |
| `result` | `null` \| Result | |
| `log` | (tùy chọn) ≤ 30 dòng | nhật ký đã lọc (`logView`) |

State/view trả ra ≤ **256 KB** JSON.

### 5.7 Kết thúc và kết quả
```ts
Result = { winners: number[], reason: string, draw?: true, ranks?: (number|null)[], scored?: false }   // ranks[ghế] = hạng, 1 = nhất
```
- `JGCore.end(s, {winners, reason, draw?, ranks?, scores?})` — chốt một lần (gọi lại bị bỏ qua). `winners: []` → SDK tự gắn `draw: true`.
- `JGCore.end(s, {scored: false, reason})` — kết thúc **không tính điểm** (SDK 2.1): `{winners: [], reason, scored: false}`, không `draw`.
- `JGCore.endByScore(s, scores, reason, {lowWins?, drawOnTie?, seats?})` — người điểm cao nhất thắng (bằng nhau cùng thắng), tự tính `ranks`.
- `reason` PHẢI thuộc danh sách chuẩn hoặc `manifest.reasons`; lý do lạ = trượt kiểm. `by`: `winner` = việc người thắng làm nên, `loser` =
  do người thua gây ra (khung gắn tên người thua), `none` = hòa / trung tính.
- Khung tự gán: `resign`, `disconnect`, `leave`, `het-gio`.

Lý do chuẩn (`reasons.json`): `resign` · `disconnect` · `leave` · `het-gio` (loser) · `win` · `score` · `finish` · `het-nguoi` · `het-van` ·
`sach-dau` (winner) · `het-luot` · `draw` (none) — và các mã của game có sẵn, dùng lại được: `checkmate` · `stalemate` · `five` · `draw-agree` ·
`draw-50` · `repetition` · `full` · `tan-cuoc` · `all-home` · `low-beans` · `het-dan` · `all-down` · `general` · `all-soldiers` · `kinh` ·
`het-so` · `het-cau` · `het-quan` · `draw-200` · `poker-bust` · `poker-hands` · `ve-xong` · `bai-diem` · `het-soi` · `soi-thang` · `whitewin` ·
`phom-diem`. Lý do riêng: `"reasons": {"que-cuoi": {"text": "phải nhặt que cuối cùng", "by": "loser"}}`.

**"Không tính điểm" (chuẩn 2.2)** — cho ứng dụng không có thắng thua (chia đội, bình chọn, điểm danh…). Ba cách khai, chọn một:

| Cách | Phạm vi | Hội quán cũ hơn 0.4.0 |
|---|---|---|
| `JGCore.end(s, {scored: false, reason})` (hoặc `result()` trả `{winners: [], reason, scored: false}`) | phiên đó | chạy được, phiên ghi là hòa |
| `JGCore.game({scored: false, …})` | mọi `JGCore.end` của gói, kể cả khi người cuối rời phiên (SDK tự kết thúc) | chạy được, phiên ghi là hòa |
| manifest `"scored": false` (+ `app_min` ≥ `"0.4.0"`) | MỌI kết thúc, kể cả khung tự kết thúc (`game-error`, `server-restart`, xử thua thay) | từ chối cài (`E_INCOMPAT`) |

Với kết quả này khung: hiện **"Xong phiên"** (màn kết thúc, dòng trong chat phòng, xem lại), không pháo hoa / âm thắng thua; KHÔNG ghi
thắng/thua/hòa cho ai, KHÔNG tính thống kê, bảng xếp hạng, mùa giải, nhiệm vụ, huy hiệu (kể cả "Ván đầu tiên"), tim thưởng, tỉ số phòng.
Ván vẫn được lưu để xem lại. `scored` chỉ nhận `false` (bỏ trường khi ván có tính điểm); khi `scored: false` thì `winners` rỗng, không `draw`,
không `ranks` (bộ kiểm hợp đồng bắt sai). Kết thúc `winners: []` KHÔNG kèm `scored: false` vẫn là **ván hòa** như trước. Gói KHÔNG được lách
(vd chia thắng ngẫu nhiên).

### 5.8 Mã lỗi nước đi chuẩn
| `code` | Chữ mặc định | Khi nào |
|---|---|---|
| `ended` | Ván đã kết thúc | đi sau khi có kết quả |
| `seat` | Bạn không ngồi ở bàn này | ghế ngoài `0..n-1` |
| `bad-move` | Nước đi không hợp lệ | sai dạng / loại lạ / `args` sai |
| `not-your-turn` | Chưa tới lượt bạn | |
| `wrong-phase` | Chưa tới lúc làm việc này | |
| `you-done` | Bạn đã rời ván rồi | |
| `rule` | (chữ của gói) | vi phạm luật — mặc định khi `run` trả chuỗi |
| `forbidden` · `limit` · `timeout` | Bạn không được làm việc này · Hết lượt dùng · Hết giờ rồi | không có quyền · hết lượt dùng · tới sau hạn |

### 5.9 SDK `JGCore` (tra cứu)
Biến toàn cục `JGCore` (được gộp sẵn; mọi hàm thuần).

| Nhóm | Hàm |
|---|---|
| Khung | `game(def)` · `VERSION` (`"2.0.0"`) |
| Dữ liệu | `isInt(v)` · `isObj(v)` · `clone(x)` · `fill(n, v\|fn)` · `range(n)` · `sum(a)` |
| Ngẫu nhiên | `int(rng, n)` → 0..n-1 · `pick(rng, arr)` · `shuffle(rng, arr)` (tại chỗ) — luôn truyền `ctx.rng` |
| Lỗi | `ERR` (bảng chữ mục 5.8) · `err(code, text?)` → `{error, code}` |
| Kiểm nước | `checkArg(v, spec)` · `checkArgs(mv, args)`; spec: `'int'` `'num'` `'str'` (≤ 200) `'bool'` `'ints'` (≤ 64) `'cards'` · `[giá trị…]` · `{int: [min, max]}` · `{str: maxLen}` · `{arr: spec, max}` (mặc định ≤ 64) · `{opt: spec}` (được vắng) |
| Ghế | `Seats.next(from, n, ok?, dir?)` (→ −1 nếu không có) · `Seats.list(n, ok?)` · `Seats.alive(s)` · `Seats.playing(s)` |
| Bài | `Cards.RANKS` · `Cards.SUITS` · `Cards.deck({ranks, suits, copies})` · `Cards.rank(c)` · `Cards.suit(c)` · `Cards.deal(deck, seats, k)` · `Cards.mask(hand)` |
| Đậu ảo | `Beans.pay(beans, from, to, amt, allowNegative?)` · `Beans.broke(beans, i, min?)` · `Beans.leaders(beans, seats)` |
| Lưới | `Grid.make(w, h, v)` · `Grid.inside(w, h, x, y)` · `Grid.run(g, x, y, dx, dy)` · `Grid.DIRS4` · `Grid.DIRS8` |
| Kết thúc | `end(s, r)` · `endByScore(s, scores, reason, opts)` · `ranksByScore(scores, seats, lowWins)` |
| Thời gian | `setDeadline(s, ms, seat?)` · `clearDeadline(s)` · `expired(s)` |
| Nhật ký | `log(s, {t, …})` (≤ 30 dòng cuối → `view.log`) |
| Lý do | `REASONS` · `REASON_RE` |

Số dòng lỗi trong `game.js` = dòng báo − số dòng SDK (bộ kiểm in con số này).

### 5.10 Giới hạn khu cách ly
| Giới hạn | Giá trị | Vượt thì |
|---|---|---|
| Mỗi lần gọi `setup/move/view/result/tick/legal/undo` | **150 ms** (nên < 5 ms) | lần gọi bị cắt; bộ kiểm cục bộ báo lỗi > 250 ms |
| `bot` / `hint` | **250 ms** (nên < 10 ms; máy cách ly chậm hơn Node thường 4–30× ở tìm kiếm sâu) | máy đầu hàng / không có gợi ý |
| `server/game.js` sau khi gộp SDK (~26 KB) | **256 KB** | không nạp (`E_ISOLATION`) |
| State / view trả ra | **256 KB** JSON | lần gọi lỗi |
| Bộ nhớ | **64 MB** mỗi gói | khu cách ly dựng lại, biến toàn cục mất |
| `tick_ms` | ≥ **250** | tự nâng lên 250 |
| CPU mỗi phòng | ≤ **1.000 ms / 10 giây** | ván kết thúc hòa `game-error` |
| Lỗi nặng lặp lại | ≥ 20 lần quá giờ / hết bộ nhớ trong 1 giờ | gói tạm tắt, chủ nhà được báo |
| `mode: "action"` | không có | không nạp |

### 5.11 API mức thấp (tham khảo)
`JGCore.game(def)` biến `def` thành đúng các hàm máy gọi: `setup(ctx) → state` · `move(state, ctx) → {state, error?, code?, events?}` ·
`view(state, seat)` · `result(state) → Result | null` · `tick?(state, ctx) → {state}` · `legal?(state, seat)` · `bot?(state, seat, ctx)` ·
`hint?(state, seat, ctx)` · `undo?(state, ctx) → {state, error?}`. Bài gửi PHẢI dùng SDK (`"sdk": "2"`); phần này chỉ để hiểu khung gọi gì.

### 5.12 Quy ước theo thể loại
| Thể loại | Khai / dùng | Mẫu |
|---|---|---|
| Theo lượt | `kind:'turn'`, `moves.x.turn = true`, ghi `s.jg.turn` (`JGCore.Seats.next`) | `devkit/games/nhatque`, `xucxac` |
| Cùng lúc | `kind:'simultaneous'`; có máy chơi thì `bot_simultaneous: true` (khung hỏi mọi ghế máy, `null` = chưa có việc) | `oantuti`, `binhchon` |
| Theo nhịp | `mode` có `realtime` + `tick_ms`, `tick()`, `JGCore.setDeadline/expired` | `oantuti` (đồng hồ hiệp), `binhchon` (hạn trả lời) |
| Luồng sự kiện (nét vẽ…) | `ui.events: true`, trong `run`: `ctx.events.push({t: 'stroke', …})` → khung phát cho cả phòng THAY vì gửi lại view; client `game.on('event', fn)` (`ev.seat` = ghế gửi) | |
| Ẩn thông tin | `view` che theo `you`, `JGCore.Cards.mask`, `logView` | |
| Lưới / bàn cờ | `JGCore.Grid.make/inside/run`, `args: {x: 'int', y: 'int'}` | |
| Bài lá | `JGCore.Cards.deck/shuffle/deal/mask` | |
| Đậu ảo | `JGCore.Beans.pay/leaders/broke`, `scores: s => s.beans`, `content: ["dau-ao"]`, mô tả ghi "(đậu ảo, không tiền thật)"; mỗi ván bắt đầu lại; hết đậu = `done`, kết thúc `sach-dau` / `het-van`. **Không bao giờ** tiền thật, quy đổi, mua bán, nạp | |
| Nhiều người + xếp hạng | ≥ 3 người: người xong phần mình đặt `s.jg.done[ghế] = true` (`view.youDone`), về đích `s.jg.finish.push(ghế)`; chốt theo điểm `JGCore.endByScore(s, scores, 'score', {lowWins?, drawOnTie?})` | `xucxac` |
| Máy chơi | `bot(s, seat, ctx)` chỉ ĐỌC, tất định qua `ctx.rng`; theo lượt: khung gọi khi tới ghế máy; độ khó: option `bot_level`; tìm kiếm sâu phải tự giới hạn (đếm nút / độ sâu), mục tiêu ≤ 100 ms trong khu cách ly | `nhatque` |
| Đi lại · gợi ý · hướng dẫn · đồng hồ cờ | khung làm; gói khai `undo` / `hint` / `tutorial` / `clock`, khi cần viết `undo(s, ctx)` / `hint(s, seat, ctx)` | `nhatque` (gợi ý) |
| Ứng dụng không phải game | mục 10 | `binhchon` |

## 6. Phía trình duyệt

### 6.1 `JG.defineGame` và đối tượng `game`
`client/index.js` là script thường (không module, không `import`), gọi đúng một lần:
```js
JG.defineGame(function (game) {
  'use strict';
  var root = game.root;                       // chỉ vẽ trong đây
  root.innerHTML = '<div class="xx"></div>';  // gắn sự kiện vào phần tử CON (root dùng lại giữa các ván)
  function render(v) { if (!v) return; /* vẽ theo view */ }
  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () { /* dọn hẹn giờ, trình nghe toàn cục */ } };
});
```

| Thành phần | Kiểu | Việc |
|---|---|---|
| `game.root` | phần tử | khung vẽ riêng của gói |
| `game.me` | `{id, name}` | người đang xem trang (id không mang ý nghĩa — đừng phân tích, đừng gửi đi) |
| `game.seat` | số | ghế của mình `0..n-1`, `-1` = người xem |
| `game.players` | `[{id, name, seat, bot}]` | người ngồi lúc bắt đầu |
| `game.options` | object | tùy chọn ván đã chọn |
| `game.view` | object | view mới nhất (mục 5.6) |
| `game.soundNames` | chuỗi[] | tên âm hợp lệ (mục 6.4) |
| `game.storage` | = `JG.storage` | kho cục bộ nhỏ (mục 6.4) |
| `game.send(move)` | | gửi nước đi (mục 7) |
| `game.on(ev, fn)` | | `'view'` (v) · `'result'` (Result) · `'error'` (chữ lỗi — có trình nghe thì khung KHÔNG tự hiện) · `'event'` (sự kiện, có `ev.seat`) · `'hint'` ({move, cells?, text?}) · `'chat'` (số tin chưa đọc) |
| `game.toast(text)` | | thông báo ngắn ≤ 120 ký tự, chữ thuần, ≤ 5 lần/giây |
| `game.sound(name)` | | phát âm theo tên (tên lạ: im lặng) |
| `game.highlight(sel \| phần tử, {ms, label})` | | vòng sáng chỉ chỗ; trả hàm tắt |
| `game.openChat(on?)` · `game.menu()` | | mở khung chat / menu phòng — chỉ có tác dụng ngay sau một lần chạm/bấm của người dùng |
| `game.input` · `game.viewSize` · `game.world` | | dành cho game hành động — không có tác dụng ở bài gửi |
| trả về `{destroy}` | | gọi khi rời phòng / ván mới |

- Vẽ nước đi **ngay** khi người dùng bấm (lạc quan), rồi vẽ lại khi `view` hoặc `error` tới.
- Mọi chữ đến từ người dùng (tên, câu hỏi, câu trả lời…) qua `JGUI.esc()` trước khi vào `innerHTML`, hoặc dùng `textContent`.

### 6.2 `JGUI` (gộp sẵn khi `"sdk": "2"`)
| Hàm | Việc |
|---|---|
| `JGUI.esc(s)` | escape HTML — **BẮT BUỘC** cho chữ người dùng |
| `JGUI.q(root, sel)` | `querySelector` trong root |
| `JGUI.still()` | người dùng bật giảm chuyển động |
| `JGUI.nameOf(game, seat)` · `JGUI.turnText(game, view)` | tên ghế · câu "Tới lượt …" |
| `JGUI.sound(game, name)` | phát âm an toàn |
| `JGUI.chips(game, view)` | HTML hàng chip ghế (tên, lượt, điểm) |
| `JGUI.timer(el, view.timer)` · `JGUI.fmt(ms)` | đếm lùi, trả hàm dừng · định dạng `m:ss` |
| `JGUI.bar(root, [{label, onClick, primary?, disabled?, key?}])` | thanh nút dính đáy `.jg-dock` (gọi lại để đổi nút; `[]` = giữ chỗ trống) |
| `JGUI.banner(root, text, ms?)` | banner sự kiện |
| `JGUI.pad(root, opts)` | nút ảo cảm ứng + bàn phím + tay cầm: `{stick: 'analog'\|'dpad4'\|'dpad8'\|null, buttons: [{id, label, hold?, big?}] (≤ 6), small: ['start','menu'], key, onChange}` → `pad.state` `{x, y, mag, dir, up, down, left, right, <id>…}`, `pad.took(id)`, `show()`, `hide()`, `destroy()` |
| `JGUI.VERSION` · `JGUI.injectCss()` | `"2.0.0"` · nạp CSS của JGUI (các hàm trên tự gọi) |

### 6.3 Biến CSS, chế độ tối, điện thoại trước
Mọi màu/phông/bo góc đọc biến của hội quán, luôn kèm dự phòng `var(--x, …)`. Hội quán chép biến của giao diện đang dùng (20+ giao diện,
màu riêng của chủ nhà, chế độ tối) vào khung — gói dùng đúng biến là tự đổi màu theo.

| Biến | Dùng cho |
|---|---|
| `--bg` `--paper` `--soft` | nền trang · nền thẻ/ô · nền nhạt |
| `--ink` `--muted` `--line` | chữ · chữ phụ · đường kẻ |
| `--accent` `--accent-ink` `--accent-text` `--on-accent` | điểm nhấn · chữ trên nền accent · chữ màu accent · chữ trên nền accent đậm |
| `--radius` `--r-btn` `--shadow` `--card-bw` `--card-line` `--card-shadow` `--btn-bw` `--btn-shadow` | bo góc, viền, bóng |
| `--f-head` | phông tiêu đề |
| `--jg-obj-ink` `--jg-obj-paper` `--jg-obj-line` | **đồ vật thật** (lá bài, mặt quân, xúc xắc): mực/giấy CỐ ĐỊNH, không đảo khi tối |
| `--jg-dock-h` · `--jg-safe-bottom` · `--jg-stage-h` | cao thanh nút đáy · chừa chỗ đáy · cao dùng được khi xoay ngang |

- **Chế độ tối** = biến đã đảo sẵn. KHÔNG dùng `prefers-color-scheme` (chế độ của hội quán có thể khác máy). Không đặt chữ `#fff`/`#000`
  cố định trên nền `var(--ink)`/`var(--paper)`; đồ vật dùng `--jg-obj-*`. Không bọc `--radius` trong `min()`.
- `<html>` trong khung có `data-theme="<giao diện>"`; lớp `jg-reduced` khi giảm chuyển động.
- **Điện thoại trước:** không tràn ngang ở 360 px; vùng bấm ≥ 44 px (nút chính 48); chữ ≥ 13 px; ô nhập ≥ 16 px (tránh iOS phóng to);
  góc phải dưới 80×80 px là nút chat của khung. Máy tính: nội dung ≤ 640 px căn giữa.
- `@media (prefers-reduced-motion: reduce)`: tắt animation, phần tử hiện ngay ở trạng thái cuối (JS: `JGUI.still()`).
- Tiền tố lớp CSS riêng 2–4 chữ (vd `bc-`); không định dạng thẻ chung (`body`, `button`) ngoài root. Không `<link>` ra ngoài; phông chỉ của
  hội quán hoặc `client/assets/*.woff2` tự có giấy phép. `devkit/shared/game-ui.css` có lớp mẫu để CHÉP. Chi tiết mỹ thuật:
  [`developers/GIAO-DIEN.md`](developers/GIAO-DIEN.md).

### 6.4 Âm thanh, rung, lưu trữ
- Âm: `game.sound(name)` với `move` `move-other` `turn` `win` `lose` `draw` `error` `tick` `join` `leave` `chat` `send` `start` `capture`
  `check` `dice` `deal` `chip`. Khung tự phát `start`, `turn`, `win`/`lose`/`draw`. Gọi `move` NGAY khi người dùng bấm. Ưu tiên âm của khung: trong
  khung cách ly, Web Audio có thể bị trình duyệt treo; tệp âm tự làm (`client/assets/*.mp3|ogg|m4a`) chỉ nên phát bằng `<audio>` ngay sau
  một lần chạm của người dùng, và gói phải chạy đúng khi không có tiếng.
- Rung: `JG.haptic('tap' | 'ok' | 'warn')` hoặc `navigator.vibrate(ms ≤ 400)` — đi qua khung.
- Lưu cục bộ: `JG.storage.get(k)` / `JG.storage.set(k, v)` (chuỗi), tổng ≤ **64 KB** theo từng gói, lưu ở trình duyệt người dùng — chỉ cài đặt
  nhỏ (âm lượng, lựa chọn hiển thị). Không có kho dùng chung giữa người dùng; dữ liệu chung phải nằm trong state của ván.

### 6.5 Khung `iframe` cách ly — làm được gì, KHÔNG làm được gì
Giao diện bài gửi chạy trong `<iframe sandbox="allow-scripts">` có origin mờ (`"null"`), CSP `connect-src 'none'`. Trang hội quán không nạp
mã của gói.

| Làm được | KHÔNG làm được |
|---|---|
| Vẽ DOM/CSS/SVG/canvas trong `game.root` | Mạng: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, WebRTC |
| Nạp tệp của chính gói (`client/assets/…`) bằng đường dẫn tương đối | Tài nguyên ngoài (ảnh, phông, script từ Internet) |
| `game.*`, `JGUI.*`, `JG.storage`, `JG.haptic` | Cookie, `localStorage`/`sessionStorage` thật, `indexedDB` (có kho giả cùng API, nhưng bộ kiểm chặn chữ `localStorage` — dùng `JG.storage`) |
| Bàn phím, chuột, cảm ứng trong khung | `window.open`, popup, điều hướng trang mẹ, form gửi đi |
| `requestAnimationFrame`, `setTimeout(fn)` (hàm, không chuỗi) | `window.parent`/`top`/`opener`, `postMessage`, `alert/confirm/prompt` |
| Chiều cao khung tự theo nội dung | Worker, Service Worker, `WebAssembly`, `eval`, `Function(…)`, `import`, `<iframe>`/`<object>`/`<embed>` |

`100vh` trong khung là theo khung, không theo màn hình. Hướng dẫn lần đầu (`tutorial[].at`) không rọi được phần tử trong khung.

### 6.6 Toàn màn hình, menu, điều khiển cảm ứng
- `ui.fullscreen: true`: khi đang chơi, khung phủ trọn màn điện thoại và hiện nút ⋯ mở menu trận (Trò chuyện · Âm thanh · Toàn màn hình ·
  Rời phòng). Gói có nút menu riêng thì gắn thuộc tính `data-jg-menu` vào nút đó, hoặc gọi `game.menu()`. Khung bắn sự kiện `resize` sau khi
  đổi chế độ — đo bàn theo `innerWidth/innerHeight`.
- Khi xoay ngang, `--jg-stage-h` là chiều cao dùng được: đọc `var(--jg-stage-h, <giá trị cũ>)`.
- `JGUI.pad(game.root, opts)` (mục 6.2): bàn phím mặc định WASD/mũi tên = cần; nút 1 = Space/J/Z, 2 = K/X, 3 = L/C; Enter = start, Esc = menu.
  Người dùng chỉnh cỡ/độ mờ/đổi tay/vị trí bằng nút ⚙. `pad.took('b')` đúng 1 lần mỗi lần bấm mới.

## 7. Thông điệp
Mọi giao tiếp đi qua khung; gói KHÔNG tự mở kết nối.

| Chiều | Gói tin | Định dạng | Giới hạn |
|---|---|---|---|
| trình duyệt → máy chủ | `game.send(move)` | `{type: chuỗi ≤ 32, …}` JSON | ≤ **2 KB** (2048 byte UTF-8); khung giữ ≤ ~20/giây, dồn ≤ 8 liền; cả kết nối của một người ≤ 8 sự kiện/giây (dồn ≤ 20; phòng `realtime` 10/giây, dồn 30) — vượt thì bị bỏ, vượt liên tục thì khung ngừng nhận / ngắt kết nối |
| máy chủ → trình duyệt | `view` | object (mục 5.6), riêng từng người | ≤ 256 KB; gửi sau mỗi nước được nhận và sau `tick` |
| máy chủ → trình duyệt | `error` | chữ tiếng Việt (+ `code` ở luật) | chỉ tới người gửi nước bị từ chối |
| máy chủ → trình duyệt | `result` | Result (mục 5.7) | 1 lần mỗi ván |
| máy chủ → trình duyệt | `event` | `{t: …, …, seat}` từ `ctx.events.push({…})` trong `run` (chỉ khi `ui.events: true`) | ≤ **16 KB** mỗi nước; tới CẢ phòng thay cho view; khi có kết quả / đổi lượt / đổi pha khung vẫn gửi view đầy đủ |
| máy chủ → trình duyệt | `hint` | `{move, cells?, text?}` | `cells` ≤ 64, `text` ≤ 200 |

- Gửi theo **hành động của người dùng**, không gửi theo khung hình. Nên ≤ 4 nước/giây; gom thay đổi nhỏ (kéo thanh trượt, gõ chữ) thành một
  nước khi người dùng thả tay / bấm nút.
- Không có kênh gói ↔ gói, gói ↔ Internet, hay lưu trữ trên máy chủ ngoài state của ván.

## 8. Ca kiểm
`test/cases.json`:
```json
{"cases": [{"name": "…", "players": 2, "options": {}, "steps": [
   {"seat": 0, "move": {"type": "take", "n": 1}},
   {"seat": 1, "move": {"type": "take", "n": 9}, "error": "chuỗi con của lỗi"},
   {"tick": 3000}],
  "result": {"winners": [0], "reason": "win"},
  "view": [{"seat": 1, "match": {"left": 14}}, {"seat": -1, "match": {"you": -1}}]}]}
```
- `players` mặc định = `players.min`; `options` mặc định = `default` của manifest; đồng hồ bắt đầu từ 0; `{"tick": ms}` = cho đồng hồ chạy ms.
- `error` = CHUỖI CON của chữ lỗi (không để `""`). Chữ lỗi SDK: `Chưa tới lượt bạn` · `Nước đi không hợp lệ` · `Bạn không ngồi ở bàn này` ·
  `Ván đã kết thúc` · `Chưa tới lúc làm việc này` · `Bạn đã rời ván rồi`.
- `result`: `null` = ván chưa xong; object so khớp đủ. `view[].match` so KHỚP MỘT PHẦN (object lồng nhau cũng một phần).
- MUST có ca: khai cuộc, luật chính, ≥ 3 lỗi (sai lượt / sai pha, nước rác, ghế lạ), rời ván (2 người → hết ván); có bí mật thì MUST có ca view
  ghế khác + người xem KHÔNG thấy bí mật. SHOULD có 1 ca tới kết thúc.
- Ngoài ca kiểm, bộ kiểm chơi 200 ván ngẫu nhiên từ `legal`/`bot` (xen nước rác, rời ván, nhảy đồng hồ), so tất định, kiểm hợp đồng
  view/result. Ván ngẫu nhiên MUST kết thúc (≤ 5.000 bước, có `tick` ≤ 20.000); 2 người mà 1 người rời MUST kết thúc ván; ván chưa xong thì
  luôn phải có ít nhất 1 ghế có nước hợp lệ (trừ gói có `tick` — đồng hồ được chạy tiếp).

## 9. Được sửa / cấm sửa
Bài gửi là một Pull Request vào repo công khai. Máy kiểm đọc danh sách tệp PR đổi:

| Đường dẫn | Được làm | Vi phạm → mã |
|---|---|---|
| `submissions/<id>/**` (đúng 1 thư mục, `<id>` = `manifest.id`) | **tạo / sửa / xóa** tệp của gói mình | — |
| `submissions/<id-khác>/` | cấm (1 PR = 1 gói) | `E_MULTI_GAME` |
| `submissions/README.md`, `submissions/AGENTS.md` | cấm | `E_PATH_OUTSIDE` |
| `devkit/games/<id>/` | nháp trên máy bạn (đã `.gitignore`), KHÔNG commit | `E_PATH_OUTSIDE` |
| `devkit` · `developers` · `.github` | cấm (công cụ, tài liệu, máy kiểm) | `E_PATH_OUTSIDE` |
| `application` · `system` · `assets` · `Realtime` · `php` · `database` · `uploads` · `cloudflared` | cấm — mã hội quán đã mã hóa và dữ liệu | `E_PATH_OUTSIDE` |
| Tệp ở gốc: `README.md` `CHUAN-GIAO-TIEP.md` `QUY-TAC-GUI-GAME.md` `AGENTS.md` `CLAUDE.md` `CONTRIBUTING.md` `LICENSE` `*.sh` `*.bat` `*.php` `.gitignore` `.gitattributes` | cấm | `E_PATH_OUTSIDE` |
| Trong gói: tệp chấm, symlink, mục gốc ngoài danh sách mục 3, đuôi lạ | cấm | `E_DOTFILE` `E_SYMLINK` `E_FILE_NAME` `E_FILE_TYPE` `E_FAKE_BINARY` |
| Thư mục `submissions/<Tên-Sai>/` hoặc khác `manifest.id` | cấm | `E_ID_INVALID` `E_ID_MISMATCH` `E_ID_TAKEN` `E_ID_RESERVED` |

Báo lỗi tài liệu / bộ công cụ: mở Issue. Lỗ hổng bảo mật: gửi riêng qua mục Security của repo, không mở Issue công khai.

## 10. Ứng dụng không phải game
Chuẩn này dùng chung cho game và **ứng dụng nhỏ chạy chung trong phòng**: bình chọn, điểm danh, bảng điểm cho trò ngoài đời, đố vui tự soạn,
quay số chọn người, chia đội, đếm ngược… Khung vẫn lo phòng, ghế, người xem, chat, nối lại; gói chỉ cần nghĩ theo "phiên" thay vì "ván".

### 10.1 Cách nghĩ
| Game | Ứng dụng |
|---|---|
| ván | **phiên**: từ lúc chủ phòng bấm Bắt đầu tới khi gói gọi `JGCore.end` |
| thắng / thua | không có: `JGCore.game({scored: false, …})` + `JGCore.end(s, {scored: false, reason: '<lý do riêng>'})` + `reasons: {"<lý do>": {"text": "…", "by": "none"}}` → "Xong phiên", không tính điểm (mục 5.7) |
| màn kết thúc của khung | `ui: {"end": "game"}` — gói tự vẽ màn tổng kết, khung chỉ thêm nút Chơi lại (= phiên mới) |
| đi theo lượt | thường `kind: 'simultaneous'` (mọi người bấm cùng lúc); hạn giờ → thêm `realtime` + `tick_ms` |
| 2+ người | `players.min: 1` nếu dùng một mình được |
| nhiều câu / nhiều vòng | giữ trong CÙNG một phiên (`s.round`, `s.history`); phiên mới không mang dữ liệu cũ |
| người điều khiển | "chủ phiên" = một ghế trong state (vd ghế 0); khi ghế đó rời, chuyển cho ghế còn lại trong `onResign` |

Luật vẫn như game: tất định, `view` che bí mật (phiếu bầu, đáp án), nước đi ≤ 2 KB, `legal()` để bộ kiểm chơi thử, 2 người mà 1 người rời thì
phiên PHẢI kết thúc, chưa kết thúc thì luôn có ít nhất 1 ghế có việc để làm (nếu không có `tick`).

### 10.2 Mẫu tối thiểu: Điểm danh
Mọi người bấm "Có mặt", chủ phiên bấm "Chốt". Bốn tệp dưới + `icon.svg`, `README.md`, `LICENSE` là đủ một gói qua mọi bộ kiểm. Mẫu đầy đủ
hơn (câu hỏi tự soạn, phiếu bí mật, hạn giờ, nhiều câu, màn tổng kết): `devkit/games/binhchon/` (Bình chọn nhanh) — chạy thử bằng
`node devkit/jagame.js play binhchon`.

<!-- vd diemdanh/manifest.json -->
```json
{
  "manifest": 2,
  "id": "diemdanh",
  "name": "Điểm danh",
  "version": "0.1.0",
  "api": 1,
  "sdk": "2",
  "app_min": "0.1.0",
  "group": "vui",
  "color": "#3fae7a",
  "players": { "min": 1, "max": 30 },
  "spectators": true,
  "desc": "Ứng dụng nhỏ: mọi người bấm Có mặt, chủ phiên chốt danh sách",
  "tags": ["ứng dụng", "cả nhà"],
  "age": 3,
  "languages": ["vi"],
  "icon": "icon.svg",
  "entry": { "client": "client/index.js", "server": "server/game.js", "style": "client/style.css" },
  "mode": "simultaneous",
  "session": { "minutes": [1, 5] },
  "needs": { "sound": true, "vibrate": false, "storage": false, "user_text": false },
  "ui": { "end": "game" },
  "reasons": { "chot-danh-sach": { "text": "đã chốt danh sách", "by": "none" } },
  "howto": ["Bấm Có mặt.", "Chủ phiên (ghế đầu còn ở lại) bấm Chốt khi đủ người."],
  "news": "Bản đầu tiên.",
  "author": "Tên tác giả",
  "license": "MIT",
  "changelog": "0.1.0: bản đầu tiên."
}
```

<!-- vd diemdanh/server/game.js -->
```js
'use strict';
// Điểm danh — luật. Không ai thắng thua: phiên kết thúc "không tính điểm" (scored: false) — khung hiện "Xong phiên".
function host(s) { return JGCore.Seats.alive(s)[0]; }   // chủ phiên = ghế đầu còn ở lại

module.exports = JGCore.game({
  kind: 'simultaneous',
  scored: false,                           // mọi kết thúc (kể cả người cuối rời) không tính điểm
  setup: function (s) {
    s.here = JGCore.fill(s.jg.n, false);
    s.jg.phase = 'open';
  },
  moves: {
    here: {
      phase: 'open',
      run: function (s, ctx) {
        if (s.here[ctx.player]) return 'Bạn đã điểm danh rồi';
        s.here[ctx.player] = true;
      }
    },
    close: {
      phase: 'open',
      run: function (s, ctx) {
        if (ctx.player !== host(s)) return JGCore.err('forbidden', 'Chỉ chủ phiên chốt được');
        JGCore.end(s, { scored: false, reason: 'chot-danh-sach' });
      }
    }
  },
  view: function (s, you, v) {
    v.here = s.here.slice();               // không có bí mật: ai cũng thấy ai đã có mặt
    v.host = host(s);
  },
  legal: function (s, seat) {
    var out = s.here[seat] ? [] : [{ type: 'here' }];
    return seat === host(s) ? out.concat([{ type: 'close' }]) : out;
  }
});
```

<!-- vd diemdanh/client/index.js -->
```js
JG.defineGame(function (game) {
  'use strict';
  var root = game.root;
  root.innerHTML = '<div class="dd"><h2 class="dd-h"></h2><ul class="dd-list"></ul></div>';
  function render(v) {
    if (!v) return;
    var n = v.here.filter(Boolean).length;
    JGUI.q(root, '.dd-h').textContent = v.result ? 'Đã chốt: ' + n + '/' + v.seats.length + ' người có mặt' : 'Có mặt ' + n + '/' + v.seats.length;
    JGUI.q(root, '.dd-list').innerHTML = v.seats.map(function (p, i) {
      return '<li class="' + (v.here[i] ? 'is-on' : '') + '">' + (v.here[i] ? '✓ ' : '… ') + JGUI.esc(p.name) + '</li>';
    }).join('');
    var me = v.you, live = me >= 0 && !v.result && !v.youDone, items = [];
    if (live && !v.here[me]) items.push({ label: 'Có mặt', key: 'here', primary: true, onClick: function () { game.send({ type: 'here' }); game.sound('move'); } });
    if (live && me === v.host) items.push({ label: 'Chốt', key: 'close', onClick: function () { game.send({ type: 'close' }); } });
    JGUI.bar(root, items);
  }
  game.on('view', render);
  game.on('error', function (msg) { game.toast(msg); render(game.view); });
  render(game.view);
  return { destroy: function () {} };
});
```

<!-- vd diemdanh/client/style.css -->
```css
.dd { max-width: 520px; margin: 0 auto; padding: 8px 4px; color: var(--ink, #222); }
.dd-h { margin: 4px 0 12px; text-align: center; font-family: var(--f-head, inherit); font-size: 20px; }
.dd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.dd-list li { min-height: 44px; display: flex; align-items: center; padding: 0 12px; border: 2px solid var(--line, #ddd);
  border-radius: var(--radius, 12px); background: var(--paper, #fff); overflow-wrap: anywhere; }
.dd-list li.is-on { border-color: var(--accent, #3fae7a); font-weight: 700; }
```

<!-- vd diemdanh/test/cases.json -->
```json
{"cases": [
  {"name": "mở phiên", "players": 3, "steps": [], "result": null,
   "view": [{"seat": 0, "match": {"proto": 2, "phase": "open", "turn": null, "host": 0, "here": [false, false, false]}},
            {"seat": -1, "match": {"you": -1}}]},
  {"name": "lỗi: không phải chủ phiên, điểm danh 2 lần, nước rác, ghế lạ", "players": 3, "steps": [
     {"seat": 1, "move": {"type": "close"}, "error": "Chỉ chủ phiên"},
     {"seat": 1, "move": {"type": "here"}},
     {"seat": 1, "move": {"type": "here"}, "error": "rồi"},
     {"seat": 0, "move": {"type": "hack"}, "error": "không hợp lệ"},
     {"seat": 7, "move": {"type": "here"}, "error": "không ngồi"}],
   "result": null, "view": [{"seat": 2, "match": {"here": [false, true, false]}}]},
  {"name": "chủ phiên rời ở phiên 3 người: ghế kế làm chủ", "players": 3, "steps": [
     {"seat": 0, "move": {"type": "resign"}}, {"seat": 1, "move": {"type": "close"}}],
   "result": {"winners": [], "reason": "chot-danh-sach", "scored": false}},
  {"name": "2 người, 1 người rời: phiên kết thúc", "players": 2, "steps": [{"seat": 1, "move": {"type": "resign"}}],
   "result": {"winners": [], "reason": "resign", "scored": false}},
  {"name": "chốt: không ai thắng thua", "players": 2, "steps": [
     {"seat": 0, "move": {"type": "here"}}, {"seat": 0, "move": {"type": "close"}}, {"seat": 1, "move": {"type": "here"}, "error": "kết thúc"}],
   "result": {"winners": [], "reason": "chot-danh-sach", "scored": false}, "view": [{"seat": 1, "match": {"phase": "ended"}}]}
]}
```

### 10.3 Giới hạn hiện tại với ứng dụng (chuẩn 2.2)
| Giới hạn | Cách làm hiện nay |
|---|---|
| Chưa có nhóm chợ riêng cho ứng dụng (`group` chỉ `co` `dangian` `vui` `bai`) | dùng `vui` + `tags: ["ứng dụng", …]` |
| Không có lưu trữ trên máy chủ giữa các phiên, không có kho chung giữa người dùng | giữ mọi dữ liệu trong state của phiên; `JG.storage` chỉ cho cài đặt cục bộ ≤ 64 KB |
| Không có mạng, không có tệp do người dùng tải lên | chỉ chữ ngắn trong nước đi (≤ 2 KB) |
| Chữ trong nước đi qua bộ lọc từ của hội quán (che `***` hoặc từ chối cả nước — mục 5.4) | vẫn làm sạch + giới hạn độ dài ở luật; khai `chu-nguoi-choi` + `user_text`; đừng dùng chữ người gõ làm khóa |
| Phiên 2 người mà 1 người rời thì phải kết thúc (bộ kiểm bắt buộc) | dùng `minAlive` mặc định 2 |
| Khung vẫn hiện số người ngồi, nút Rời ván, và câu "Ván …" trong chat phòng | đặt `ui.end: "game"`, chữ trong gói nói "phiên" |

## 11. Tự kiểm và chạy thử
Từ gốc repo (bản fork):
```bash
node devkit/jagame.js new <id> --name "Tên" --author "Tác giả"   # khung từ trò mẫu -> devkit/games/<id>/ (viết lại thành của bạn)
node devkit/jagame.js play <id>                                 # chơi thử: http://127.0.0.1:7788/tools/play.html?game=<id>  (&players=3 &bot=1)
node devkit/jagame.js check <id>                                # manifest, luật trong sandbox, ca kiểm, 200 ván ngẫu nhiên -> KẾT QUẢ: ĐẠT — 0 lỗi
node devkit/jagame.js submit <id>                               # chép sang submissions/<id>/
python3 devkit/check_submission.py submissions/<id>             # bộ kiểm giống máy kiểm PR -> KẾT QUẢ: ĐẠT — 0 lỗi, N lưu ý
```
**Chạy thật trên hội quán của bạn** (khu cách ly thật, nhiều máy):
1. `python3 devkit/check_submission.py submissions/<id> --jgame /tmp/<id>.jgame` → gói thử (đã gộp SDK, chưa ký).
2. Trên hội quán (chủ nhà, mở từ máy/mạng nhà): **Quản trị → Chợ game → Cài đặt chợ** → bật **"Cho phép nhập game ngoài kho"**.
3. **Cài thủ công** → chọn tệp `.jgame` → bảng kiểm 9 mục (mục "Chưa có chữ ký" màu vàng là bình thường) → tích "Tôi biết nguồn gói này"
   → **Cài đặt**. Gói thành `local-<id>`, chạy trong khu cách ly như bài đã duyệt.
4. Mở `/choi/local-<id>`, tạo phòng, gửi mã phòng cho máy khác (điện thoại) vào, bấm Bắt đầu.

**Trình tự gửi = đúng 7 lệnh** ở [`QUY-TAC-GUI-GAME.md`](QUY-TAC-GUI-GAME.md) R10 (3 lệnh kiểm bắt buộc là bước 5–7; tiêu đề `[Gửi game] …` hoặc
`[Gửi ứng dụng] …`). Các lệnh `play`/`check` ở trên chỉ để thử trong lúc viết. Từng bước cho AI agent:
[`developers/AI-RULES.md`](developers/AI-RULES.md).

## 12. Ví dụ đầy đủ: game theo lượt
"Bóng bay": 2–4 người lần lượt bơm 1–3 hơi, ai làm bóng nổ là thua. Bốn tệp dưới + `icon.svg`, `README.md`, `LICENSE` là một gói hợp lệ.

### 12.1 `manifest.json`
<!-- vd bongbay/manifest.json -->
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

### 12.2 `server/game.js`
<!-- vd bongbay/server/game.js -->
```js
'use strict';
// JGCore có sẵn (công cụ gộp SDK lên đầu tệp). KHÔNG nạp module gì.
module.exports = JGCore.game({
  kind: 'turn',                       // khớp manifest.mode
  setup: function (s, ctx) {          // ctx = {players:[{id,name,bot?}], options:{key:value}, rng(), now}
    s.size = ctx.options.size === 20 ? 20 : 10;   // kiểm/giới hạn option, có mặc định
    s.air = 0;
    s.jg.phase = 'play';
    s.jg.turn = 0;                    // game theo lượt đặt ghế đi trước
  },
  moves: {
    pump: {
      args: { n: { int: [1, 3] } },   // sai kiểu -> 'bad-move'
      phase: 'play',
      turn: true,
      run: function (s, ctx, mv) {    // SỬA THẲNG s
        s.air += mv.n;
        if (s.air >= s.size) {        // người làm nổ bóng thua, mọi người còn lại thắng
          JGCore.end(s, { winners: JGCore.Seats.alive(s).filter(function (i) { return i !== ctx.player; }), reason: 'no-bong' });
          return;
        }
        s.jg.turn = JGCore.Seats.next(ctx.player, s.jg.n, function (q) { return !s.jg.out[q]; });
      }
    }
  },
  view: function (s, you, v) {        // không có bí mật
    v.air = s.air; v.size = s.size;
  },
  legal: function (s, seat) {
    if (s.jg.end || s.jg.turn !== seat) return [];
    return [1, 2, 3].map(function (n) { return { type: 'pump', n: n }; });
  },
  bot: function (s, seat, ctx) {      // chỉ ĐỌC s
    if (s.jg.end || s.jg.turn !== seat) return null;
    return { type: 'pump', n: 1 + JGCore.int(ctx.rng, 3) };
  }
});
```

### 12.3 `client/index.js`
<!-- vd bongbay/client/index.js -->
```js
JG.defineGame(function (game) {
  'use strict';
  var root = game.root;
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
  return { destroy: function () {} };
});
```

### 12.4 `test/cases.json`
<!-- vd bongbay/test/cases.json -->
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
Thêm các mẫu khác trong `devkit/games/`: `oantuti` (cùng lúc + đồng hồ), `nhatque` (theo lượt + gợi ý), `xucxac` (2–6 người + ngẫu nhiên),
`binhchon` (ứng dụng không phải game). Không gửi bản đổi tên / biến thể nhỏ của các mẫu này.

## 13. Bảng mã lỗi
Bộ kiểm in `TRƯỢT [E_…]` và dòng cuối `KẾT QUẢ: TRƯỢT — … · mã: E_…`. Bảng sinh tự động từ `developers/ai-rules.json`:
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
| `E_BRANCH_NAME` | nhánh PR không phải gui-<id> | git branch -m gui-<id> (đổi tên nhánh hiện tại) rồi push lại |
| `E_PR_TITLE` | tiêu đề PR sai mẫu "[Gửi game] <id> v<version> — <Tên game>" hoặc lệch manifest (id/version/name) | sửa tiêu đề PR đúng từng ký tự; dấu — là gạch dài (U+2014); version/name lấy đúng từ manifest.json |
| `E_PR_BODY` | mô tả PR thiếu/để trống mục bắt buộc, ô xác nhận chưa [x], thiếu kết quả 3 lệnh hoặc ảnh chụp | dán đúng mẫu .github/pull_request_template.md, điền đủ 9 mục ##, dán nguyên đầu ra 3 lệnh, thêm ảnh hoặc đường dẫn screenshots/<tệp>.png |
| `E_NOT_OWNER` | PR sửa game đã có chủ (submissions/OWNERS.json) nhưng người mở PR không phải tác giả gốc | không gửi PR cho game của người khác: mở Issue gắn @tác-giả hoặc PR vào bản fork của tác giả; tác giả bỏ > 90 ngày → Issue xin tiếp quản (QUY-TRINH-DONG-GOP.md luồng 4) |
| `E_CHANGELOG` | bản cập nhật thiếu submissions/<id>/CHANGELOG.md hoặc CHANGELOG.md chưa ghi phiên bản mới | thêm CHANGELOG.md, mục '## <version>' mô tả thay đổi (ghi rõ nếu đổi luật thắng/thua) |
<!-- /ERROR_CODES -->

---
## English summary
**Jagame interface standard 2.2.0** (protocol v2.2; `manifest: 2`, `api: 1`, `sdk: "2"`). This file is the single source of truth for the
programming interface of games and small apps (polls, scoreboards, custom quizzes, shared tools) that run inside a Jagame clubhouse.
Submission process: `QUY-TAC-GUI-GAME.md`; machine-readable rules: `developers/ai-rules.json`.

- **Versioning:** PATCH = wording only; MINOR = new optional fields/functions/sounds/CSS variables or relaxed limits — old packages keep
  working, packages using a new feature must set `app_min`; MAJOR = breaking change, bumps `manifest` or `api`, and the previous major keeps
  running for at least 12 months (official commitment). 2.2 adds unscored results and word-filtering of move text.
- **Package:** one folder `submissions/<id>/` with `manifest.json`, square `icon.svg|png`, `server/game.js`, `client/index.js` (optional
  `client/style.css`, `client/assets/`, `screenshots/`), `test/cases.json`, `README.md`, `LICENSE`. No dotfiles, symlinks, `node_modules`,
  external URLs, ROMs, unknown binaries; ≤ 300 files, ≤ 30 MB unpacked.
- **Manifest:** strict JSON Schema (`devkit/shared/sdk/manifest.schema.json`); every field is listed in section 4, including which ones are
  forbidden in submissions (`homepage`, `room`, `resume`, `teams`, `action`, `soon`, `unlisted`).
- **Server:** `module.exports = JGCore.game({kind, setup, moves, view, tick?, onResign?, legal?, bot?, hint?, undo?, …})`. Pure, synchronous,
  deterministic functions over a JSON state; randomness only `ctx.rng()`, time only `ctx.now`; no `require/import/process/Date/Promise/Proxy/
  Reflect/eval/Function`/timers/TypedArrays/`BigInt`/`WebAssembly`, and the words `async`/`await` nowhere. `view(s, you, v)` must hide other
  seats' secrets (`you = -1` = spectator). End with `JGCore.end(s, {winners, reason})`; reasons from `reasons.json` or `manifest.reasons`.
  Apps without winners end with `JGCore.end(s, {scored: false, reason})` (or `JGCore.game({scored: false})`, or manifest `"scored": false`
  with `app_min` ≥ 0.4.0): shown as "Session over", no win/loss/draw, no stats, ranking, badges or heart rewards.
  Isolation limits: 150 ms per call (bot/hint 250 ms), bundled server ≤ 256 KB, state/view ≤ 256 KB, 64 MB memory, `tick_ms` ≥ 250, room CPU
  ≤ 1,000 ms per 10 s.
- **Browser:** `JG.defineGame(function (game) {…; return {destroy}})`; `game.root/me/seat/players/options/view/soundNames/storage`,
  `send/on/toast/sound/highlight/openChat/menu`; `JGUI` helpers; theme CSS variables (dark mode = variables already swapped); mobile first
  (360 px, ≥ 44 px targets, ≥ 16 px inputs). Runs in a sandboxed `iframe` with an opaque origin: no network, cookies, real storage
  (`JG.storage` ≤ 64 KB instead), popups, parent access, workers or `eval`.
- **Messages:** move = JSON `{type, …}` ≤ 2 KB; for community/self-installed packages every string in a move (values and keys, ≤ 8 levels,
  ≤ 256 strings) goes through the clubhouse word filter first: masked with `***` or the whole move rejected (`filtered`), per the owner's
  setting; ~8 moves/s per connection at most (send on user actions, not per frame); per-seat `view`
  ≤ 256 KB; room-wide `event` ≤ 16 KB per move; `result` once per match.
- **Editable paths:** only `submissions/<id>/**` (`E_PATH_OUTSIDE`, `E_MULTI_GAME` otherwise).
- **Submitting:** exactly the 7 commands of `QUY-TAC-GUI-GAME.md` R10; PR title `[Gửi game] <id> v<version> — <Name>` or, for
  apps, `[Gửi ứng dụng] <id> v<version> — <Name>`. No git remote / `user.name`? Ask the user for the author line — never invent it.
- **Non-game apps:** think "session" instead of "match": `players.min: 1`, usually `kind: 'simultaneous'`, end with `winners: []` and a
  custom reason with `by: "none"` and `scored: false`, draw your own summary with `ui.end: "game"`. Current limits: no dedicated store
  category (use `group: "vui"`), no server storage across sessions. Minimal example in 10.2; full example `devkit/games/binhchon`.
- **Self-test:** `node devkit/jagame.js check <id>`, `python3 devkit/check_submission.py submissions/<id>` (add `--jgame out.jgame` to
  install it on your own clubhouse via Admin → Game market → Manual install, after enabling "allow games from outside the store").
