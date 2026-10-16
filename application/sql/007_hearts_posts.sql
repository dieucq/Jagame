-- 007_hearts_posts: tim, ảnh vui, thống kê ván, huy hiệu, thông báo (P2 — Docs/spec/P2-tim-anh-vui.md). Chỉ ADD.
-- Node ghi: heart_events, match_players, user_stats, badges_earned, notifications(src='node'). PHP ghi: posts*, notifications(src='php').
ALTER TABLE users ADD COLUMN post_ban INTEGER NOT NULL DEFAULT 0;      -- 1 = không đăng / bình luận ảnh vui

-- Sổ gốc mỗi tim 1 dòng. from_id = 0: tim thưởng của hệ thống (ctx 'bonus'). users.hearts = tổng tim nhận (đếm sẵn, Node cập nhật
-- cùng giao dịch). day = 'YYYY-MM-DD' giờ web (quota ngày). ip chỉ lưu khi người tặng là khách (trần theo IP). revoked_at: admin thu hồi.
CREATE TABLE IF NOT EXISTS heart_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id    INTEGER NOT NULL,
    to_id      INTEGER NOT NULL,
    ctx        TEXT NOT NULL,
    ref        TEXT NOT NULL DEFAULT '',
    amount     INTEGER NOT NULL DEFAULT 1,
    day        TEXT NOT NULL,
    ip         TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_heart_from_day ON heart_events (from_id, day);
CREATE INDEX IF NOT EXISTS idx_heart_pair_day ON heart_events (to_id, from_id, day);
CREATE INDEX IF NOT EXISTS idx_heart_to_time  ON heart_events (to_id, created_at);
CREATE INDEX IF NOT EXISTS idx_heart_ip_day   ON heart_events (ip, day);

-- 1 dòng / người / ván (chuẩn hóa từ matches.players/winners — Node ghi lúc ván xong + nạp bù lúc khởi động).
-- result: win | draw | loss. counted = 1: ván tính xếp hạng / huy hiệu / tim thưởng (≥ 2 người thật, ≥ 20 s, cặp ≤ 10 ván/ngày).
CREATE TABLE IF NOT EXISTS match_players (
    match_id  INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    game      TEXT NOT NULL,
    result    TEXT NOT NULL,
    counted   INTEGER NOT NULL DEFAULT 1,
    ended_at  TEXT NOT NULL,
    PRIMARY KEY (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_game_time ON match_players (game, ended_at);
CREATE INDEX IF NOT EXISTS idx_mp_user_time ON match_players (user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_mp_time      ON match_players (ended_at);

-- Thống kê "mọi lúc" + chuỗi thắng theo game (game = '*' là tổng). Xây lại được từ match_players.
CREATE TABLE IF NOT EXISTS user_stats (
    user_id      INTEGER NOT NULL,
    game         TEXT NOT NULL,
    played       INTEGER NOT NULL DEFAULT 0,
    won          INTEGER NOT NULL DEFAULT 0,
    drawn        INTEGER NOT NULL DEFAULT 0,
    lost         INTEGER NOT NULL DEFAULT 0,
    cur_streak   INTEGER NOT NULL DEFAULT 0,
    best_streak  INTEGER NOT NULL DEFAULT 0,
    lose_streak  INTEGER NOT NULL DEFAULT 0,
    last_play_at TEXT,
    PRIMARY KEY (user_id, game)
);

-- Huy hiệu đã nhận (định nghĩa ở application/config/badges.json — PHP và Node cùng đọc).
CREATE TABLE IF NOT EXISTS badges_earned (
    user_id   INTEGER NOT NULL,
    badge     TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    PRIMARY KEY (user_id, badge)
);

-- Ảnh vui: bài = chú thích + 1–10 ảnh (photos kind='post'). status visible | hidden (hidden_by = admin id, 0 = tự ẩn do báo cáo).
-- updated_at đổi khi có cảm xúc / bình luận / ẩn -> Node biết bài nào đổi để phát post:changed.
CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    caption       TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'visible',
    hidden_by     INTEGER,
    hidden_at     TEXT,
    photo_count   INTEGER NOT NULL DEFAULT 0,
    react_count   INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    report_count  INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_feed   ON posts (status, id);
CREATE INDEX IF NOT EXISTS idx_posts_user   ON posts (user_id, id);
CREATE INDEX IF NOT EXISTS idx_posts_update ON posts (updated_at);

CREATE TABLE IF NOT EXISTS post_photos (
    post_id    INTEGER NOT NULL,
    photo_id   INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (post_id, photo_id)
);
CREATE INDEX IF NOT EXISTS idx_post_photos_order ON post_photos (post_id, sort_order);

-- 1 người 1 cảm xúc / bài (❤️ 😂 😮 😢 👏 🔥). KHÔNG phải tim (không đổi users.hearts, không tốn quota).
CREATE TABLE IF NOT EXISTS post_reactions (
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'text',
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_comments ON post_comments (post_id, id);

-- Báo cáo bài / bình luận (comment_id 0 = cả bài). status open | kept | hidden | deleted.
CREATE TABLE IF NOT EXISTS post_reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    comment_id  INTEGER NOT NULL DEFAULT 0,
    reporter_id INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    note        TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    handled_by  INTEGER,
    created_at  TEXT NOT NULL,
    UNIQUE (post_id, comment_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reports_open ON post_reports (status, post_id);

-- Chuông thông báo. kind: heart | post_react | post_comment | post_removed | report | badge. src php | node (Node chỉ phát lại dòng src='php').
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    from_id    INTEGER,
    ref        TEXT NOT NULL DEFAULT '',
    link       TEXT NOT NULL DEFAULT '',
    count      INTEGER NOT NULL DEFAULT 1,
    src        TEXT NOT NULL DEFAULT 'php',
    created_at TEXT NOT NULL,
    read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, id);
CREATE INDEX IF NOT EXISTS idx_notif_src  ON notifications (src, id);
