# Quy tắc gửi game — ĐỌC TRƯỚC KHI GỬI

Trang này là luật duy nhất cho **cả người lẫn AI agent**. Làm đúng R1 → R16 theo thứ tự. Chi tiết kỹ thuật: [`developers/AI-RULES.md`](developers/AI-RULES.md)
(bản máy đọc `developers/ai-rules.json`). Mỗi lỗi máy kiểm in kèm mã `[E_…]` — bảng sửa ở AI-RULES.md mục 7.

## A. Tên
**R1. Mã game (`<id>`) khớp `^[a-z][a-z0-9-]{1,31}$`, không trùng game có sẵn.** ✓ `bongbay`, `dua-xe` · ✗ `BongBay`, `bong_bay`, `1game`, `caro`
(danh sách id cấm: AI-RULES.md mục 1). Mã lỗi `E_ID_INVALID`, `E_ID_TAKEN`, `E_ID_RESERVED`.

**R2. Thư mục gửi là `submissions/<id>/` và `manifest.json` → `"id"` đúng bằng `<id>`.** ✓ `submissions/bongbay/` + `"id": "bongbay"` ·
✗ `submissions/BongBay/`, `games/bongbay/`, `submissions/bongbay/bongbay/`. Mã `E_ID_MISMATCH`.

**R3. Nhánh là `gui-<id>`.** ✓ `gui-bongbay` · ✗ `main`, `bongbay`, `feature/bongbay`. Mã `E_BRANCH_NAME`.

**R4. Tiêu đề PR đúng mẫu `[Gửi game] <id> v<version> — <Tên game>`, `version` và `Tên game` lấy NGUYÊN từ manifest, dấu `—` là gạch dài.**
✓ `[Gửi game] bongbay v0.1.0 — Bóng bay` · ✗ `Gửi game bongbay`, `[Gửi game] bongbay 0.1.0 - Bóng bay`. Mã `E_PR_TITLE`.

**R5. Phiên bản theo semver `X.Y.Z`; bản đầu `0.1.0`, mỗi lần gửi lại PHẢI tăng.** ✓ `0.1.0 → 0.1.1 → 0.2.0` · ✗ `1.0`, `v1`, gửi lại vẫn `0.1.0`.

## B. Thư mục
**R6. Cây bắt buộc** (✱ = bắt buộc, còn lại tùy chọn):
```
submissions/<id>/
├── manifest.json ✱      ├── client/index.js ✱      ├── test/cases.json ✱     ├── LICENSE ✱
├── icon.svg ✱           ├── client/style.css       ├── README.md ✱           └── screenshots/1.png, 2.png
├── server/game.js ✱     ├── client/assets/…
```
Cấm: tệp/thư mục bắt đầu bằng `.`, symlink, `node_modules/`, `assets/` ở gốc, ROM, nhị phân lạ, `.zip .exe .html .ts`. Mã `E_DOTFILE` `E_SYMLINK` `E_FILE_TYPE` `E_FAKE_BINARY`.

**R7. Chỉ được chạm `submissions/<id>/**`; không sửa bất kỳ tệp nào khác.** ✓ PR chỉ có `submissions/bongbay/…` · ✗ PR có `README.md`,
`devkit/…`, `.github/…`. Mã `E_PATH_OUTSIDE`.

**R8. Mỗi PR đúng 1 game.** ✓ 1 PR = `submissions/bongbay/` · ✗ 1 PR có `submissions/bongbay/` + `submissions/duaxe/`. Mã `E_MULTI_GAME`.

## C. Chuẩn giao tiếp (tóm tắt — đầy đủ ở AI-RULES.md mục 3–5)
**R9. Game làm đúng 8 điều:**
1. Tạo bằng `node devkit/jagame.js new <id>`, viết lại thành game của bạn (không đổi tên game mẫu).
2. `manifest.json` có `"manifest": 2`, `"api": 1`, `"sdk": "2"`, `author`, `license`, đúng schema.
3. `server/game.js` = `module.exports = JGCore.game({ setup, moves, view, legal, bot? })`, state JSON thuần, tất định.
4. Ngẫu nhiên chỉ `ctx.rng()`, thời gian chỉ `ctx.now`.
5. Cấm `require import process Date Promise Proxy Reflect eval Function setTimeout` TypedArray, và chữ `async`/`await` ở bất cứ đâu (`E_FORBIDDEN_API`).
6. `client/index.js` = `JG.defineGame(function (game) {…})`, chỉ vẽ trong `game.root`, gửi nước bằng `game.send()`, không mạng/`localStorage` (`E_FORBIDDEN_API_CLIENT`).
7. `view(s, you, v)` không lộ bí mật của ghế khác / người xem; mọi tên người chơi qua `JGUI.esc()`.
8. Mỗi lần gọi ≤ 150 ms (bot 250 ms), `server/game.js` sau gộp SDK ≤ 256 KB, chỉ biến CSS của khung, nút ≥ 44 px.

