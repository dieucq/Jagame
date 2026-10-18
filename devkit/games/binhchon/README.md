# Bình chọn nhanh

Mẫu **ứng dụng không phải game** của bộ công cụ phát triển Jagame: chủ phiên đặt câu hỏi + 2–4 lựa chọn, cả phòng (1–20 người) bấm
chọn cùng lúc, đủ người / hết giờ / chủ phiên chốt là hiện kết quả. Không ai thắng thua.

- **Cách dùng:** xem `howto` trong `manifest.json`.
- **Minh họa:** `players.min: 1`, `mode: ["simultaneous", "realtime"]` + `tick_ms` (hạn trả lời), phiếu bí mật trong `view`
  (`voted` chỉ là đúng/sai, `mine` chỉ gửi cho chính người chọn), chữ người dùng gõ (`needs.user_text`, `content: ["chu-nguoi-choi"]`,
  làm sạch + giới hạn độ dài ở máy chủ, `JGUI.esc` ở giao diện), chủ phiên rời thì chuyển quyền (`onResign`), kết thúc **không thắng thua**
  bằng `JGCore.end(s, {winners: [], reason: "xong-phien"})` + lý do riêng `by: "none"`, màn tổng kết tự vẽ (`ui.end: "game"`).
- **Chuẩn giao tiếp:** `CHUAN-GIAO-TIEP.md` mục "Ứng dụng không phải game".
- **Tác giả:** Jagame. **Giấy phép mã:** MIT. **Tài sản:** icon tự vẽ bằng SVG, giao diện bằng CSS, cùng giấy phép MIT; âm dùng âm có sẵn của khung.
