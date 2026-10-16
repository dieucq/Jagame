-- 023_events: Sự kiện gia đình + sinh nhật (Docs/spec/EVENTS-SEASONS.md phần A). Chỉ ADD.
-- Node (Realtime/lib/social/events.js) là bên DUY NHẤT ghi events / event_rsvps / event_skips / event_reminders; PHP (models/Event_model.php) chỉ đọc
-- (trừ ảnh bìa photos kind 'event' và ngày sinh ở /ho-so). Giờ là giờ web 'YYYY-MM-DD HH:MM:SS'.
CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL DEFAULT '',
    creator_id    INTEGER NOT NULL,
    start_at      TEXT NOT NULL,                       -- buổi đầu tiên (tuần sau = +7 ngày)
    duration_min  INTEGER NOT NULL DEFAULT 60,
    repeat        TEXT NOT NULL DEFAULT 'none',        -- none|weekly
    repeat_until  TEXT,                                -- 'YYYY-MM-DD' (gồm cả ngày đó) hoặc NULL
    game_id       TEXT,
    tournament_id INTEGER,
    cover_key     TEXT,                                -- photos.file_key (kind 'event')
    status        TEXT NOT NULL DEFAULT 'active',      -- active|cancelled
    next_at       TEXT,                                -- bắt đầu buổi kế chưa kết thúc (NULL = hết buổi); tick Node giữ cho đúng
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_next    ON events (status, next_at);
CREATE INDEX IF NOT EXISTS idx_events_creator ON events (creator_id, status);

CREATE TABLE IF NOT EXISTS event_rsvps (
    event_id   INTEGER NOT NULL,
    occ_date   TEXT NOT NULL,                          -- 'YYYY-MM-DD' của buổi
    user_id    INTEGER NOT NULL,
    answer     TEXT NOT NULL,                          -- yes|maybe|no
    updated_at TEXT NOT NULL,
    PRIMARY KEY (event_id, occ_date, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON event_rsvps (user_id, occ_date);

CREATE TABLE IF NOT EXISTS event_skips (
    event_id   INTEGER NOT NULL,
    occ_date   TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (event_id, occ_date)
);

-- Mỗi người nhận 1 dòng/lần nhắc: chống nhắc lặp + giữ push bị hoãn qua giờ yên tĩnh (push_at) tới khi gửi (pushed = 1).
CREATE TABLE IF NOT EXISTS event_reminders (
    event_id INTEGER NOT NULL,
    occ_date TEXT NOT NULL,
    kind     TEXT NOT NULL,                            -- d1|h1|changed
    user_id  INTEGER NOT NULL,
    sent_at  TEXT NOT NULL,
    push_at  TEXT,                                     -- NULL = không hoãn push
    pushed   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id, occ_date, kind, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_rem_push ON event_reminders (pushed, push_at);

-- Sinh nhật: chỉ ngày-tháng 'MM-DD', mặc định ẩn. Sửa tối đa 2 lần/năm.
ALTER TABLE users ADD COLUMN birthday_md TEXT;
ALTER TABLE users ADD COLUMN birthday_show INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN birthday_edits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN birthday_edit_year INTEGER;
