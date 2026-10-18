> **Đọc trước:** [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](../developers/ai-rules.json) — luật máy đọc.

# Gửi game lên Chợ game Jagame

> **English summary.** Submit a game by opening a **Pull Request** that adds or changes files **only** inside one folder
> `submissions/<game-id>/` (one game per PR). Run `python3 devkit/check_submission.py submissions/<game-id>` locally first; the same check
> runs automatically on the PR. Anything outside that folder, two games in one PR, a bad manifest, forbidden APIs (`require`, `fs`, `Date`,
> `Promise`…), oversized packages, missing `README.md`/`LICENSE`, unknown binaries/ROMs, dotfiles or symlinks are **rejected automatically**.
> A maintainer then plays it, signs it as **community** tier and publishes it; each clubhouse admin decides whether to install it.
> The official interface standard is [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) (English summary at its end); the binding submission
> rules are [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md).

## 1. Cách gửi chính thức: Pull Request vào `submissions/<game-id>/`
- Mỗi PR **chỉ 1 game**, **chỉ** thêm/sửa/xóa tệp trong `submissions/<game-id>/`. Đụng bất kỳ tệp nào khác (kể cả `README.md` gốc,
  `devkit/`, `.github/`) → PR bị chặn tự động.
- `<game-id>` = `manifest.id`, theo đúng quy tắc trong `devkit/shared/sdk/manifest.schema.json`: `^[a-z][a-z0-9-]{1,31}$` (chữ thường, số,
  gạch ngang, 2–32 ký tự, bắt đầu bằng chữ), không bắt đầu `local-`/`jg-`, không trùng game chính thức (`devkit/tools/official_ids.json`).
- Cập nhật game của chính bạn: PR mới sửa cùng thư mục, tăng `version` + ghi `changelog`/`news`.

**Cấu trúc gói** (cây thư mục, tệp bắt buộc, giới hạn): [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) mục 3.

**Issue "Gửi game"** chỉ dùng để hỏi đáp, xin góp ý ý tưởng, hoặc khi bạn thật sự không dùng được Pull Request (đính kèm gói `.jgsrc.zip`
do `node devkit/jagame.js pack <id>` tạo). Đường Issue chậm hơn vì chủ kho phải tự chép vào `submissions/`.

## 2. Các bước
1. **Fork** `phamduybk/Jagame` trên GitHub, clone bản fork về máy.
2. **Chạy đúng 7 lệnh của [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) R10** (tạo gói → chụp ảnh → `submit` → nhánh `gui-<game-id>` + commit →
   3 lệnh kiểm ✱). Giữa lệnh 6 và 7 viết mô tả PR vào `devkit/games/pr-<game-id>.md` (đã `.gitignore`) theo `.github/pull_request_template.md` (R11).
3. `git push -u origin gui-<game-id>`, trên GitHub bấm **Compare & pull request**: tiêu đề đúng mẫu R4, dán nội dung `pr-<game-id>.md` vào ô mô tả.
4. **Máy kiểm tự động** chạy trên PR (vài phút). Đỏ → đọc log bước bị trượt, sửa, push tiếp vào cùng nhánh.
5. **Chủ kho duyệt:** đọc mã, chơi thử nhiều người trên điện thoại, kiểm nội dung + bản quyền; có thể nhờ sửa qua bình luận PR.
6. **Ký + phát hành:** chủ kho đóng gói lại từ mã nguồn, ký hạng **`community`** và đưa lên Chợ game. PR được đóng kèm ghi chú
   "đã phát hành v`<version>`" (không merge vào `main` — bản gửi đã vào kho phát hành; bản cập nhật sau lại mở PR thư mục đầy đủ). Game chỉ hiện ở hội quán có bật **"Game cộng đồng"**; **admin từng hội quán tự quyết cài hay không**. Game cộng đồng
   không bao giờ tự cài; đã cài thì tự cập nhật khi có bản mới.

## 3. Bị từ chối tự động nếu
Mỗi lỗi in kèm mã ổn định `[E_…]` — bảng mã đầy đủ ở [AI-RULES.md](AI-RULES.md) mục 7.

