> **Đọc trước:** [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](../developers/ai-rules.json) — luật máy đọc.

# submissions/ — nơi gửi game

Mỗi game gửi lên là **một thư mục** `submissions/<game-id>/`, mở bằng **một Pull Request chỉ đụng thư mục đó**.
Cấu trúc gói: [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) mục 3 · các bước và lý do bị từ chối: [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md).

```bash
node devkit/jagame.js new <game-id> --name "Tên game" --author "Tên bạn"
node devkit/jagame.js submit <game-id>
python3 devkit/check_submission.py submissions/<game-id>
```
Thư mục này chỉ chứa bài đang chờ duyệt; game đã phát hành nằm trên Chợ game (game.jagame.vn).
