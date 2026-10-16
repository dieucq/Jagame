-- 006_chat_files: gửi FILE trong chat + album nhiều ảnh + cấm chat tạm thời. Chỉ ADD (bảng/cột/index).
-- chat_files: file đính kèm (pdf, doc, zip, mp3, mp4…) tải qua PHP POST /chat/upload_file -> lưu uploads/files/<2 hex>/<file_key>
--   KHÔNG giữ đuôi (router không phục vụ tĩnh được; chỉ tải qua /chat/file/<key> có kiểm quyền xem kênh).
--   kind: file | audio | video (audio/video có trình phát trong luồng). message_id: gắn lúc Node nhận chat:send (NULL = chưa gửi,
--   chỉ người tải lên mở được; quá 1 giờ chưa gửi thì dọn ở nhịp /health?beat=1).
CREATE TABLE IF NOT EXISTS chat_files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    file_key   TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL,
    message_id INTEGER,
    kind       TEXT NOT NULL DEFAULT 'file',
    orig_name  TEXT NOT NULL,
    mime       TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_files_user ON chat_files (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_files_message ON chat_files (message_id);

-- messages.files: tin kind 'album' — JSON [{k:file_key ảnh (photos kind chat), w, h}, …] (≤ 10), body = ghi chú.
-- Thu hồi -> files = NULL (Node xóa luôn ảnh/file trên đĩa).
ALTER TABLE messages ADD COLUMN files TEXT;

-- Cấm chat tạm thời (admin): tới thời điểm này (Y-m-d H:i:s, giờ máy) thì Node từ chối chat:send / chat:buzz / chat:react.
ALTER TABLE users ADD COLUMN chat_mute_until TEXT;
