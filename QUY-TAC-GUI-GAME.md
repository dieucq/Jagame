# Quy tắc gửi game — ĐỌC TRƯỚC KHI GỬI

Trang này là luật **quy trình gửi** duy nhất cho **cả người lẫn AI agent**. Làm đúng R1 → R16 theo thứ tự.

| Câu hỏi | Nguồn sự thật |
|---|---|
| Gói, manifest, hàm, đối tượng `game`, thông điệp, giới hạn | [`CHUAN-GIAO-TIEP.md`](CHUAN-GIAO-TIEP.md) |
| Nhánh, tiêu đề, mô tả PR, 3 lệnh kiểm, duyệt, từ chối | **trang này** |
| Regex, giới hạn, API cấm, mã lỗi dạng máy đọc | [`developers/ai-rules.json`](developers/ai-rules.json) |
| Từng bước cho AI agent | [`developers/AI-RULES.md`](developers/AI-RULES.md) |

Mỗi lỗi máy kiểm in kèm mã `[E_…]` — bảng sửa ở CHUAN-GIAO-TIEP.md mục 13 (= AI-RULES.md mục 7).

## A. Tên
**R1. Mã game (`<id>`) khớp `^[a-z][a-z0-9-]{1,31}$`, không trùng game có sẵn.** ✓ `bongbay`, `dua-xe` · ✗ `BongBay`, `bong_bay`, `1game`, `caro`
(danh sách id cấm: AI-RULES.md mục 1). Mã lỗi `E_ID_INVALID`, `E_ID_TAKEN`, `E_ID_RESERVED`.

**R2. Thư mục gửi là `submissions/<id>/` và `manifest.json` → `"id"` đúng bằng `<id>`.** ✓ `submissions/bongbay/` + `"id": "bongbay"` ·
✗ `submissions/BongBay/`, `games/bongbay/`, `submissions/bongbay/bongbay/`. Mã `E_ID_MISMATCH`.

**R3. Nhánh là `gui-<id>`.** ✓ `gui-bongbay` · ✗ `main`, `bongbay`, `feature/bongbay`. Mã `E_BRANCH_NAME`.

**R4. Tiêu đề PR đúng mẫu `[Gửi game] <id> v<version> — <Tên game>` (ứng dụng không phải game được dùng `[Gửi ứng dụng] <id> v<version> — <Tên>`), `version` và `Tên game` lấy NGUYÊN từ manifest, dấu `—` là gạch dài.**
✓ `[Gửi game] bongbay v0.1.0 — Bóng bay` · ✗ `Gửi game bongbay`, `[Gửi game] bongbay 0.1.0 - Bóng bay`. Mã `E_PR_TITLE`.

**R5. Phiên bản theo semver `X.Y.Z`; bản đầu `0.1.0`, mỗi lần gửi lại PHẢI tăng.** ✓ `0.1.0 → 0.1.1 → 0.2.0` · ✗ `1.0`, `v1`, gửi lại vẫn `0.1.0`.

## B. Thư mục
**R6. Cây bắt buộc** (✱ = bắt buộc, còn lại tùy chọn; đầy đủ ở CHUAN-GIAO-TIEP.md mục 3):
```
submissions/<id>/
├── manifest.json ✱      ├── client/index.js ✱      ├── test/cases.json ✱     ├── LICENSE ✱
├── icon.svg ✱           ├── client/style.css       ├── README.md ✱           └── screenshots/1.png, 2.png
├── server/game.js ✱     ├── client/assets/…
```
Cấm: tệp/thư mục bắt đầu bằng `.`, symlink, `node_modules/`, `assets/` ở gốc, ROM, nhị phân lạ, `.zip .exe .html .ts`. Mã `E_DOTFILE` `E_SYMLINK` `E_FILE_TYPE` `E_FAKE_BINARY`.

**R7. Chỉ được chạm `submissions/<id>/**`; không sửa bất kỳ tệp nào khác.** ✓ PR chỉ có `submissions/bongbay/…` · ✗ PR có `README.md`,
`devkit/…`, `.github/…`. Bảng đầy đủ: CHUAN-GIAO-TIEP.md mục 9. Mã `E_PATH_OUTSIDE`.

