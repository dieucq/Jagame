# submissions/AGENTS.md — luật cho AI agent trong thư mục này

- Luật đầy đủ: [`../developers/AI-RULES.md`](../developers/AI-RULES.md) — đọc trước khi viết.
- Mỗi game = 1 thư mục `submissions/<id>/`; `<id>` khớp `^[a-z][a-z0-9-]{1,31}$` và bằng `manifest.json` → `"id"`.
- Agent CHỈ tạo/sửa tệp trong `submissions/<id>/` của game mình. MUST NOT sửa `README.md`, `AGENTS.md` này hay thư mục game khác.
- Cây bắt buộc: `manifest.json`, `icon.svg`, `server/game.js`, `client/index.js`, `test/cases.json`, `README.md`, `LICENSE`
  (tùy chọn: `client/style.css`, `client/assets/`, `screenshots/`). Cấm: tệp chấm, symlink, `node_modules/`, `assets/` ở gốc, ROM, nhị phân lạ.
- Tạo bằng `cd ../devkit && node jagame.js new <id>` rồi `node jagame.js submit <id>` — không chép tay trò mẫu.
- Tự kiểm: `python3 devkit/check_submission.py submissions/<id>` (từ gốc repo) phải in `KẾT QUẢ: ĐẠT`; sau khi commit:
  `python3 devkit/check_pr.py` phải in `PR ĐẠT — giống workflow GitHub`. Mã `[E_…]` → AI-RULES.md mục 7.
- Mỗi Pull Request đúng 1 game, tiêu đề `Gửi game <id> <version>`.
