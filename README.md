# Jagame · Hội quán game của riêng tụi mình 🎮

**Cờ caro, cờ tướng, ô ăn quan, bầu cua, đố vui… và tám chuyện với hội bạn — trên trang web của riêng bạn, chạy ngay trên máy tính ở nhà.**

Tải về, bấm chạy là có ngay một trang game mang tên hội của bạn, kèm link `https://xxxx.jagame.vn` gửi cho bạn bè. Không quảng cáo, dữ liệu nằm trên máy của bạn.

## Có gì
| | |
|---|---|
| 🎲 **Trò chơi tự về** | Game phát hành trên kho **game.jagame.vn** tự về hội quán của bạn, có bản mới thì tự cập nhật. Đang có: **Cờ caro** (bàn 15×15 / 19×19, chơi với bạn bè, có người xem). |
| ⚡ **Chơi ngay** | Bạn bè chỉ cần đặt biệt danh là vào chơi, không cần đăng ký. Máy nhớ tên cho lần sau. |
| 💬 **Trò chuyện** | Chat trong phòng chơi kiểu iPhone, thả cảm xúc, âm thanh vui tai. |
| 🎨 **Trang theo ý mình** | Chủ phòng bấm vào chữ, ảnh để sửa; nhiều giao diện, chỉnh màu riêng, bật/tắt từng mục. |
| 🔗 **Link riêng** | Tự có `xxxx.jagame.vn`; muốn tên đẹp thì mua/kết nối tên miền riêng bằng mã 6 số. |
| 🔒 **Riêng tư** | Chỉ ai có link mới vào được; có thể bắt duyệt hoặc dùng mã mời. |

## Cài đặt
Tải về: nút **Code → Download ZIP** ở trên (hoặc `git clone`), giải nén ra một thư mục.

**Windows 10/11:** bấm đúp **`run_window.bat`** (Windows cảnh báo thì bấm *More info → Run anyway*). ⚠ Bản Windows đang hoàn thiện: trang web chạy được, còn chơi game / chat trực tiếp sẽ có ở bản sau — muốn chơi ngay hãy dùng macOS / Linux.

**macOS / Linux:** mở Terminal trong thư mục vừa giải nén rồi chạy:
```bash
bash run_mac.sh
```
Lần chạy đầu máy tự tải PHP + Node chính thức (~70 MB, chỉ 1 lần) — bạn không phải cài gì.

Trình duyệt tự mở **http://localhost:6969** → đặt tên hội quán và tài khoản chủ phòng → xong. Vào **Quản trị → Mời bạn bè** để gửi link qua Zalo, Messenger.

> Máy tính phải **bật** và chương trình phải **đang chạy** thì bạn bè mới vào được.

**Quên mật khẩu chủ phòng?** Trong thư mục chương trình chạy: `php index.php cli doi_mat_khau` (Windows: `php\php.exe index.php cli doi_mat_khau`).

## Cập nhật
Tải bản mới, chép đè lên thư mục cũ (giữ nguyên `database/`, `uploads/`, `cloudflared/`), chạy lại. Game thì không cần làm gì — tự cập nhật từ kho.

## Dành cho nhà phát triển
Ai cũng viết được game cho Jagame và gửi lên **Chợ game**: tài liệu ở [`developers/`](developers/README.md) (tiếng Việt, tóm tắt
[English](developers/README.en.md)), bộ công cụ ở [`devkit/`](devkit/README.md) — chỉ cần Node + Python.
```bash
cd devkit
node jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"   # tạo game từ trò mẫu
node jagame.js play bongbay                                      # chơi thử trong trình duyệt
node jagame.js submit bongbay && python3 check_submission.py ../submissions/bongbay
```
Gửi bằng **Pull Request chỉ đụng `submissions/<game-id>/`** ([GUI-GAME.md](developers/GUI-GAME.md), [CONTRIBUTING.md](CONTRIBUTING.md)).
Chủ kho duyệt, ký hạng *Cộng đồng*; admin từng hội quán tự quyết cài.

---
Bản phát hành này đã được mã hóa. Thành phần bên thứ ba: CodeIgniter 3 (MIT), Socket.IO (MIT), phông Google Fonts (SIL OFL 1.1), qrcode-generator (MIT).
