> **Bắt buộc:** [QUY-TRINH-DONG-GOP.md](../QUY-TRINH-DONG-GOP.md) — 4 luồng đóng góp; lõi đóng nguồn, không nhận PR sửa lõi.
> **Đọc trước:** [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](../developers/ai-rules.json) — luật máy đọc.

# AI-RULES — luật viết và gửi game Jagame (dành cho AI agent)

> Đối tượng: AI agent viết code (Claude Code, Codex, Cursor…). Đọc HẾT tệp này trước khi sửa bất cứ thứ gì. Mọi câu ở đây là luật,
> không phải gợi ý. MUST = bắt buộc · MUST NOT = cấm · SHOULD = nên (bỏ qua phải có lý do). Bản máy đọc: `developers/ai-rules.json`
> (cùng luật; `devkit/check_submission.py` đọc tệp đó). **Giao diện lập trình (manifest, hàm, đối tượng, thông điệp, giới hạn): `CHUAN-GIAO-TIEP.md`
> ở gốc repo — nguồn duy nhất, tệp này không chép lại.** Quy trình gửi: `QUY-TAC-GUI-GAME.md`.
> Ngôn ngữ giao diện game: tiếng Việt có dấu.

## 0. Tóm tắt 12 dòng
0. Việc là gì? Game MỚI → mục 0–8. Cập nhật game ĐÃ CÓ → thêm mục 9. Lỗi hệ thống/lõi hoặc game của người khác → KHÔNG viết mã: mở Issue
   (`QUY-TRINH-DONG-GOP.md` luồng 1, 4). Lỗi bảo mật → `SECURITY.md`, không công khai.
1. Mục tiêu: 1 thư mục `submissions/<id>/` chứa 1 game đúng chuẩn + 1 Pull Request chỉ đụng thư mục đó.
2. Bạn MUST chỉ tạo/sửa tệp trong `submissions/<id>/` (và nháp trong `devkit/games/<id>/`, đã bị `.gitignore`). MUST NOT sửa tệp nào khác.
3. `<id>` MUST khớp `^[a-z][a-z0-9-]{1,31}$`, MUST NOT nằm trong danh sách id cấm (mục 1).
4. Tạo khung bằng `node devkit/jagame.js new <id>` (từ gốc repo) rồi viết lại thành game CỦA BẠN. MUST NOT gửi bản đổi tên / biến thể nhỏ của
   game mẫu (`oantuti` oẳn tù tì, `nhatque` nhặt que kiểu Nim — gồm "đếm tới 21", `xucxac` gieo xúc xắc) hay của game chính thức: người duyệt từ chối.
5. Luật chơi `server/game.js`: `module.exports = JGCore.game({...})`, hàm thuần trên state JSON, tất định, ngẫu nhiên chỉ `ctx.rng()`.
6. Giao diện `client/index.js`: `JG.defineGame(function (game) { … })`, chỉ vẽ trong `game.root`, chỉ gửi nước bằng `game.send()`.
7. MUST NOT dùng API cấm (`CHUAN-GIAO-TIEP.md` mục 5.1, 6.5) — kể cả trong chuỗi; chữ `async`/`await` cấm kể cả trong chú thích.
8. MUST có `test/cases.json`, `README.md`, `LICENSE`.
9. Đọc `QUY-TAC-GUI-GAME.md` (R1–R16). Chạy lệnh mục 6 ĐÚNG THỨ TỰ; lặp sửa tới khi MỌI lệnh in dòng ĐẠT.
10. Gặp mã lỗi `[E_…]` → tra bảng mục 7, sửa đúng nguyên nhân, chạy lại từ lệnh trượt.
11. Chỉ khi `python3 devkit/check_pr.py --title … --body-file …` in `PR ĐẠT — giống workflow GitHub` mới push + mở PR (nhánh `gui-<id>`, tiêu đề + mô tả mục 8).
12. Không cần hỏi người dùng gì thêm (trừ tên + liên hệ tác giả khi repo chưa có remote / `user.name` — mục 8): mọi thứ cần biết nằm trong tệp này + `CHUAN-GIAO-TIEP.md` + mẫu `devkit/games/nhatque/` (theo lượt),
    `devkit/games/xucxac/` (nhiều người), `devkit/games/binhchon/` (ứng dụng không phải game).

