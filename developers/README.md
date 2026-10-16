# Dành cho nhà phát triển — viết game cho Jagame

Ai cũng viết được game (và ứng dụng nhỏ chạy trong khung game) cho Jagame rồi gửi lên **Chợ game**. Chủ kho duyệt, ký hạng
**Cộng đồng**, admin từng hội quán tự quyết cài. Bạn chỉ cần Node + Python, không cần cài Jagame.

| Tài liệu | Nội dung |
|---|---|
| [BAT-DAU-NHANH.md](BAT-DAU-NHANH.md) | Game đầu tiên trong 10 phút: tạo, chạy thử, đóng gói, tự kiểm |
| [GIAO-THUC.md](GIAO-THUC.md) | Chuẩn giao tiếp game: manifest, luật chơi, view, client, `JGUI`, khu cách ly, chế độ chơi, lý do kết thúc |
| [GIAO-DIEN.md](GIAO-DIEN.md) | Giao diện: biến CSS, điện thoại trước, tín hiệu nước đi, chuyển động, âm thanh |
| [NOI-DUNG.md](NOI-DUNG.md) | Quy tắc nội dung + bản quyền (không nhân vật/tài sản có bản quyền, không ROM, hợp gia đình) |
| [GUI-GAME.md](GUI-GAME.md) | Gửi game qua Pull Request `submissions/<game-id>/`, duyệt, cập nhật, gỡ; bị từ chối tự động nếu… |
| [README.en.md](README.en.md) | English summary |

Bộ công cụ: [`../devkit/`](../devkit/) — SDK, `manifest.schema.json`, `reasons.json`, `jagame.js` (new · check · play · pack · submit),
`check_submission.py`, trang chơi thử, 3 game mẫu (`oantuti`, `nhatque`, `xucxac`).

```bash
cd devkit
node jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"
node jagame.js play bongbay
node jagame.js submit bongbay && python3 check_submission.py ../submissions/bongbay
```
