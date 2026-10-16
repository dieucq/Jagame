<!-- Gửi game: PR này CHỈ được thêm/sửa tệp trong submissions/<game-id>/ (1 game / PR). Xem developers/GUI-GAME.md -->
## Game
- **id:** `<game-id>`  ·  **phiên bản:** `X.Y.Z`  ·  **tên:**
- **Mô tả ngắn / luật chơi:**
- **Số người:**   ·  **Bản mới hay cập nhật:**

## Tự kiểm (bắt buộc)
- [ ] PR chỉ đụng `submissions/<game-id>/` (`git status` / tab "Files changed" không có tệp nào khác)
- [ ] `python3 devkit/check_submission.py submissions/<game-id>` → `KẾT QUẢ: ĐẠT` (dán dòng cuối vào dưới)
- [ ] Chơi thử trọn 1 ván bằng `node jagame.js play <game-id>` ở 390×844 và 1366×900, không lỗi console, không tràn ngang
- [ ] `view` không lộ bí mật của ghế khác / người xem
- [ ] Có `README.md` (mô tả, luật, tác giả, giấy phép mã + NGUỒN và giấy phép từng tài sản không tự làm) và `LICENSE`
- [ ] Không nhân vật / hình / nhạc / phông / tên có bản quyền của người khác; không ROM; nội dung hợp gia đình; không tiền thật
- [ ] Tôi có quyền với mọi tệp trong PR và đồng ý cho Jagame phân phối game theo giấy phép đã ghi

```
(dán kết quả check_submission.py ở đây)
```