## 1. Đặt tên
| Thứ | Luật |
|---|---|
| id game | MUST khớp `^[a-z][a-z0-9-]{1,31}$`: chữ thường a–z, số, `-`; bắt đầu bằng chữ; 2–32 ký tự. Ví dụ đúng: `bongbay`, `ca-ngua-2`, `dua-xe`. Sai: `BongBay`, `bong_bay`, `1game`, `x`. |
| Tiền tố cấm | MUST NOT bắt đầu bằng `local-` hoặc `jg-` |
| id cấm (đã có) | MUST NOT dùng: <!-- RESERVED_IDS -->
`bacay` `baimau` `banmaybay` `baucua` `bietdoi` `binhchon` `cangua` `caro` `chimbay` `chinquan` `chuyentranh` `cotuong` `coup` `covua` `datbom` `dovui` `ganh` `giaithe` `loto` `masoi` `nhatque` `oanquan` `oantuti` `phom` `poker` `tienlen` `vehinh` `xepgach` `xetang` `xidach` `xucxac`
<!-- /RESERVED_IDS --> (nguồn: `ai-rules.json` → `id.reserved_ids`, `devkit/tools/official_ids.json`) |
| Thư mục | MUST là `submissions/<id>/`, đúng bằng `manifest.json` → `"id"` |
| Tên tệp/thư mục | MUST chỉ gồm `A-Z a-z 0-9 . _ - @ +`; MUST NOT bắt đầu bằng `.`; phân biệt hoa/thường; tệp bắt buộc viết đúng như mục 2 (`manifest.json`, `README.md`, `LICENSE` — không `readme.md`, không `License`) |
| Tiền tố lớp CSS | SHOULD là 2–4 chữ viết tắt id + `-` (vd `bb-` cho `bongbay`), mọi lớp của game dùng tiền tố đó |

## 2. Cây thư mục bắt buộc
Đầy đủ (mục gốc cho phép, đuôi, giới hạn, icon SVG): **`CHUAN-GIAO-TIEP.md` mục 3**. MUST tối thiểu:
`submissions/<id>/{manifest.json, icon.svg|icon.png, server/game.js, client/index.js, test/cases.json, README.md, LICENSE}` (tùy chọn
`client/style.css`, `client/assets/…`, `screenshots/…`, `CHANGELOG.md`). MUST NOT: tệp chấm, symlink, `node_modules/`, `package.json`,
`assets/` ở gốc, `.ts .jsx .html .zip .exe .wasm`, ROM, nhị phân lạ, địa chỉ `http(s)://` ngoài `README.md`/`test/`.

## 3. Manifest
Bảng MỌI trường (kiểu, giới hạn, trường cấm trong bài gửi): **`CHUAN-GIAO-TIEP.md` mục 4**. Mẫu hợp lệ hoàn chỉnh: mục 12.1 (game theo lượt)
và mục 10.2 (ứng dụng không phải game). MUST: `"manifest": 2`, `"api": 1`, `"sdk": "2"`, `author`, `license`, đúng
`devkit/shared/sdk/manifest.schema.json`; MUST NOT thêm trường ngoài bảng, MUST NOT `homepage` `room` `resume` `teams` `action` `soon` `unlisted`.

## 4. Chuẩn giao tiếp
Nguồn duy nhất: **`CHUAN-GIAO-TIEP.md`** — luật/logic mục 5, giao diện mục 6, thông điệp mục 7. Khuôn MUST theo:
- `server/game.js` = `module.exports = JGCore.game({ kind, setup, moves, view, legal?, bot?, tick?, onResign? … })` — khuôn đầy đủ mục 5.2, ví dụ
  chạy được mục 12.2. State JSON thuần, tất định; ngẫu nhiên CHỈ `ctx.rng()`, thời gian CHỈ `ctx.now`.