**R8. Mỗi PR đúng 1 game.** ✓ 1 PR = `submissions/bongbay/` · ✗ 1 PR có `submissions/bongbay/` + `submissions/duaxe/`. Mã `E_MULTI_GAME`.

## C. Chuẩn giao tiếp (tóm tắt — đầy đủ và chính thức ở [`CHUAN-GIAO-TIEP.md`](CHUAN-GIAO-TIEP.md))
**R9. Gói (game hoặc ứng dụng) làm đúng chuẩn giao tiếp — 8 điều tối thiểu:**
1. Tạo bằng `node devkit/jagame.js new <id>`, viết lại thành game của bạn (không đổi tên game mẫu).
2. `manifest.json` có `"manifest": 2`, `"api": 1`, `"sdk": "2"`, `author`, `license`, đúng schema.
3. `server/game.js` = `module.exports = JGCore.game({ setup, moves, view, legal, bot? })`, state JSON thuần, tất định.
4. Ngẫu nhiên chỉ `ctx.rng()`, thời gian chỉ `ctx.now`.
5. Cấm `require import process Date Promise Proxy Reflect eval Function setTimeout` TypedArray, và chữ `async`/`await` ở bất cứ đâu (`E_FORBIDDEN_API`).
6. `client/index.js` = `JG.defineGame(function (game) {…})`, chỉ vẽ trong `game.root`, gửi nước bằng `game.send()` (JSON ≤ 2 KB), không mạng/`localStorage` (`E_FORBIDDEN_API_CLIENT`).
7. `view(s, you, v)` không lộ bí mật của ghế khác / người xem; mọi tên người chơi qua `JGUI.esc()`.
8. Mỗi lần gọi ≤ 150 ms (bot 250 ms), `server/game.js` sau gộp SDK ≤ 256 KB, chỉ biến CSS của khung, nút ≥ 44 px.

## D. Trước khi gửi
**R10. Trình tự gửi = ĐÚNG 7 lệnh dưới, từ gốc repo, theo thứ tự. 3 lệnh kiểm ✱ (bước 5, 6, 7) PHẢI ĐẠT.** Bảng này sinh từ
`developers/ai-rules.json` → `commands` và giống hệt ở AI-RULES.md mục 6 — mọi tài liệu khác chỉ trỏ về đây.
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

Có `TRƯỢT [E_…]` → sửa theo CHUAN-GIAO-TIEP.md mục 13 → chạy lại từ bước 5. Không mở PR khi còn 1 dòng TRƯỢT.

**R11. Mô tả PR (viết vào `devkit/games/pr-<id>.md` — KHÔNG commit — rồi dán vào ô mô tả trên GitHub) dùng mẫu `.github/pull_request_template.md` và điền ĐỦ 9 mục:**
`## Tên game` · `## Mô tả ngắn` · `## Số người chơi` · `## Tác giả và liên hệ` · `## Giấy phép (mã + tài sản)` · `## Nguồn ảnh và âm thanh` ·
`## Xác nhận` (mọi ô `[x]`: tự viết, không bản quyền người khác, hợp gia đình, đồng ý phân phối) · `## Kết quả 3 lệnh` (dán nguyên đầu ra) ·
`## Ảnh chụp màn hình` (ảnh, hoặc `submissions/<id>/screenshots/1.png` — tạo bằng `node devkit/jagame.js shot <id>`). Không để `<…>` chưa điền. Mã `E_PR_BODY`.
`## Tác giả và liên hệ` chỉ ghi tên + liên hệ CỦA NGƯỜI GỬI: tên trong `git config user.name` + tài khoản GitHub sở hữu bản fork (`git remote -v`). **Chưa có remote, chưa đặt `user.name`, hay không chắc → AI agent DỪNG và HỎI người dùng** muốn ghi tên + liên hệ gì (gợi ý: tên + `@tài-khoản-GitHub`); MUST NOT tự bịa, đoán, hay chép email/số điện thoại từ nơi khác, MUST NOT để chỗ `<…>`.

