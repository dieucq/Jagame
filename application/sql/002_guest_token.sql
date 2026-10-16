-- 002_guest_token: chơi ẩn danh nhớ người chơi trên thiết bị.
-- users.guest_token = sha256 của mã ngẫu nhiên lưu trong cookie jg_guest (1 năm) của trình duyệt đã tạo tài khoản khách:
-- lần sau mở trang, ô biệt danh điền sẵn tên cũ và "Chơi ngay" vào lại ĐÚNG tài khoản đó (giữ tim, thành tích).
ALTER TABLE users ADD COLUMN guest_token TEXT;
CREATE INDEX IF NOT EXISTS idx_users_guest_token ON users (guest_token);
