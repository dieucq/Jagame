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

**macOS:** bấm đúp **`Jagame.command`**. Lần đầu macOS chặn ("không xác định được nhà phát triển") thì bấm **chuột phải → Mở → Mở**
(macOS 15 trở lên: *Cài đặt hệ thống → Quyền riêng tư & Bảo mật → Vẫn mở*).

**Linux** (hoặc Mac không bấm đúp được): mở Terminal trong thư mục vừa giải nén rồi chạy:
```bash
bash run_mac.sh
```

**Windows 10/11 (64-bit):** bấm đúp **`run_window.bat`** (Windows cảnh báo thì bấm *More info → Run anyway*; tường lửa hỏi thì bấm *Allow*). Bản Windows chạy đủ cổng realtime (chơi game, chat) như macOS/Linux. Bản Windows mới được kiểm ít trên máy thật hơn macOS/Linux — gặp lỗi xin [báo ở đây](https://github.com/phamduybk/Jagame/issues).

Gói tải về chỉ khoảng 10 MB: **lần chạy đầu cần Internet** để máy tự tải PHP + Node + cloudflared chính thức (khoảng 90 MB tải về, chiếm
~220 MB trên ổ, chỉ 1 lần, cửa sổ hiện tiến độ %) — bạn không phải cài gì thêm.

Trình duyệt tự mở **http://localhost:6969** → đặt tên hội quán và tài khoản chủ nhà → xong (máy tự cài sẵn 12 trò). Vào **Quản trị → Mời bạn bè** để gửi link qua Zalo, Messenger.

> Máy tính phải **bật** và cửa sổ Jagame phải **đang mở** thì người thân mới vào được.

**Quên mật khẩu chủ nhà?** Mở Terminal trong thư mục `jagame`, gõ `./runtime/php index.php cli doi_mat_khau` trên macOS/Linux (bố cục cũ:
`./runtime/php/php`), Windows: `runtime\php\php.exe index.php cli doi_mat_khau` (gói cũ: `php\php.exe`), rồi nhập mật khẩu mới 2 lần.

## Cập nhật
Khi có bản mới, **Quản trị → Tổng quan** hiện thẻ "Có bản Jagame mới". Dữ liệu nằm trong 4 thư mục `database/`, `uploads/`, `games/`,
`cloudflared/` của bản đang dùng. Có 3 cách (xem đủ ở [jagame.vn/#cap-nhat](https://jagame.vn/#cap-nhat)):

**Cách 1 — khuyên dùng (từ bản 0.5.0):** Quản trị → Tổng quan → thẻ "Có bản Jagame mới" → **Cập nhật ngay** → đánh dấu xác nhận →
**Cập nhật**. Máy tự sao lưu, tải, kiểm và chạy bản mới; bản mới lỗi thì tự quay về bản cũ. Máy đang chạy bản **cũ hơn 0.5.0** chưa có
nút này: cập nhật tay **một lần** bằng cách 2 (hoặc 3), từ đó về sau dùng cách 1.

**Cách 2 — script `cap-nhat-tu-ban-cu`:**
1. Quản trị → Cài đặt → **Sao lưu** → **Sao lưu ngay**.
2. Tải gói mới, giải nén ra một thư mục **MỚI**. **Không** kéo thư mục `jagame` mới đè lên thư mục cũ — Finder hỏi *Thay thế* mà bấm vào
   là **mất hết dữ liệu**.
3. Trong thư mục mới bấm đúp **`cap-nhat-tu-ban-cu.command`** (macOS) / **`cap-nhat-tu-ban-cu.bat`** (Windows) / chạy
   `bash cap-nhat-tu-ban-cu.sh` (Linux), kéo thư mục `jagame` **cũ** vào cửa sổ, nhấn Enter: script tự dừng bản cũ, chép 4 thư mục dữ
   liệu sang, kiểm tra rồi chạy bản mới. Thư mục cũ giữ nguyên — dùng ổn vài hôm rồi hãy xóa.

**Cách 3 — làm tay:** tắt bản cũ, chép 4 thư mục dữ liệu từ thư mục cũ sang thư mục mới (ghi đè), rồi chạy bản mới.

Link `xxxx.jagame.vn` giữ nguyên. Game thì không cần làm gì — tự cập nhật từ kho.

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
