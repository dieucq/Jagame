> **Đọc trước khi gửi:** [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật gửi game R1–R16 (nguồn chính, cùng developers/AI-RULES.md).

# submissions/ — nơi gửi game

Mỗi game gửi lên là **một thư mục** `submissions/<game-id>/`, mở bằng **một Pull Request chỉ đụng thư mục đó**.
Cấu trúc, các bước và lý do bị từ chối: [developers/GUI-GAME.md](../developers/GUI-GAME.md).

```bash
node devkit/jagame.js new <game-id> --name "Tên game" --author "Tên bạn"
node devkit/jagame.js submit <game-id>
python3 devkit/check_submission.py submissions/<game-id>
```
Thư mục này chỉ chứa bài đang chờ duyệt; game đã phát hành nằm trên Chợ game (game.jagame.vn).