- MUST NOT API cấm (bộ quét đọc cả chuỗi): danh sách mục 5.1 (server) và 6.5 (client); chữ `async`/`await` cấm kể cả trong chú thích.
- `view(s, you, v)` MUST NOT lộ bí mật của ghế khác / người xem (mục 5.6). Kết thúc bằng `JGCore.end` / `endByScore`, `reason` thuộc
  `devkit/shared/sdk/reasons.json` hoặc `manifest.reasons` (mục 5.7). Ứng dụng không thắng thua: MUST `JGCore.game({scored: false, …})` +
  `JGCore.end(s, {scored: false, reason})` ("Xong phiên", không tính điểm — mục 5.7, 10); MUST NOT chia thắng giả.
- Gói cộng đồng: chữ trong nước đi đi qua bộ lọc từ của hội quán (có thể thành `***` hoặc cả nước bị từ chối — mục 5.4). MUST NOT dùng chữ
  người gõ làm khóa đối tượng; giữ nước đi phẳng (≤ 8 tầng, ≤ 256 chuỗi).
- `client/index.js` = `JG.defineGame(function (game) { … return { destroy }; })` — đối tượng `game`, `JGUI`, biến CSS: mục 6; ví dụ mục 12.3.
  MUST: chữ người dùng qua `JGUI.esc()`, chỉ biến CSS của khung, vùng bấm ≥ 44 px, không tràn ngang ở 360 px, `prefers-reduced-motion`.
- Giới hạn (mục 5.10, 7): mỗi lần gọi ≤ 150 ms (`bot`/`hint` 250), `server/game.js` sau gộp SDK ≤ 256 KB, state/view ≤ 256 KB, nước đi ≤ 2 KB,
  `tick_ms` ≥ 250, ≤ ~8 nước/giây.

## 5. `test/cases.json` (MUST)
Định dạng + ca bắt buộc: **`CHUAN-GIAO-TIEP.md` mục 8**; ví dụ đầy đủ mục 12.4 và 10.2. MUST có ca: khai cuộc, luật chính, ≥ 3 lỗi (sai lượt /
sai pha, nước rác, ghế lạ), rời ván 2 người, (có bí mật) view ghế khác + người xem không thấy bí mật. `error` = chuỗi con, MUST NOT `""`.
SHOULD có 1 ca chơi tới kết thúc; kết quả phụ thuộc giá trị ngẫu nhiên ẩn thì MAY bỏ ca đó và ghi 1 dòng lý do trong mô tả PR (200 ván ngẫu
nhiên của bộ kiểm là bằng chứng kết thúc).

