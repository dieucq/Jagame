-- 025_golden_seasons: Giờ vàng + Mùa giải 4 tuần + khung avatar (Docs/spec/EVENTS-SEASONS.md phần B). Chỉ ADD.
-- Node (Realtime/lib/social/{golden,seasons}.js) là bên ghi seasons / season_scores / season_awards / golden_runs + dòng thưởng heart_events ctx 'gold';
-- PHP ghi golden_slots (admin/settings/golden) và users.avatar_frame (/ho-so/khung), còn lại chỉ đọc. Giờ là giờ web 'YYYY-MM-DD HH:MM:SS'.

-- Khung giờ vàng trong tuần. dow: 0 = Thứ Hai ... 6 = Chủ nhật. from_hm < to_hm trong cùng 1 ngày, dài ≤ 3 giờ (kiểm ở PHP + Node).
-- auto_tour_*: chỗ dành cho "tự mở giải mini" (B-5, chưa dùng ở lát đầu).
CREATE TABLE IF NOT EXISTS golden_slots (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    dow            INTEGER NOT NULL,
    from_hm        TEXT NOT NULL,
    to_hm          TEXT NOT NULL,
    auto_tour_game TEXT,
    auto_tour_size INTEGER,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL
);

-- Mỗi (khung, ngày) đã làm gì: thông báo đầu giờ đúng 1 lần (idempotent khi Node khởi động lại).
CREATE TABLE IF NOT EXISTS golden_runs (
    slot_id     INTEGER NOT NULL,
    day         TEXT NOT NULL,
    notified_at TEXT,
    tour_id     INTEGER,
    PRIMARY KEY (slot_id, day)
);

-- Mùa giải. start_at gồm, end_at LOẠI (00:00 thứ Hai sau tuần cuối). status scheduled|running|finished; finalized_at đặt đúng 1 lần lúc chốt.
CREATE TABLE IF NOT EXISTS seasons (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    no           INTEGER NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    start_at     TEXT NOT NULL,
    end_at       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'running',
    finalized_at TEXT,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons (status, end_at);

-- Bảng điểm CHỐT (bất biến). name = tên lúc chốt (người bị xóa/khóa sau này vẫn hiện trong lịch sử). rank_no 1..n chỉ cho người đạt ngưỡng.
CREATE TABLE IF NOT EXISTS season_scores (
    season_id INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    name      TEXT NOT NULL DEFAULT '',
    avatar    TEXT,
    points    INTEGER NOT NULL DEFAULT 0,
    rank_no   INTEGER NOT NULL DEFAULT 0,
    played    INTEGER NOT NULL DEFAULT 0,
    won       INTEGER NOT NULL DEFAULT 0,
    p_match   INTEGER NOT NULL DEFAULT 0,
    p_quest   INTEGER NOT NULL DEFAULT 0,
    p_heart   INTEGER NOT NULL DEFAULT 0,
    p_tour    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (season_id, user_id)
);

-- Phần thưởng vinh danh: kind gold|silver|bronze|finisher. Huy hiệu + khung avatar suy ra từ đây.
CREATE TABLE IF NOT EXISTS season_awards (
    season_id  INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    PRIMARY KEY (season_id, user_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_sa_user ON season_awards (user_id);

-- Khung đang đeo, dạng 's<số mùa>-<gold|silver|bronze|finisher>' (NULL = không đeo).
ALTER TABLE users ADD COLUMN avatar_frame TEXT;
