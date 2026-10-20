-- 035_msg_deleted_by.sql — ai thu hồi tin (QA 20/10 BUG-05). Chỉ ADD.
-- deleted_by = id người bấm thu hồi (người gửi hoặc quản trị viên). Khác messages.user_id -> client hiện "Tin đã bị quản trị viên gỡ"
-- thay vì "Bạn đã thu hồi". NULL = tin cũ / chưa biết (giữ chữ cũ). Node (lib/chat/model.js) chỉ đọc/ghi khi cột đã có.
ALTER TABLE messages ADD COLUMN deleted_by INTEGER;