## 6. Trình tự lệnh — ĐÚNG 7 lệnh, ĐÚNG THỨ TỰ, từ GỐC repo, lặp tới khi các bước ✱ ĐẠT
Giống hệt QUY-TAC-GUI-GAME.md R10 (cùng sinh từ `ai-rules.json` → `commands`):
<!-- COMMANDS -->
| # | Lệnh (từ gốc repo) | ĐẠT khi in | Ghi chú |
|---|---|---|---|
| 1 | `node devkit/jagame.js new <id> --name "<Tên>" --author "<Tác giả>"` | `Đã tạo` | rồi viết lại thành gói CỦA BẠN trong `devkit/games/<id>/`; trong lúc viết chạy `node devkit/jagame.js check <id>` bao nhiêu lần cũng được |
| 2 | `node devkit/jagame.js shot <id>` | `Ảnh chụp:` | tùy chọn, cần Playwright; mã thoát 2 = không có -> tự chụp theo hướng dẫn in ra, hoặc ghi lý do ở mục Ảnh của PR |
| 3 | `node devkit/jagame.js submit <id>` | `Đã chép sang` | chép `devkit/games/<id>/` -> `submissions/<id>/` |
| 4 | `git checkout -b gui-<id> && git add submissions/<id> && git commit -m "Gửi game <id> v<version>"` | — | `git status` sạch (trừ `devkit/games/`); sửa lại thì: sửa nháp -> bước 3 -> `git commit` -> chạy lại từ bước 5 |
| 5 ✱ | `node devkit/jagame.js check <id>` | `KẾT QUẢ: ĐẠT — 0 lỗi` | kiểm `submissions/<id>/` (báo lỗi nếu bản nháp khác bài gửi) |
| 6 ✱ | `python3 devkit/check_submission.py submissions/<id>` | `KẾT QUẢ: ĐẠT — 0 lỗi` | đọc từng dòng LƯU Ý: innerHTML bình thường NẾU mọi chữ người dùng đã qua `JGUI.esc()`; thiếu `screenshots/` được phép. Sau bước này viết mô tả PR vào `devkit/games/pr-<id>.md` (KHÔNG commit) |
| 7 ✱ | `python3 devkit/check_pr.py --title "[Gửi game] <id> v<version> — <Tên>" --body-file devkit/games/pr-<id>.md` | `PR ĐẠT — giống workflow GitHub` | ứng dụng: tiêu đề `[Gửi ứng dụng] …`. Lần đầu có thể TRƯỢT E_PR_BODY vì chưa có dòng PR ĐẠT của chính nó: chạy `python3 devkit/check_pr.py` (không tham số), dán đầu ra vào mục "Kết quả 3 lệnh", chạy lại |
<!-- /COMMANDS -->
MUST NOT mở PR khi còn bất kỳ dòng `TRƯỢT`. MUST NOT commit `devkit/games/pr-<id>.md`.

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
| `E_BRANCH_NAME` | nhánh PR không phải gui-<id> | git branch -m gui-<id> (đổi tên nhánh hiện tại) rồi push lại |
| `E_PR_TITLE` | tiêu đề PR sai mẫu "[Gửi game] <id> v<version> — <Tên game>" hoặc lệch manifest (id/version/name) | sửa tiêu đề PR đúng từng ký tự; dấu — là gạch dài (U+2014); version/name lấy đúng từ manifest.json |
| `E_PR_BODY` | mô tả PR thiếu/để trống mục bắt buộc, ô xác nhận chưa [x], thiếu kết quả 3 lệnh hoặc ảnh chụp | dán đúng mẫu .github/pull_request_template.md, điền đủ 9 mục ##, dán nguyên đầu ra 3 lệnh, thêm ảnh hoặc đường dẫn screenshots/<tệp>.png |
| `E_NOT_OWNER` | PR sửa game đã có chủ (submissions/OWNERS.json) nhưng người mở PR không phải tác giả gốc | không gửi PR cho game của người khác: mở Issue gắn @tác-giả hoặc PR vào bản fork của tác giả; tác giả bỏ > 90 ngày → Issue xin tiếp quản (QUY-TRINH-DONG-GOP.md luồng 4) |
| `E_CHANGELOG` | bản cập nhật thiếu submissions/<id>/CHANGELOG.md hoặc CHANGELOG.md chưa ghi phiên bản mới | thêm CHANGELOG.md, mục '## <version>' mô tả thay đổi (ghi rõ nếu đổi luật thắng/thua) |
<!-- /ERROR_CODES -->

## 8. Checklist cuối + mẫu PR
- [ ] `git diff --name-only <nhánh gốc>...HEAD` chỉ có `submissions/<id>/…`
- [ ] Bước 2, 5, 7 mục 6 đều ĐẠT; đã đọc mọi dòng `LƯU Ý`
- [ ] `manifest.name/desc/howto`, `README.md`, icon, giao diện đều là của game MỚI (không còn chữ "Oẳn tù tì"/"oantuti")
- [ ] `README.md` có: mô tả, luật chơi, tác giả, giấy phép mã, nguồn + giấy phép tài sản (hoặc "tự vẽ bằng SVG/CSS")
- [ ] Không nhân vật / tên / hình / nhạc có bản quyền; không ROM; không tiền thật; nội dung hợp gia đình 8+ tuổi
- [ ] `view` không lộ bí mật; mọi tên người chơi qua `JGUI.esc` (đã soát từng dòng `innerHTML` mà bộ kiểm nêu)
- [ ] Không push lên `main`; PR mở từ nhánh `gui-<id>` của bản fork

