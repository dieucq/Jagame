> Chuẩn giao tiếp (biến CSS, khung cách ly, đối tượng `game`): [../CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md). Trang này chỉ nói về mỹ thuật.

# Hướng dẫn giao diện game

Mục tiêu: mọi game nhìn như **một** sản phẩm — cùng khung, cùng nhịp, cùng cách báo lượt/thắng/thua — mà mỗi game vẫn có "đồ vật" riêng
(bàn gỗ, chiếu ô ăn quan, đĩa xúc xắc…). Chạy đẹp ở cả **20 giao diện màu** của hội quán (sáng, tối, truyện tranh, pixel…), **điện thoại trước**.

## 1. Hướng nghệ thuật
- Người chơi: gia đình, hội bạn 8–25 tuổi, cầm điện thoại một tay, vừa chơi vừa chat; ván ngắn, hay bị gián đoạn.
- Cảm giác: *đồ chơi thật nhưng tinh nghịch* — bàn/quân/bài có bề dày, bóng, chất liệu; có sự kiện thì "nổ" kiểu truyện tranh, bình thường thì yên.
- Không làm: casino vàng-đỏ bóng loáng, nút gradient tím-xanh, mọi thứ nhấp nháy liên tục, chữ nhỏ kiểu game PC.
- **Bàn chơi là nhân vật chính** (≥ 55% chiều cao màn điện thoại); chip, nút, khay là khung mỏng quanh nó.

## 2. Biến CSS — bắt buộc
Danh sách biến, chế độ tối và luật điện thoại trước là một phần của chuẩn giao tiếp: [../CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) mục 6.3.
Thêm về mỹ thuật:

- **Đồ vật không dùng `--ink`/`--paper`**: giao diện tối đảo màu → chữ trắng trên giấy trắng. Dùng `--jg-obj-*`.
- Không đặt chữ `#fff`/`#000` cố định trên nền `var(--ink)` / `var(--paper)`.
- Không bọc `--radius` trong `min()` (có giao diện dùng bo elip → `min()` thành không hợp lệ).
- Tiền tố lớp CSS riêng cho game (vd `nq-`, `xx-`) để không đụng game khác.
- `devkit/shared/game-ui.css` có sẵn bộ lớp mẫu (chip, nút, quân, lá bài, xúc xắc, banner, pháo giấy): **chép** phần cần vào `client/style.css`
  rồi đổi tiền tố — gói game phải tự chứa, không `<link>` ra ngoài.

## 3. Bố cục điện thoại (360–390 px) và máy tính
```
┌─────────────────────────────┐
│ chip | trạng thái | chip    │ 52px    hàng người chơi (JGUI.chips)
│ dòng trạng thái 1 dòng      │ 22px    "Lượt của bạn — chạm ô sáng để đi"
│ ┌─────────────────────────┐ │
│ │ BÀN CHƠI                │ │ 100% rộng, cao ≤ 100svh − 400px
│ └─────────────────────────┘ │
│ khay / tay bài của mình     │
│ [phụ] [CHÍNH]  (JGUI.bar)   │ 48px    thanh nút dính đáy
└─────────────────────────────┘
```
- Không tràn ngang ở 360 px; vùng bấm ≥ 44 px (nút chính 48); chữ ≥ 13 px; ô nhập ≥ 16 px.
- Góc phải dưới 80×80 px là chỗ nút chat của khung — không đặt nút quan trọng ở đó (căn giữa thanh nút).
- Máy tính: bàn ≤ 640 px căn giữa; cả bàn + nút lọt 1 màn 1366×900.
- Ô bàn < 32 px (bàn dày như caro 19×19): chạm 1 = xem trước, chạm 2 = đi; có phóng to.
- Game KHÔNG vẽ nút Đầu hàng, màn kết thúc, chat — khung làm. Game tự vẽ chip ghế thì khai `ui.players: "game"`; màn kết thúc riêng: `ui.end: "game"`.

## 4. Tín hiệu nước đi (giống nhau ở mọi game có bàn)
| Tín hiệu | Hình |
|---|---|
| Ô/quân đang chọn | tô `accent` nhạt + quân nhấc nhẹ |
| Đích đi được | chấm tròn ~28% ô, viền giấy 3 px |
| Đích ăn được | vòng tròn đỏ quanh quân bị ăn |
| Nước vừa đi | tô nhạt CẢ ô đi + ô đến, hiện cho cả 2 bên tới khi có nước mới |
| Nguy hiểm (chiếu…) | nháy đỏ + banner + âm `check` |

Phe/người chơi phân biệt bằng **màu + hình** (tròn, vuông, tam giác, thoi, sao…) — người mù màu vẫn đọc được. Không dùng `--accent` làm màu phe.

## 5. Chuyển động
- Chỉ `transform`/`opacity`; đặt quân 200 ms, trượt quân 220 ms, chia bài 260 ms/lá, banner tối đa 1,4 s; không vòng lặp nào ngoài nhịp lượt.
- **`prefers-reduced-motion: reduce` bắt buộc:** không animation, phần tử hiện ngay ở trạng thái cuối (không kẹt `opacity: 0`). Trong JS dùng `JGUI.still()`.

## 6. Âm thanh
Gọi `move` NGAY khi người chơi bấm; `move-other` khi người khác đi; `tick` khi chọn quân / đếm ngược (≤ 1 lần/150 ms); `error` khi bị từ chối;
`capture` `check` `dice` `deal` `chip` cho sự kiện riêng. Khung tự phát `start`, `turn`, `win/lose/draw`. Không phát âm khi chạm ô trống.

## 7. Danh sách tự kiểm trước khi gửi
- [ ] Không tràn ngang ở 360, 390, 1366 px; không lỗi console.
- [ ] Biết ngay tới lượt ai trong 1 giây (chip + dòng trạng thái).
- [ ] Mọi màu qua biến; đồ vật dùng `--jg-obj-*`; đẹp ở nền sáng và nền tối.
- [ ] Vùng bấm ≥ 44 px; Tab tới được nút, `:focus-visible` rõ.
- [ ] Nước đi hiện ngay, bị từ chối thì trả về + thông báo.
- [ ] Người xem (ghế −1) không bấm được gì, chữ nói đúng vai.
- [ ] Tên người chơi dài 25 ký tự bị cắt "…", không vỡ hàng; mọi tên qua `JGUI.esc`.
- [ ] Giảm chuyển động: vẫn đủ thông tin.
- [ ] Hình tự vẽ (SVG/CSS) hoặc tài sản có giấy phép rõ; không phông/ảnh từ mạng.
