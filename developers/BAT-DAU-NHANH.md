# Bắt đầu nhanh — game đầu tiên trong 10 phút

> Chuẩn giao tiếp đầy đủ: [../CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md). Làm ứng dụng không phải game (bình chọn, bảng điểm…): mục 10 của chuẩn + mẫu `devkit/games/binhchon`.

Cần **Node ≥ 22.2** (`node -v`) và **Python ≥ 3.8** (`python3 --version`). Không cần `npm install`, không cần cài Jagame.

## 1. Lấy bộ công cụ (1 phút)
Fork repo `phamduybk/Jagame` trên GitHub (nút **Fork**), rồi:
```bash
git clone https://github.com/<tên-bạn>/Jagame.git
cd Jagame
```
(Chỉ muốn thử, chưa gửi: **Code → Download ZIP**, giải nén, `cd Jagame-main`.)

## 2. Tạo game mới (1 phút)
```bash
node devkit/jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"
```
Tạo `games/bongbay/` từ trò mẫu Oẳn tù tì, đủ bộ:
```
games/bongbay/
  manifest.json      tên, số người, chế độ chơi, tùy chọn…        (CHUAN-GIAO-TIEP.md mục 4)
  icon.svg           icon vuông tự vẽ
  server/game.js     luật chơi                                    (CHUAN-GIAO-TIEP.md mục 5)
  client/index.js    giao diện                                     (CHUAN-GIAO-TIEP.md mục 6)
  client/style.css   chỉ dùng biến CSS của khung                   (GIAO-DIEN.md)
  test/cases.json    ca kiểm                                       (CHUAN-GIAO-TIEP.md mục 8)
  README.md, LICENSE mô tả + giấy phép (bắt buộc khi gửi)
```
`id` (ở đây `bongbay`) là tên vĩnh viễn: chữ thường, số, gạch ngang, 2–32 ký tự, không trùng game chính thức (công cụ tự báo).

## 3. Chạy thử (2 phút)
```bash
node devkit/jagame.js check bongbay     # phải ra "KẾT QUẢ: ĐẠT — 0 lỗi"
node devkit/jagame.js play bongbay      # mở http://127.0.0.1:7788/tools/play.html?game=bongbay
```
Trang chơi thử có "máy chủ giả" chạy luật chơi ngay trong trình duyệt, 2 người chơi chung 1 máy (tự đổi ghế theo lượt).
Thêm `&players=3`, `&bot=1` (máy chơi ghế khác), `&tick=0` (dừng đồng hồ). Mở thêm cửa sổ thứ 2 cùng địa chỉ để soi ở cỡ màn khác
(DevTools → chế độ điện thoại 390×844). Ctrl+C để dừng.

## 4. Sửa thành game của bạn (5 phút trở lên)
1. `server/game.js`: đổi luật trong `setup`, `moves`, `view`. Xem 2 game mẫu viết sẵn:
   `games/nhatque` (theo lượt, máy chơi, gợi ý, lý do kết thúc riêng), `games/xucxac` (2–6 người, ngẫu nhiên bằng `ctx.rng`, bảng điểm)
   và `games/binhchon` (ứng dụng không phải game: 1–20 người, phiếu bí mật, không thắng thua).
2. `client/index.js`: vẽ bàn trong `game.root`, gửi nước bằng `game.send({type: …})`.
3. `test/cases.json`: thêm ca cho luật chính, nước sai, đầu hàng, kết thúc.
4. Chạy lại `node devkit/jagame.js check bongbay` sau mỗi lần sửa.

## 5. Đóng gói và tự kiểm bài gửi (1 phút)
```bash
node devkit/jagame.js submit bongbay                         # check rồi chép sang submissions/bongbay/
python3 devkit/check_submission.py submissions/bongbay    # bộ kiểm GIỐNG HỆT máy kiểm trên Pull Request — phải "KẾT QUẢ: ĐẠT"
```
Muốn có gói `.jgame` để cài thử lên hội quán của chính bạn (Quản trị → Chợ game → Cài thủ công, bật "Cho phép nhập game ngoài kho"):
```bash
python3 devkit/check_submission.py submissions/bongbay --jgame bongbay.jgame
```

## 6. Gửi
Làm đúng **7 lệnh** của [../QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) R10 (bạn đã chạy lệnh 1 và một phần lệnh 3 ở trên), push lên fork,
mở Pull Request — từng bước ở **[GUI-GAME.md](GUI-GAME.md)**. Dùng AI agent viết game? Cho nó đọc **[AI-RULES.md](AI-RULES.md)**.

## Lỗi hay gặp
| Báo lỗi | Sửa |
|---|---|
| `async/await` | xóa mọi chữ `async`/`await`, kể cả trong chú thích |
| `Date` / `Math.random` | dùng `ctx.now` / `ctx.rng()` |
| `không tất định` | không dùng biến toàn cục, không phụ thuộc thứ tự khóa object lạ — mọi thứ nằm trong state |
| `lý do kết thúc … không có trong danh sách` | dùng mã trong `shared/sdk/reasons.json` hoặc khai `reasons` trong manifest |
| `localStorage` (`E_FORBIDDEN_API_CLIENT`) | dùng `JG.storage.get/set` |
| `innerHTML` (lưu ý) | mọi chữ từ người chơi phải qua `JGUI.esc()` |
