# Bắt đầu nhanh — game đầu tiên trong 10 phút

Cần **Node ≥ 22.2** (`node -v`) và **Python ≥ 3.8** (`python3 --version`). Không cần `npm install`, không cần cài Jagame.

## 1. Lấy bộ công cụ (1 phút)
Fork repo `phamduybk/JagameServer` trên GitHub (nút **Fork**), rồi:
```bash
git clone https://github.com/<tên-bạn>/JagameServer.git
cd JagameServer
```
(Chỉ muốn thử, chưa gửi: **Code → Download ZIP**, giải nén, `cd JagameServer-main`.)

## 2. Tạo game mới (1 phút)
```bash
node devkit/jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"
```
Tạo `games/bongbay/` từ trò mẫu Oẳn tù tì, đủ bộ:
```
games/bongbay/
  manifest.json      tên, số người, chế độ chơi, tùy chọn…        (GIAO-THUC.md mục 3)
  icon.svg           icon vuông tự vẽ
  server/game.js     luật chơi                                    (GIAO-THUC.md mục 4)
  client/index.js    giao diện                                     (GIAO-THUC.md mục 10)
  client/style.css   chỉ dùng biến CSS của khung                   (GIAO-DIEN.md)
  test/cases.json    ca kiểm                                       (GIAO-THUC.md mục 14)
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
   `games/nhatque` (theo lượt, máy chơi, gợi ý, lý do kết thúc riêng) và `games/xucxac` (2–6 người, ngẫu nhiên bằng `ctx.rng`, bảng điểm).
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
Tạo nhánh, commit **chỉ** thư mục `submissions/bongbay/`, chạy `python3 devkit/check_pr.py` (giống hệt máy kiểm trên GitHub), push lên fork,
mở Pull Request — chi tiết ở **[GUI-GAME.md](GUI-GAME.md)**. Dùng AI agent viết game? Cho nó đọc **[AI-RULES.md](AI-RULES.md)**.

## Lỗi hay gặp
| Báo lỗi | Sửa |
|---|---|
| `async/await` | xóa mọi chữ `async`/`await`, kể cả trong chú thích |
| `Date` / `Math.random` | dùng `ctx.now` / `ctx.rng()` |
| `không tất định` | không dùng biến toàn cục, không phụ thuộc thứ tự khóa object lạ — mọi thứ nằm trong state |
| `lý do kết thúc … không có trong danh sách` | dùng mã trong `shared/sdk/reasons.json` hoặc khai `reasons` trong manifest |
| `localStorage` (lưu ý) | dùng `JG.storage.get/set` |
| `innerHTML` (lưu ý) | mọi chữ từ người chơi phải qua `JGUI.esc()` |
