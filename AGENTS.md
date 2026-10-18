> **Bắt buộc:** [QUY-TRINH-DONG-GOP.md](QUY-TRINH-DONG-GOP.md) — 4 luồng đóng góp (báo lỗi · game mới · cập nhật game của mình · sửa game người khác); lõi đóng nguồn, không nhận PR sửa lõi.
> **Đọc trước:** [CHUAN-GIAO-TIEP.md](CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](developers/ai-rules.json) — luật máy đọc.

# AGENTS.md — hướng dẫn cho AI agent (Codex, Claude Code, Cursor…)

Repo này là bản phát hành ĐÃ MÃ HÓA của Jagame + bộ công cụ viết game. Việc duy nhất agent được làm ở đây: **viết 1 game mới và chuẩn bị
Pull Request gửi game** (game hoặc ứng dụng nhỏ chạy trong phòng).

1. Đọc HẾT `CHUAN-GIAO-TIEP.md` (giao diện lập trình — nguồn duy nhất), `QUY-TAC-GUI-GAME.md` (quy trình gửi) rồi `developers/AI-RULES.md`
   (từng bước cho agent) trước khi sửa gì. Luật máy đọc: `developers/ai-rules.json`.
2. CHỈ tạo/sửa tệp trong `submissions/<id>/` (nháp trong `devkit/games/<id>/`, đã bị `.gitignore`). MUST NOT sửa tệp nào khác.
3. Nhánh `gui-<id>`; tiêu đề PR `[Gửi game] <id> v<version> — <Tên game>` (ứng dụng: `[Gửi ứng dụng] …`); mô tả PR theo `.github/pull_request_template.md` (9 mục).
4. Chạy ĐÚNG 7 lệnh của QUY-TAC-GUI-GAME.md R10 (= AI-RULES.md mục 6, từ gốc repo): `new` → (viết gói) → `shot` → `submit` → nhánh + commit → 3 lệnh kiểm ✱ ĐẠT.
5. Mã `[E_…]` tra ở AI-RULES.md mục 7. Chỉ coi là xong khi `python3 devkit/check_pr.py --title "…" --body-file devkit/games/pr-<id>.md` in `PR ĐẠT — giống workflow GitHub`.
6. Repo chưa có remote / `git config user.name` → HỎI người dùng tên + liên hệ tác giả trước khi viết mô tả PR; không bịa.
7. Cập nhật game ĐÃ CÓ chỉ khi tài khoản GitHub của bạn là chủ trong `submissions/OWNERS.json` (khác → `E_NOT_OWNER`; mở Issue gắn @tác-giả thay vì PR)
   và phải có `submissions/<id>/CHANGELOG.md` ghi phiên bản mới (`E_CHANGELOG`). Không bao giờ sửa lõi — lỗi lõi chỉ báo qua Issue.
8. Không đọc / sửa / chạy mã đã mã hóa của máy chủ; không thêm khóa, ROM, tài sản có bản quyền, `node_modules`, tệp chấm.