## D. Trước khi gửi
**R10. Chạy đúng 3 lệnh từ gốc repo, theo thứ tự, và CẢ 3 phải ĐẠT** (sau khi `node devkit/jagame.js submit <id>` và commit lên nhánh `gui-<id>`):

| Lệnh | Dòng mong đợi |
|---|---|
| `node devkit/jagame.js check <id>` | `KẾT QUẢ: ĐẠT — 0 lỗi` |
| `python3 devkit/check_submission.py submissions/<id>` | `KẾT QUẢ: ĐẠT — 0 lỗi, N lưu ý` |
| `python3 devkit/check_pr.py --title "<tiêu đề R4>" --body-file devkit/games/pr-<id>.md` | `PR ĐẠT — giống workflow GitHub` |

Có `TRƯỢT [E_…]` → sửa theo AI-RULES.md mục 7 → chạy lại cả 3. Không mở PR khi còn 1 dòng TRƯỢT. Thứ tự đầy đủ từng bước: AI-RULES.md mục 6.

**R11. Mô tả PR (viết vào `devkit/games/pr-<id>.md` — KHÔNG commit — rồi dán vào ô mô tả trên GitHub) dùng mẫu `.github/pull_request_template.md` và điền ĐỦ 9 mục:**
`## Tên game` · `## Mô tả ngắn` · `## Số người chơi` · `## Tác giả và liên hệ` · `## Giấy phép (mã + tài sản)` · `## Nguồn ảnh và âm thanh` ·
`## Xác nhận` (mọi ô `[x]`: tự viết, không bản quyền người khác, hợp gia đình, đồng ý phân phối) · `## Kết quả 3 lệnh` (dán nguyên đầu ra) ·
`## Ảnh chụp màn hình` (ảnh, hoặc `submissions/<id>/screenshots/1.png` — tạo bằng `node devkit/jagame.js shot <id>`). Không để `<…>` chưa điền. Mã `E_PR_BODY`.
`## Tác giả và liên hệ` chỉ ghi tên + liên hệ CỦA NGƯỜI GỬI (vd tên trong `git config user.name` + tài khoản GitHub sở hữu bản fork); AI agent MUST NOT tự bịa hay chép email/số điện thoại từ nơi khác — không biết thì ghi `@<tài khoản GitHub>` của bản fork.

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
Read before submitting. **R1** game id matches `^[a-z][a-z0-9-]{1,31}$`, not an existing id. **R2** folder `submissions/<id>/`, `manifest.id` = `<id>`.
**R3** branch `gui-<id>`. **R4** PR title exactly `[Gửi game] <id> v<version> — <Game name>` (version/name from manifest, em dash). **R5** semver, bump on
every resubmission. **R6** required tree: `manifest.json icon.svg server/game.js client/index.js test/cases.json README.md LICENSE` (optional
`client/style.css client/assets/ screenshots/`); no dotfiles, symlinks, `node_modules`, ROMs, unknown binaries. **R7** touch only `submissions/<id>/**`.
**R8** one game per PR. **R9** follow the game contract (`developers/AI-RULES.md`): `JGCore.game({...})` pure deterministic rules, `ctx.rng()`/`ctx.now`
only, no `require/import/process/Date/Promise/Proxy/eval/Function`/timers/TypedArrays, no `async`/`await` anywhere; client `JG.defineGame`, no network;
`view` hides secrets; ≤ 150 ms per call, bundled server ≤ 256 KB. **R10** run and pass: `node devkit/jagame.js check <id>` → `KẾT QUẢ: ĐẠT — 0 lỗi`;
`python3 devkit/check_submission.py submissions/<id>` → `KẾT QUẢ: ĐẠT — 0 lỗi, N lưu ý`; `python3 devkit/check_pr.py --title "…" --body-file devkit/games/pr-<id>.md` →
`PR ĐẠT — giống workflow GitHub`. **R11** PR body = template with all 9 sections filled (name, short description, players, author + contact,
licenses, asset sources, confirmations all ticked, pasted output of the 3 commands, screenshots). **R12–R15** the PR bot re-checks; the maintainer
reviews, does NOT merge, signs it Community tier and publishes it (about 7 days); updates = new PR with a higher version; rejections cite `E_…` codes.
**R16** never: touch other folders, malware/miners/data collection/network calls/ads, adult/violent/hateful content, real-money gambling,
copyrighted characters/art/music/fonts/brands, ROMs.