| Vi phạm | Cách sửa |
|---|---|
| PR đụng tệp ngoài `submissions/<game-id>/` (kể cả `README.md` gốc, `devkit/`, `.github/`) | tách thay đổi đó ra, PR chỉ chứa thư mục game |
| PR có từ 2 game trở lên | mỗi game 1 PR |
| Tên thư mục / id không hợp lệ, trùng game chính thức, khác `manifest.id` | đổi id theo `^[a-z][a-z0-9-]{1,31}$`, xem `devkit/tools/official_ids.json` |
| `manifest.json` sai schema v2 (thiếu `"manifest": 2`, trường lạ, sai kiểu, thiếu `author`/`license`) | `node devkit/jagame.js check <id>` chỉ đúng chỗ |
| Dùng API ngoài chuẩn giao tiếp — luật chơi: `require`, `import`, `fs`, `process`, `Date`, `Promise`, `setTimeout`, `eval`, `Function`, `Proxy`, `Reflect`, TypedArray, `BigInt`, `WebAssembly`, chữ `async`/`await`; giao diện: `fetch`, `XMLHttpRequest`, `WebSocket`, `postMessage`, `parent`/`top`, cookie, `indexedDB`, Worker, `<iframe>`, địa chỉ `http(s)://` ngoài | theo [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) mục 5.1, 6.5, 5.10 |
| Quá cỡ: gói > 10 MB, giải nén > 30 MB, > 300 tệp, `server/game.js` sau gộp SDK > 256 KB, icon > 200 KB, ảnh chụp > 400 KB | nén ảnh, bỏ tài sản thừa |
| Thiếu `README.md` hoặc `LICENSE` (`LICENSE.md`/`LICENSE.txt`) | thêm theo mục 1 |
| Tệp nhị phân lạ hoặc ROM (đuôi ngoài danh sách, nội dung không khớp đuôi, `.nes .sfc .gb .iso .zip .exe…`) | chỉ dùng định dạng cho phép, tự làm tài sản |
| Tệp chấm (`.DS_Store`, `.env`, `.git…`), symlink, submodule, tên tệp có ký tự lạ | xóa; tên chỉ `A-Z a-z 0-9 . _ - @ +` |
| Mã nén/làm rối (dòng > 1000 ký tự) | gửi mã nguồn đọc được |
| Ca kiểm trượt, ván ngẫu nhiên lỗi/treo/không tất định, lần gọi > 250 ms, trả lý do kết thúc lạ | `node devkit/jagame.js check <id>` |
| Game hành động (`mode: "action"`) | chưa nhận ở hạng cộng đồng |

## 4. Bị từ chối khi duyệt tay (lý do thường gặp)
- Dùng nhân vật/hình/nhạc/tên có bản quyền, hoặc tài sản không ghi nguồn + giấy phép ([NOI-DUNG.md](NOI-DUNG.md)).
- Cờ bạc tiền thật, nội dung không hợp gia đình, câu chữ thô tục, chê người thua.
- `view` lộ bí mật (bài người khác, vai ẩn, đáp án) — người duyệt soi view của ghế khác và người xem.
- Vỡ giao diện ở điện thoại 360–390 px, nút < 44 px, chữ khó đọc ở nền tối, màu cố định không theo biến CSS ([GIAO-DIEN.md](GIAO-DIEN.md)).
- Bot quá chậm trong khu cách ly (cờ suy nghĩ sâu) — giới hạn độ sâu, mục tiêu ≤ 100 ms.
- Game trùng gần như hoàn toàn game đã có, hoặc quá sơ sài (chưa chơi hết được 1 ván vui).
- `innerHTML` chèn tên người chơi chưa qua `JGUI.esc`.

## 5. Cập nhật và gỡ game
- **Cập nhật:** PR mới sửa `submissions/<game-id>/`, tăng `version` (bản đã phát hành không bao giờ đổi), ghi `changelog` + `news`. Chỉ tác giả
  ban đầu (hoặc người được tác giả đồng ý trong PR) được cập nhật một game. Hội quán đã cài nhận bản mới tự động.
- **Gỡ / ngừng:** mở Issue (hoặc PR xóa thư mục) ghi lý do. Chủ kho ngừng niêm yết: hội quán đã cài **giữ** game kèm nhãn "ngừng niêm yết",
  hội quán mới không cài được nữa.
- **Thu hồi bắt buộc:** game phát hiện độc hại, vi phạm bản quyền hoặc nội dung bị chủ kho **chặn** — mọi hội quán tự gỡ ở lần đồng bộ kế tiếp.

## 6. Chuẩn giao tiếp
Gói nói chuyện với hội quán **chỉ** qua các hàm, đối tượng và thông điệp trong [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) — nguồn
duy nhất cho giao diện lập trình. Mọi thứ khác (mạng, tệp, tài khoản, chat, dữ liệu hội quán) gói **không** chạm được — khu cách ly chặn ở
cả máy chủ lẫn trình duyệt.
