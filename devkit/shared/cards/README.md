# Bộ lá bài dùng chung Jagame (v1 · 08/10/2026)

52 lá + mặt lưng, **tự vẽ hoàn toàn bằng SVG** (chất ♠♣♦♥, chữ số, hình người J/Q/K là nhân vật sticker của Jagame — không chép
bộ bài nào, không phông ngoài). Dùng cho Tiến lên, Poker, Ba cây và các game bài sau.

| File | Vai trò |
|---|---|
| `cards.js` | `JGCards` — sinh SVG mặt bài, tạo phần tử lá, lật, xòe quạt. Không id/defs → bao nhiêu lá cũng không đụng nhau. |
| `cards.css` | Lá (giấy, viền, bóng), lưng (hoa văn theo `--accent`), tay bài, giữa bàn, chồng bài đối thủ, chuyển động, reduced-motion. |
| `demo.html` | Trang xem: `python3 -m http.server 7791` ở gốc repo → `/shared/cards/demo.html?theme=neon` (`?four=1` bài 4 màu). |

Ảnh mẫu: `GAME-PROTOCOL.md`, `09-labai-codien-neon.png`.

## Hai bố cục mặt bài — tự chọn theo bề rộng lá
- **Điện thoại** (lá < 88px — tay bài, giữa bàn trên điện thoại): chữ số TO (≈ 38% bề rộng lá) + chất ngay dưới, nằm gọn trong
  45% bên trái (phần luôn lòi ra khi xếp chồng 52%); góc phải dưới là 1 chất to (2–10), chất trong vòng chấm (A), chân dung (J Q K).
  Ở lá 44px chữ số ≈ 17px — đọc được bằng một liếc.
- **Cổ điển** (lá ≥ 88px — máy tính, lật bài to, màn kết quả): chỉ số 2 góc (góc dưới xoay 180°), đủ nút chất 2–10 bố trí chuẩn,
  J Q K trong khung có chân dung + chất mờ.
- Chọn bằng `@container (min-width: 88px)` trên `.jgk-card` — **không cần JS**. Ép một kiểu: `JGCards.el(code, {layout:'mobile'})`.

## Dùng trong gói game (gói phải tự chứa)
1. Dán nguyên `cards.js` vào **đầu** `client/index.js` (trong IIFE của game → `JGCards` là biến cục bộ).
2. Chép `cards.css` vào cuối `client/style.css`. Muốn tiền tố riêng: `sed 's/jgk-/jglk-/g'` cho CẢ hai file (lớp CSS nằm trong chuỗi JS).
3. Mã lá giống máy chủ Tiến lên: hạng `A 2..10 J Q K` (+ `T` = 10) + chất `S C D H` → `'10H'`, `'QS'`, `'2C'`.

```js
var hand = document.createElement('div'); hand.className = 'jgk-hand';
view.hand.forEach(function (code, i) {
  var c = JGCards.el(code);                         // <button class="jgk-card" data-suit="h" aria-label="10 cơ">
  c.style.setProperty('--i', i); c.classList.add('is-deal');   // chia bài: 260 ms/lá, so le 60 ms
  c.onclick = function () { c.classList.toggle('is-sel'); game.sound('tick'); };
  hand.appendChild(c);
});
hand.style.setProperty('--n', view.hand.length);   // lá tự co để 13 lá vừa 328px
JGCards.fan(hand); hand.classList.add('is-fan');   // (tùy) xòe quạt
JGCards.flip(el, 'AS');                             // lật 320 ms; null = úp
var stack = '<div class="jgk-stack' + (n <= 2 ? ' is-low' : '') + '">' + JGCards.back().outerHTML.repeat(3) + '<b>' + n + '</b></div>';
```

## Lớp & trạng thái
| Lớp | Ý nghĩa |
|---|---|
| `.jgk-card` (`--w`) | Lá 5:7, bo 8.5% bề rộng. Mặt LUÔN giấy sáng + mực (mọi giao diện, kể cả tối); ♥♦ `#c8102e`, ♠♣ `#17142b`. |
| `.is-back` | Lưng: ô trám chéo 2 sắc `--accent` + viền giấy + huy hiệu (ngôi sao 8 cánh + ♠). Đổi lưng: đặt `--jgk-back`. |
| `.is-sel` | Nhấc 16px + vòng `--accent` 3px. `.is-dim` lá không đánh được (tối 18%, KHÔNG làm mờ chữ). |
| `.is-hot` | Lóe viền `--hl` 2 nhịp (chặt heo, lá ăn tiền). `.is-nope` lắc ngang 320 ms (bộ sai — kèm câu lý do + `error`). |
| `.is-deal` | Bay từ `--fx/--fy` (vị trí bộ bài so với lá) vào tay, 260 ms, so le `--i × 60ms`. |
| `.jgk-hand` / `.is-fan` | Tay chồng tự co (44–92px). Quạt: xoay `--k × 1.8°`, cung `--k² × .55px`. |
| `.jgk-pile > .jgk-set` | Giữa bàn: bộ mới đè bộ cũ lệch `--rot` ±6°, `--ox` ±12px; bộ cũ `.is-old` lùi tối; `.is-in` bay từ người đánh (`--fx/--fy`) 240 ms. |
| `.jgk-stack > b` | Chồng bài úp + số lá còn; `.is-low` (≤ 2 lá) số đỏ. |
| `.jgk-4c` (trên khung) | Bài 4 màu: rô lam, chuồn lục — cho người mù màu / màn nhỏ. Nên có nút bật ở cài đặt game. |

Giao diện: nhóm Truyện tranh (`html.cm`) tự có nét mực 2px + bóng cứng; `pixel`/`cyber` góc vuông. Giảm chuyển động: mọi animation 0.01ms.

## Khuyến nghị cỡ
| Chỗ | 360–390 | 1366 |
|---|---|---|
| Tay bài 13 lá | tự co ≈ 44–46px (≥ 44 bắt buộc) | 84–92px (cổ điển) |
| Giữa bàn | 56–64px | 96–110px |
| Chồng bài đối thủ | 34px | 44px |
| Ba cây / Poker (2–3 lá tay) | 72–84px (vẫn kiểu điện thoại) | 110–130px |

Giấy phép: thuộc dự án Jagame, tự vẽ 08/10/2026.
