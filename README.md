> **Bắt buộc:** [QUY-TRINH-DONG-GOP.md](QUY-TRINH-DONG-GOP.md) — 4 luồng đóng góp (báo lỗi · game mới · cập nhật game của mình · sửa game người khác); lõi đóng nguồn, không nhận PR sửa lõi.
> **Đọc trước:** [CHUAN-GIAO-TIEP.md](CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](developers/ai-rules.json) — luật máy đọc.

# Jagame · Hội quán game của riêng tụi mình 🎮

**27 trò chơi — cờ tướng, cờ vua, caro, ô ăn quan, tiến lên, phỏm, bầu cua, lô tô, đố vui… — cộng chat nhóm, album ảnh, nghe nhạc chung cho gia đình và bạn bè, trên trang web của riêng bạn.**

Tải về, bấm chạy là có ngay một hội quán mang tên nhà bạn, kèm link `https://xxxx.jagame.vn` gửi cho người thân. Không quảng cáo, dữ liệu nằm trên máy của bạn.
Không có máy để bật cả ngày? Tạo **hội quán online** ngay trên [jagame.vn](https://jagame.vn/) (miễn phí 90 ngày, hết hạn vẫn tải được dữ liệu về tự host).

Trang chủ: **https://jagame.vn** · Bản phát hành, hướng dẫn và bộ công cụ viết game: **https://github.com/phamduybk/Jagame**

## Có gì (bản 0.4.1)
| | |
|---|---|
| 🎲 **27 trò chơi** | Cờ (tướng, vua, caro, úp, gánh, ô ăn quan…), bài (tiến lên, phỏm, ba cây, xì dách, poker…), trò vui cả nhà (bầu cua, lô tô, đố vui, vẽ hình đoán chữ, ma sói…). Chơi với người hoặc với máy, có người xem, xem lại ván. Game tự về và tự cập nhật từ **Chợ game** (game.jagame.vn); chủ nhà chọn cài gì. |
| ⚡ **Chơi ngay** | Người thân chỉ cần gõ biệt danh là vào chơi, không cần đăng ký. Máy nhớ tên cho lần sau. |
| 💬 **Chat** | Kênh chung, nhắn riêng, nhóm; ảnh, tệp, sticker, bình chọn, tìm tin, BUZZ; thông báo đẩy trên điện thoại. |
| ♟ **Cờ thư · giải đấu · sự kiện** | Đi cờ theo lượt cách ngày; giải loại trực tiếp mini; hẹn giờ chơi chung, nhắc sinh nhật. |
| 🖼 **Album ảnh · Nghe nhạc** | Album gia đình (thành viên góp ảnh, chủ nhà duyệt); nạp album nhạc, nghe tiếp khi chuyển trang và khi đang chơi. |
| ❤️ **Tim · nhiệm vụ · xếp hạng** | Tặng tim, nhiệm vụ hằng ngày, chuỗi ngày, huy hiệu, bảng xếp hạng. |
| 🎨 **Trang theo ý mình** | Chủ nhà bấm vào chữ, ảnh để sửa; 20+ giao diện, màu riêng (luôn đủ tương phản), chế độ tối. |
| 💾 **Sao lưu tự động** | Mỗi đêm tự sao lưu (giữ khoảng 5 tuần), chép thêm sang ổ thứ hai, khôi phục an toàn. |
| 🌐 **Mạng LAN ảo** (chỉ bản tự host) | Chơi game LAN cũ (Counter-Strike, Age of Empires…) qua Internet như ngồi chung quán net, 16–24 người. Mặc định tắt. |
| 🔗 **Link riêng** | Tự có `xxxx.jagame.vn`; muốn tên đẹp thì kết nối tên miền riêng bằng mã 6 số. |
| 🔒 **Riêng tư · gia đình** | Chế độ vào: mở / phải được duyệt / mã mời. Lọc từ, giờ yên tĩnh, đánh dấu tài khoản trẻ nhỏ, báo cáo + kiểm duyệt. |

## Cài đặt
Tải gói ở **https://jagame.vn/#tai-ve** (khuyến nghị), hoặc nút **Code → Download ZIP** ở trên. Giải nén ra một thư mục cố định (đừng chạy bên trong tệp .zip).

**macOS / Linux:** mở Terminal trong thư mục vừa giải nén rồi chạy:
```bash
bash run_mac.sh
```

**Windows 10/11 (64-bit):** bấm đúp **`run_window.bat`** (Windows cảnh báo thì bấm *More info → Run anyway*; tường lửa hỏi thì bấm *Allow*). Bản Windows chạy đủ cổng realtime (chơi game, chat) như macOS/Linux. Bản Windows mới được kiểm ít trên máy thật hơn macOS/Linux — gặp lỗi xin [báo ở đây](https://github.com/phamduybk/Jagame/issues).

Lần chạy đầu máy tự tải PHP + Node chính thức (~70 MB, chỉ 1 lần, **cần có mạng**) — bạn không phải cài gì thêm.

Trình duyệt tự mở **http://localhost:6969** → đặt tên hội quán và tài khoản chủ nhà → xong (máy tự cài sẵn 12 trò). Vào **Quản trị → Mời bạn bè** để gửi link qua Zalo, Messenger.

> Máy tính phải **bật** và cửa sổ Jagame phải **đang mở** thì người thân mới vào được.

**Quên mật khẩu chủ nhà?** Trong thư mục chương trình chạy: `runtime/php index.php cli doi_mat_khau <mật khẩu mới>` trên macOS/Linux (gói kèm sẵn PHP trong `runtime/`; bố cục cũ: `runtime/php/php`), Windows: `php\php.exe index.php cli doi_mat_khau <mật khẩu mới>`.

## Cập nhật
Khi có bản mới, **Quản trị → Tổng quan** hiện thẻ "Có bản Jagame mới". Cách cập nhật (5 bước, xem đủ ở [jagame.vn/#tai-ve](https://jagame.vn/#tai-ve)):
1. Quản trị → Cài đặt → Hệ thống → **Sao lưu tự động & khôi phục** → **Sao lưu ngay**.
2. Tải gói mới, giải nén ra chỗ tạm.
3. Tắt Jagame (đóng cửa sổ đen / Terminal).
4. Chép mọi thứ trong thư mục mới đè lên thư mục cũ — **không xóa** `database/`, `uploads/`, `games/`, `cloudflared/` của bản cũ.
5. Chạy lại. Link `xxxx.jagame.vn` giữ nguyên. Game thì không cần làm gì — tự cập nhật từ kho.

## Dành cho nhà phát triển
Ai cũng viết được game hoặc ứng dụng nhỏ (bình chọn, bảng điểm, đố vui tự soạn…) cho Jagame và gửi lên **Chợ game**. Chuẩn giao tiếp
chính thức: [`CHUAN-GIAO-TIEP.md`](CHUAN-GIAO-TIEP.md) (có tóm tắt tiếng Anh); hướng dẫn thêm ở [`developers/`](developers/README.md)
([English](developers/README.en.md)); bộ công cụ ở [`devkit/`](devkit/README.md) — chỉ cần Node + Python.
```bash
node devkit/jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"   # tạo game từ trò mẫu
node devkit/jagame.js play bongbay                                      # chơi thử trong trình duyệt
node devkit/jagame.js submit bongbay && python3 devkit/check_submission.py submissions/bongbay
```
Gửi bằng **Pull Request chỉ đụng `submissions/<game-id>/`** ([GUI-GAME.md](developers/GUI-GAME.md), [CONTRIBUTING.md](CONTRIBUTING.md)).
Chủ kho duyệt, ký hạng *Cộng đồng*; admin từng hội quán tự quyết cài.

---
Bản phát hành này đã được mã hóa. Thành phần bên thứ ba: CodeIgniter 3 (MIT), Socket.IO (MIT), phông Google Fonts (SIL OFL 1.1), qrcode-generator (MIT).
