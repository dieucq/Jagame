-- 004_chat: chat chung + nhắn riêng 1-1 (Node ghi/đọc — Realtime/lib/features/chat.js; PHP chỉ tạo schema + trang /chat).
-- channel: 'general' (phòng chung) | 'dm:<id nhỏ>-<id lớn>' (nhắn riêng giữa 2 người).
-- kind: text | sticker (body = mã sticker) | image (file_key ảnh trong photos, kind='chat').
-- deleted_at: người gửi / admin thu hồi -> hiện "Tin nhắn đã thu hồi" (không xóa dòng để giữ thứ tự, trả lời).
CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel    TEXT NOT NULL,
    user_id    INTEGER NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'text',
    body       TEXT NOT NULL DEFAULT '',
    file_key   TEXT,
    reply_to   INTEGER,
    created_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages (channel, id);

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
);

-- Đã đọc tới đâu (đếm tin chưa đọc, dấu "Đã xem" trong nhắn riêng).
CREATE TABLE IF NOT EXISTS chat_reads (
    user_id  INTEGER NOT NULL,
    channel  TEXT NOT NULL,
    last_id  INTEGER NOT NULL DEFAULT 0,
    read_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, channel)
);
