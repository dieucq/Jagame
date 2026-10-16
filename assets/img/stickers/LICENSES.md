# Giấy phép sticker Jagame

Thư mục này có hai nhóm ảnh. Không có sticker nào lấy từ Telegram, LINE, Zalo hay kho ảnh không rõ giấy phép.

## 1. Bộ v2: Cảm xúc · Chơi game · Gia đình & Tết · Động (`cx-*`, `gm-*`, `gd-*`, `dg-*`, tệp `.webp`)

Dựng lại bằng `Docs/design/svg-gen/build_stickers_v2.py`. URL và sha256 từng tệp nguồn nằm ở
`Docs/design/stickers-v2/sources.json`.

| Nhóm | Nguồn chính thức | Giấy phép (đã đối chiếu ngày 13/10/2026) | Thay đổi |
|---|---|---|---|
| `cx-*`, `gm-*`, `gd-*` (ảnh 3D tĩnh) | **Microsoft Fluent Emoji**, bản 3D: https://github.com/microsoft/fluentui-emoji (commit `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc`) | **MIT License**, Copyright (c) Microsoft Corporation. Bản đầy đủ ở tệp `LICENSE` của repo, có chép lại bên dưới | Cắt sát viền, thu về 160×160, xuất WebP. Một số sticker có thêm nhãn chữ tiếng Việt |
| `dg-*` (WebP động + khung tĩnh `-tinh.webp`) | **Noto Animated Emoji** của Google: https://googlefonts.github.io/noto-emoji-animation/ (tệp `https://fonts.gstatic.com/s/e/notoemoji/latest/<mã>/512.webp`) | **CC BY 4.0**. Trang chính thức, mục FAQ: "Animated Noto Emoji is licensed under CC BY 4.0" (https://creativecommons.org/licenses/by/4.0/legalcode) | Thu từ 512 về 160 px, bỏ bớt khung hình, đặt phát 2 lần rồi dừng, nén lại thành WebP. Khung tĩnh lấy từ khung đầu |
| Chữ trên nhãn | Phông **Be Vietnam Pro ExtraBold**: https://github.com/google/fonts/tree/main/ofl/bevietnampro (commit `66928797f271fed5ee428544e7229685e2d90127`) | **SIL Open Font License 1.1**. Ảnh chỉ chứa chữ đã vẽ ra, không kèm tệp phông | — |

**Ghi công (CC BY 4.0 yêu cầu).** Dòng ghi công nằm ở chân khay sticker trong chat (`chat-ui.js`, `.cx-st-credit`) và ở khóa
`credit` trong `index.json` / `stickers.js`:

> Sticker 3D: Microsoft Fluent Emoji (MIT) · Sticker động: Noto Animated Emoji của Google, CC BY 4.0 (đã thu nhỏ). Bộ tự vẽ: Jagame.

### MIT License (Microsoft Fluent Emoji)

```
MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE
```

### Creative Commons Attribution 4.0 (Noto Animated Emoji)

Tóm tắt: được chia sẻ và chỉnh sửa, kể cả cho mục đích thương mại, với điều kiện ghi công, dẫn link giấy phép và nói rõ
đã có chỉnh sửa. Văn bản pháp lý đầy đủ: https://creativecommons.org/licenses/by/4.0/legalcode

## 2. Bộ tự vẽ cũ (tệp `.svg`, 12 bộ: Cổ điển, Hội bạn, Mèo mũm mĩm…)

Jagame tự vẽ bằng `Docs/design/svg-gen/gen_stickers.py`, không dựa trên nhân vật hay tác phẩm của ai. Danh sách của bộ này
nằm ở `_legacy.json`. Bộ cũ vẫn giữ lại để tin nhắn cũ còn hiện đúng ảnh.
