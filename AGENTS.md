# AGENTS.md — hướng dẫn cho AI agent (Codex, Claude Code, Cursor…)

Repo này là bản phát hành ĐÃ MÃ HÓA của Jagame + bộ công cụ viết game. Việc duy nhất agent được làm ở đây: **viết 1 game mới và chuẩn bị
Pull Request gửi game**.

1. Đọc HẾT [`developers/AI-RULES.md`](developers/AI-RULES.md) trước khi sửa gì (bản máy đọc: `developers/ai-rules.json`).
2. CHỈ được tạo/sửa tệp trong `submissions/<id>/` (nháp trong `devkit/games/<id>/` đã bị `.gitignore`). MUST NOT sửa tệp nào khác:
   không `README.md`, `AGENTS.md`, `CLAUDE.md`, `devkit/`, `developers/`, `.github/`, không mã máy chủ đã mã hóa ở gốc repo.
3. Mỗi PR đúng 1 game. `<id>` khớp `^[a-z][a-z0-9-]{1,31}$`, không trùng danh sách id cấm trong AI-RULES.md mục 1.
4. Công cụ: Node ≥ 22.2 + Python ≥ 3.8, không `npm install`. Lệnh: `cd devkit && node jagame.js new <id> …` → `node jagame.js check <id>` →
   `node jagame.js submit <id>` → `python3 devkit/check_submission.py submissions/<id>` → commit → `python3 devkit/check_pr.py`.
5. Lặp sửa tới khi mọi lệnh ĐẠT; mã `[E_…]` tra ở AI-RULES.md mục 7. Chỉ mở PR khi `check_pr.py` in `PR ĐẠT — giống workflow GitHub`.
6. Không đọc / sửa / chạy mã đã mã hóa của máy chủ; không thêm khóa, ROM, tài sản có bản quyền, `node_modules`, tệp chấm.
