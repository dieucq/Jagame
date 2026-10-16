---
name: Gửi game (hỏi đáp / không dùng được Pull Request)
about: Hỏi về cách viết / gửi game, hoặc gửi gói khi bạn không thể mở Pull Request
title: "[Gửi game] <game-id> <phiên bản>"
labels: gui-game
---
<!-- Cách gửi CHÍNH THỨC là Pull Request vào submissions/<game-id>/ (developers/GUI-GAME.md). Issue này dùng để hỏi đáp,
     hoặc khi bạn thật sự không dùng được Pull Request. -->

**Loại:** [ ] Câu hỏi / góp ý ý tưởng   [ ] Gửi game qua Issue (không dùng được PR — vì sao: … )

**id / tên / phiên bản:**

**Câu hỏi hoặc mô tả game:**

**Nếu gửi game qua Issue:** đính kèm `<game-id>-<phiên bản>.jgsrc.zip` (do `node devkit/jagame.js pack <game-id>` tạo) và dán kết quả:
```
python3 devkit/check_submission.py submissions/<game-id>
```
- [ ] Gói có `README.md` + `LICENSE`, không tài sản có bản quyền, không ROM, nội dung hợp gia đình
- [ ] Tôi có quyền với mọi tệp và đồng ý cho Jagame phân phối game theo giấy phép đã ghi