## E. Sau khi gửi
**R12. Máy kiểm GitHub chạy lại R1–R11 trên PR; đỏ thì sửa và push tiếp vào cùng nhánh** (sửa tiêu đề/mô tả cũng được kiểm lại).

**R13. Chủ kho duyệt tay (đọc mã, chơi thử), KHÔNG merge PR: game được ký hạng Cộng đồng, lên Chợ game, rồi PR được đóng kèm ghi chú
"đã phát hành v<version>".** Thường trong khoảng 7 ngày. Game chỉ hiện ở hội quán bật "Game cộng đồng"; admin từng hội quán tự quyết cài.

**R14. Gửi bản cập nhật = PR MỚI, cùng `<id>`, nhánh `gui-<id>`, `version` tăng (R5), ghi `changelog` + `news`.**

**R15. Bị từ chối khi: máy kiểm báo `E_…` (AI-RULES.md mục 7), hoặc khi duyệt tay thấy vi phạm R16, lộ bí mật trong `view`, vỡ giao diện điện thoại, bot quá chậm, hay trùng game đã có.**

## F. Cấm tuyệt đối
**R16. Không bao giờ:** đụng thư mục khác ngoài `submissions/<id>/` · mã độc, đào coin, cố thoát khu cách ly, thu thập dữ liệu, gọi mạng, quảng cáo ·
nội dung người lớn, bạo lực ghê rợn, thù ghét, cờ bạc tiền thật (chỉ "đậu ảo") · nhân vật/hình/nhạc/phông/tên có bản quyền của người khác · ROM, BIOS, game thương mại.
Vi phạm R16 = từ chối, có thể chặn tài khoản gửi.

---
## English summary
Read before submitting; the programming interface (package, manifest, functions, messages, limits) is defined only in
`CHUAN-GIAO-TIEP.md`. **R1** game id matches `^[a-z][a-z0-9-]{1,31}$`, not an existing id. **R2** folder `submissions/<id>/`, `manifest.id` = `<id>`.
**R3** branch `gui-<id>`. **R4** PR title exactly `[Gửi game] <id> v<version> — <Game name>` (apps may use `[Gửi ứng dụng] …`) (version/name from manifest, em dash). **R5** semver, bump on
every resubmission. **R6** required tree: `manifest.json icon.svg server/game.js client/index.js test/cases.json README.md LICENSE` (optional
`client/style.css client/assets/ screenshots/`); no dotfiles, symlinks, `node_modules`, ROMs, unknown binaries. **R7** touch only `submissions/<id>/**`.
**R8** one game per PR. **R9** follow the interface standard (`CHUAN-GIAO-TIEP.md`): `JGCore.game({...})` pure deterministic rules, `ctx.rng()`/`ctx.now`
only, no `require/import/process/Date/Promise/Proxy/eval/Function`/timers/TypedArrays, no `async`/`await` anywhere; client `JG.defineGame`, no network;
`view` hides secrets; ≤ 150 ms per call, bundled server ≤ 256 KB. **R10** run the 7 commands of the canonical list in order (`developers/ai-rules.json` → `commands`); the 3 checks must pass: `node devkit/jagame.js check <id>` → `KẾT QUẢ: ĐẠT — 0 lỗi`;
`python3 devkit/check_submission.py submissions/<id>` → `KẾT QUẢ: ĐẠT — 0 lỗi, N lưu ý`; `python3 devkit/check_pr.py --title "…" --body-file devkit/games/pr-<id>.md` →
`PR ĐẠT — giống workflow GitHub`. **R11** PR body = template with all 9 sections filled (name, short description, players, author + contact,
licenses, asset sources, confirmations all ticked, pasted output of the 3 commands, screenshots). **R12–R15** the PR bot re-checks; the maintainer
reviews, does NOT merge, signs it Community tier and publishes it (about 7 days); updates = new PR with a higher version; rejections cite `E_…` codes.
**R16** never: touch other folders, malware/miners/data collection/network calls/ads, adult/violent/hateful content, real-money gambling,
copyrighted characters/art/music/fonts/brands, ROMs.