**Tên nhánh:** `gui-<id>` (`E_BRANCH_NAME`). **Tiêu đề PR:** `[Gửi game] <id> v<version> — <Tên game>` (ứng dụng: `[Gửi ứng dụng] <id> v<version> — <Tên>`) — `version`, `Tên game` lấy NGUYÊN từ
manifest, `—` là gạch dài U+2014 (vd `[Gửi game] bongbay v0.1.0 — Bóng bay`; `E_PR_TITLE`).
**Mô tả PR** = `.github/pull_request_template.md` điền ĐỦ 9 mục `##`, không còn chỗ `<…>` (`E_PR_BODY`). Ví dụ đầy đủ:
~~~markdown
## Tên game
Bóng bay (id `bongbay`, phiên bản `0.1.0`, bản mới)

## Mô tả ngắn
Lần lượt bơm bóng 1–3 hơi, ai làm bóng nổ là thua.

## Số người chơi
2–4

## Tác giả và liên hệ
Nguyễn Văn A — @nguyenvana (GitHub)

## Giấy phép (mã + tài sản)
Mã: MIT · Tài sản: tự vẽ bằng SVG/CSS, MIT

## Nguồn ảnh và âm thanh
Tự vẽ bằng SVG/CSS; chỉ dùng âm có sẵn của khung (game.sound), không có tệp âm riêng.

## Xác nhận
- [x] Tôi (hoặc AI tôi dùng) tự viết mã; không dùng nhân vật, hình, nhạc, phông, tên có bản quyền của người khác; không ROM
- [x] Nội dung hợp gia đình 8+ tuổi; không tiền thật, không quảng cáo, không thu thập dữ liệu
- [x] PR chỉ đụng submissions/bongbay/ trên nhánh gui-bongbay
- [x] Tôi đồng ý cho Jagame phân phối game theo giấy phép đã ghi

## Kết quả 3 lệnh
```
$ node devkit/jagame.js check bongbay
KẾT QUẢ: ĐẠT — 0 lỗi
$ python3 devkit/check_submission.py submissions/bongbay
KẾT QUẢ: ĐẠT — 0 lỗi, 2 lưu ý
$ python3 devkit/check_pr.py
PR ĐẠT — giống workflow GitHub
```

## Ảnh chụp màn hình
submissions/bongbay/screenshots/1.png · submissions/bongbay/screenshots/2.png
~~~
`## Tác giả và liên hệ`: MUST là tên + liên hệ của NGƯỜI GỬI (lấy `git config user.name`, tài khoản GitHub của bản fork / `git remote -v`). Chưa có remote, chưa có `user.name` hoặc không chắc → MUST DỪNG và HỎI người dùng (đây là chỗ DUY NHẤT được hỏi); MUST NOT bịa, đoán hay chép email, số điện thoại từ ngữ cảnh khác.
Ghi chú thêm (SHOULD, đặt cuối mục "Mô tả ngắn"): "Viết bởi AI agent <tên công cụ>; người gửi chịu trách nhiệm nội dung"; lý do bỏ ca kiểm hết ván (mục 5) nếu có.

## 9. Cập nhật game đã có (QUY-TRINH-DONG-GOP.md luồng 3–4)
- MUST kiểm chủ trước: `submissions/OWNERS.json` → `owners["<id>"]`. Khác tài khoản GitHub của người dùng → MUST NOT viết bản cập nhật; mở Issue mẫu
  `bao-loi.md`/`yeu-cau-tinh-nang.md` gắn `@<chủ>` (`E_NOT_OWNER` nếu cố gửi PR). Game chính thức (id trong danh sách cấm mục 1) → chỉ Issue.
- MUST gửi lại ĐỦ thư mục `submissions/<id>/` (bản cũ không nằm trong `main`; lấy từ bản fork / máy người dùng), tăng `version` (semver),
  cập nhật `changelog` + `news` trong manifest, và có `submissions/<id>/CHANGELOG.md` chứa mục `## <version mới>` (`E_CHANGELOG`).
- MUST giữ tương thích: không đổi dạng state, tên loại nước đi, khóa tùy chọn đang dùng (ván cờ thư / ván lưu chạy theo bản cũ được ghim).
- Đổi luật thắng/thua/tính điểm → MUST ghi rõ ở mục "Mô tả ngắn" của PR.
- `check_pr.py` tự kiểm chủ (đọc `submissions/OWNERS.json` của nhánh gốc; tài khoản lấy từ remote `origin` hoặc `--author <login>`).
