# Jagame devkit — bộ công cụ viết game cho Jagame

Jagame là web game + chat tự host cho gia đình, bạn bè (điện thoại là chính). Một game là **1 thư mục tự chứa**: luật chơi chạy ở máy
chủ trong khu cách ly + giao diện chạy trong trình duyệt. Tài liệu đầy đủ: **`GAME-PROTOCOL.md`** (cùng thư mục) và thư mục
`developers/` của repo (Bắt đầu nhanh, Giao diện, Quy tắc nội dung, Gửi game).

## Cần gì
- **Node ≥ 22.2** (không `npm install`). Kiểm: `node -v`.
- **Python ≥ 3.8** — chỉ để chạy `check_submission.py` (bộ kiểm giống hệt máy kiểm trên Pull Request; macOS/Linux, Windows dùng WSL).
- Trình duyệt bất kỳ để chơi thử.

## Lệnh
```bash
node jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"   # tạo games/bongbay/ từ trò mẫu (kèm README.md + LICENSE)
node jagame.js check bongbay                  # manifest, icon, luật chơi trong sandbox, ca kiểm, 200 ván ngẫu nhiên, máy chơi, hợp đồng v2
node jagame.js play bongbay                   # chơi thử: http://127.0.0.1:7788/tools/play.html?game=bongbay
node jagame.js submit bongbay                 # check rồi chép sang ../submissions/bongbay/ (trong bản fork của repo)
python3 check_submission.py ../submissions/bongbay   # bộ kiểm bài gửi (thêm luật thư mục, giấy phép, khu cách ly) — phải ĐẠT
```
Chơi thử: `&players=3` (số người), `&bot=1` (máy chơi ghế khác), `&tick=0` (dừng đồng hồ). Game mẫu chạy được ngay:
`node jagame.js play oantuti` · `play nhatque` · `play xucxac`.

## Bố cục
```
jagame.js              công cụ dòng lệnh (new · check · play · pack · submit)
check_submission.py    tự kiểm bài gửi trước khi mở Pull Request
GAME-PROTOCOL.md       chuẩn giao tiếp game (bản cho người viết game)
template/oantuti/      trò mẫu cho `new`
games/                 game của bạn + 3 game mẫu: oantuti (cùng lúc + đồng hồ), nhatque (theo lượt + gợi ý), xucxac (2–6 người + ngẫu nhiên)
shared/sdk/            SDK: server/jg-core.js, client/jg-ui.js, manifest.schema.json, reasons.json (công cụ tự gộp vào gói)
shared/game-ui.css     bộ lớp giao diện mẫu để CHÉP vào client/style.css (đổi tiền tố)
tools/                 bộ chạy kiểm (runner.js + sandbox.js), trang chơi thử play.html, bộ kiểm bài gửi
```

## Năm luật không được quên
1. `server/game.js`: đồng bộ, tất định — **không** `require`, `Date`, `Promise`, `Math.random` (dùng `ctx.rng()`), và **không có chữ
   `async`/`await` ở bất kỳ đâu** (kể cả chú thích). Mỗi lần gọi ≤ 150 ms (bot 250 ms). State là JSON thuần.
2. Ẩn thông tin trong `view(state, seat)`: không gửi bài/quân úp/vai trò của người khác. Ghế `-1` = người xem.
3. Xử lý `{type:'resign'}` (SDK làm sẵn).
4. Giao diện chỉ dùng biến CSS của khung, điện thoại 360px trước, vùng bấm ≥ 44px, tự vẽ; không gọi mạng.
5. Nội dung hợp gia đình; **không cờ bạc tiền thật** (chỉ "đậu ảo"); không dùng hình/nhạc/tên/nhân vật có bản quyền của người khác.

Trang chơi thử không có 20 giao diện màu của hội quán (chỉ 1 giao diện mặc định) — hãy dùng đúng biến CSS để game tự đổi màu theo
hội quán. Thử khu cách ly thật: cài game vào hội quán của bạn bằng **Quản trị → Chợ game → Cài thủ công** (bật "Cho phép nhập game ngoài kho").

## Giấy phép
Bộ công cụ này (devkit/) và các game mẫu được cấp theo giấy phép **MIT**: dùng, sửa, chia sẻ tự do. Phần mềm lõi Jagame KHÔNG thuộc giấy phép này (xem LICENSE ở gốc repo).
