# Đóng góp cho Jagame

Repo này chứa **bản phát hành đã mã hóa** của Jagame (máy chủ hội quán) cùng **tài liệu + bộ công cụ cho nhà phát triển game**.
Mã nguồn hệ thống (máy chủ, đồng bộ kho, tên miền, bảo mật) không công khai — vì vậy repo **chỉ nhận Pull Request gửi game**.

## Gửi game
1. Đọc [developers/BAT-DAU-NHANH.md](developers/BAT-DAU-NHANH.md) và [developers/GUI-GAME.md](developers/GUI-GAME.md).
2. Fork → tạo game bằng `devkit/` → `node jagame.js submit <game-id>` → `python3 devkit/check_submission.py submissions/<game-id>` phải ĐẠT.
3. Mở Pull Request **chỉ** đụng `submissions/<game-id>/`, một game mỗi PR, điền mẫu PR.
4. Máy kiểm chạy tự động; chủ dự án duyệt, chơi thử, ký hạng **Cộng đồng** rồi đưa lên Chợ game.

PR sửa tệp ngoài `submissions/<game-id>/` (README, devkit, tài liệu, mã đã mã hóa…) bị chặn tự động. Báo lỗi bộ công cụ hoặc tài liệu: mở
Issue. Báo lỗ hổng bảo mật: KHÔNG mở Issue công khai — gửi riêng cho chủ dự án qua mục Security của repo.

Quy tắc nội dung + bản quyền: [developers/NOI-DUNG.md](developers/NOI-DUNG.md). English: [developers/README.en.md](developers/README.en.md).
