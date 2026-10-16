> **Đọc trước khi gửi:** [QUY-TAC-GUI-GAME.md](QUY-TAC-GUI-GAME.md) — luật R1–R16, nguồn chính cùng [developers/AI-RULES.md](developers/AI-RULES.md).

# CLAUDE.md — hướng dẫn cho Claude Code (giống hệt AGENTS.md)

Repo này là bản phát hành ĐÃ MÃ HÓA của Jagame + bộ công cụ viết game. Việc duy nhất agent được làm ở đây: **viết 1 game mới và chuẩn bị
Pull Request gửi game**.

1. Đọc HẾT `QUY-TAC-GUI-GAME.md` rồi `developers/AI-RULES.md` trước khi sửa gì (bản máy đọc: `developers/ai-rules.json`).
2. CHỈ tạo/sửa tệp trong `submissions/<id>/` (nháp trong `devkit/games/<id>/`, đã bị `.gitignore`). MUST NOT sửa tệp nào khác.
3. Nhánh `gui-<id>`; tiêu đề PR `[Gửi game] <id> v<version> — <Tên game>`; mô tả PR theo `.github/pull_request_template.md` (9 mục).
4. Làm theo AI-RULES.md mục 6 (từ gốc repo): `node devkit/jagame.js new` → viết game → `shot` → `submit` → nhánh + commit → 3 lệnh kiểm ĐẠT.
5. Mã `[E_…]` tra ở AI-RULES.md mục 7. Chỉ coi là xong khi `python3 devkit/check_pr.py --title "…" --body-file devkit/games/pr-<id>.md` in `PR ĐẠT — giống workflow GitHub`.
6. Không đọc / sửa / chạy mã đã mã hóa của máy chủ; không thêm khóa, ROM, tài sản có bản quyền, `node_modules`, tệp chấm.
