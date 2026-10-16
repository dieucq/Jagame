# submissions/ — nơi gửi game

Mỗi game gửi lên là **một thư mục** `submissions/<game-id>/`, mở bằng **một Pull Request chỉ đụng thư mục đó**.
Cấu trúc, các bước và lý do bị từ chối: [developers/GUI-GAME.md](../developers/GUI-GAME.md).

```bash
cd devkit
node jagame.js new <game-id> --name "Tên game" --author "Tên bạn"
node jagame.js submit <game-id>
python3 check_submission.py ../submissions/<game-id>
```
Thư mục này chỉ chứa bài đang chờ duyệt; game đã phát hành nằm trên Chợ game (game.jagame.vn).
