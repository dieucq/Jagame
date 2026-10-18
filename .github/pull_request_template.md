<!-- Đọc trước khi gửi: CHUAN-GIAO-TIEP.md (chuẩn giao tiếp) + QUY-TAC-GUI-GAME.md (luật gửi). Tiêu đề PR PHẢI là: [Gửi game] <id> v<version> — <Tên game>  (ứng dụng không phải game: [Gửi ứng dụng] <id> v<version> — <Tên>)
     PR CHỈ được đụng submissions/<id>/, nhánh gui-<id>. Điền ĐỦ 9 mục dưới; máy kiểm từ chối mục trống (E_PR_BODY). -->
## Tên game
<Tên game> (id `<id>`, phiên bản `<version>`, bản mới / cập nhật)

## Mô tả ngắn
<1–3 câu: game là gì, luật chính>

## Số người chơi
<min>–<max>

## Tác giả và liên hệ
<tên> — <email hoặc @github>

## Giấy phép (mã + tài sản)
Mã: <MIT…> · Tài sản: <tự vẽ, cùng giấy phép / giấy phép riêng>

## Nguồn ảnh và âm thanh
<"Tự vẽ bằng SVG/CSS, không dùng âm riêng" hoặc liệt kê: tệp — tác giả — nguồn — giấy phép>

## Xác nhận
- [ ] Tôi (hoặc AI tôi dùng) tự viết mã; không dùng nhân vật, hình, nhạc, phông, tên có bản quyền của người khác; không ROM
- [ ] Nội dung hợp gia đình 8+ tuổi; không tiền thật, không quảng cáo, không thu thập dữ liệu
- [ ] PR chỉ đụng submissions/<id>/ trên nhánh gui-<id>
- [ ] Tôi đồng ý cho Jagame phân phối game theo giấy phép đã ghi

## Kết quả 3 lệnh
```
<dán nguyên các dòng cuối của: node devkit/jagame.js check <id> · python3 devkit/check_submission.py submissions/<id> · python3 devkit/check_pr.py>
```

## Ảnh chụp màn hình
<kéo-thả ảnh vào đây, hoặc ghi đường dẫn trong bài gửi: submissions/<id>/screenshots/1.png>
