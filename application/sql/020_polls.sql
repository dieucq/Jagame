-- 020_polls: bình chọn trong chat (tin kind 'poll') + chỉ mục phục vụ tìm kiếm tin. Chỉ ADD. Node là bên DUY NHẤT ghi
-- (Realtime/lib/chat/poll.js); PHP chỉ tạo schema.
-- polls: 1 dòng / tin bình chọn (message_id = messages.id, kind 'poll', messages.body = câu hỏi để tìm kiếm / xem trước).
--   multi: 1 = chọn nhiều; anon: 1 = ẩn danh (không lộ ai chọn gì); closes_at: ms epoch hạn đóng (NULL = không hạn);
--   closed_at: ms epoch người tạo/admin đóng sớm (NULL = chưa).
CREATE TABLE IF NOT EXISTS polls (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL UNIQUE,
    channel    TEXT NOT NULL,
    user_id    INTEGER NOT NULL,
    question   TEXT NOT NULL,
    multi      INTEGER NOT NULL DEFAULT 0,
    anon       INTEGER NOT NULL DEFAULT 0,
    closes_at  INTEGER,
    closed_at  INTEGER,
    closed_by  INTEGER,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_options (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    pos     INTEGER NOT NULL,
    text    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options (poll_id, pos);
CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id    INTEGER NOT NULL,
    option_id  INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (poll_id, user_id, option_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes (option_id);

-- Tìm theo người gửi trong 1 kênh (bộ lọc "của ai").
CREATE INDEX IF NOT EXISTS idx_messages_channel_user ON messages (channel, user_id, id);
