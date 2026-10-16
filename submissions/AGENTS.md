> **Đọc trước khi gửi:** [../QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật R1–R16; chi tiết [../developers/AI-RULES.md](../developers/AI-RULES.md).

# submissions/AGENTS.md — luật cho AI agent trong thư mục này
- Mỗi game = 1 thư mục `submissions/<id>/`, `<id>` khớp `^[a-z][a-z0-9-]{1,31}$` và bằng `manifest.json` → `"id"` (R1, R2).
- CHỈ tạo/sửa tệp trong `submissions/<id>/` của game mình; MUST NOT sửa `README.md`, `AGENTS.md` này hay thư mục game khác (R7, R8).
- Không chép tay: tạo bằng `node devkit/jagame.js new <id>`, chép sang đây bằng `node devkit/jagame.js submit <id>` (từ gốc repo).
- Nhánh `gui-<id>`, tiêu đề PR `[Gửi game] <id> v<version> — <Tên game>`, mô tả PR đủ 9 mục (R3, R4, R11).
- 3 lệnh phải ĐẠT trước khi mở PR (R10): `node devkit/jagame.js check <id>` · `python3 devkit/check_submission.py submissions/<id>` ·
  `python3 devkit/check_pr.py --title "…" --body-file devkit/games/pr-<id>.md`.
