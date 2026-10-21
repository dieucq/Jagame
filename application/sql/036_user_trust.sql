-- 036_user_trust.sql — tài khoản "tin cậy" cho bảo vệ trẻ em (QA sau-20261021-chat BUG-08). Chỉ ADD.
-- trusted_at = thời điểm tài khoản bắt đầu được tin cậy (Node lib/social/moderation.js trusted()):
--   - tài khoản có trước bản này nhận mặc định '2000-01-01 00:00:00' (= luôn tin cậy);
--   - đăng ký ở chế độ open / khách "Lưu tài khoản" ở chế độ open -> bây giờ + trust_wait_hours (72 giờ, config/app.php);
--   - đăng ký bằng mã mời / được duyệt / admin bấm "Tin cậy" -> bây giờ.
-- Khi bật minor_dm = no_guest: role guest hoặc trusted_at NULL / ở tương lai = "chưa tin cậy" -> bị đối xử như khách với trẻ.
ALTER TABLE users ADD COLUMN trusted_at TEXT DEFAULT '2000-01-01 00:00:00';
