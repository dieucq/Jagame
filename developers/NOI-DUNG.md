# Quy tắc nội dung và bản quyền

Jagame là nơi **gia đình và bạn bè** (từ 8 tuổi) chơi cùng nhau. Mọi game gửi lên phải hợp với cả nhà.

## 1. Nội dung bị từ chối
- **Cờ bạc tiền thật** dưới mọi hình thức: quy đổi, mua bán, nạp, phần thưởng có giá trị thật. Game có cược chỉ dùng **"đậu ảo"**
  (khai `content: ["dau-ao"]`, mô tả ghi "(đậu ảo, không tiền thật)"), mỗi ván bắt đầu lại.
- Quảng cáo, liên kết ra ngoài, thu thập dữ liệu cá nhân, gọi mạng (giao diện không có mạng — xem ../CHUAN-GIAO-TIEP.md mục 6.5).
- Bạo lực ghê rợn, máu me, tình dục, thù ghét, phân biệt đối xử, chính trị, tôn giáo gây chia rẽ, chất kích thích, tự hại.
- Yếu tố đáng sợ quá mức với tuổi khai (`age`); có yếu tố sợ thì khai `content: ["so-hai"]`.
- Chế giễu, chê bai người thua; câu chữ thô tục.
- Mã làm rối (minified/obfuscated), mã ẩn, cố thoát khu cách ly, cố đọc dữ liệu của người chơi khác.

## 2. Bản quyền — chỉ dùng thứ bạn được phép dùng
**Không được dùng:**
- Nhân vật, tên, logo, hình, nhạc, hiệu ứng âm thanh, phông chữ của game/phim/truyện/thương hiệu khác (Pokémon, Mario, Doraemon, Liên Quân,
  logo câu lạc bộ, nhạc phim…), kể cả "vẽ lại cho giống".
- **ROM, BIOS, bản sao game thương mại**, trình giả lập kèm game; tệp `.nes .sfc .smc .gb .gba .iso .rom…` bị chặn tự động.
- Bộ câu hỏi, đề, truyện chép nguyên từ sách/web/chương trình truyền hình.
- Ảnh tải từ mạng không rõ giấy phép, ảnh người thật khi không có sự đồng ý.

**Được dùng:**
- Hình, âm, chữ **tự làm** (SVG/CSS tự vẽ là tốt nhất — nhẹ và đẹp ở mọi giao diện).
- Tài sản có giấy phép cho phép phân phối lại (CC0, CC BY, OFL cho phông, MIT…) — ghi rõ **tên tác giả, nguồn, giấy phép** trong `README.md`
  (hoặc `client/assets/LICENSE.txt`). CC BY-NC / "chỉ dùng cá nhân" KHÔNG được (hội quán có thể là dịch vụ có phí).
- Trò dân gian và luật chơi phổ biến (cờ, bài, ô ăn quan, oẳn tù tì…) — luật chơi không có bản quyền, nhưng tên thương mại và hình thì có.

## 3. Giấy phép của game bạn gửi
- Bắt buộc `LICENSE` (hoặc `LICENSE.md`/`LICENSE.txt`) cho **mã**, và `manifest.license` là mã SPDX (vd `MIT`, `Apache-2.0`, `GPL-3.0-only`).
- Gửi game = bạn đồng ý cho Jagame **phân phối** game (đóng gói, ký, đưa lên Chợ game cho mọi hội quán cài) theo giấy phép bạn chọn và
  tự xác nhận bạn có quyền với mọi tài sản trong gói.
- `manifest.author` là tên bạn (hoặc nhóm) — hiện ở Chợ game.

## 4. Chữ do người chơi gõ
Game cho người chơi gõ chữ cho nhau thấy (đoán từ, đặt tên…) phải khai `needs.user_text: true` + `content: ["chu-nguoi-choi"]`. Hội quán có
lọc từ và báo cáo vi phạm; game không tự hiện chữ đó ra ngoài phòng.

## 5. Ngôn ngữ
Giao diện tiếng Việt có dấu, lịch sự, ngắn gọn. Chữ lỗi nói cách sửa ("Chỉ còn 2 que thôi"), không dấu chấm cuối.
