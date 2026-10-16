-- 009_quests_tournaments: nhiệm vụ hằng ngày + chuỗi ngày (P3 mục 1 — Docs/spec/P3-nhiem-vu-giai-dau-kiem-duyet.md). Chỉ ADD.
-- Node (Realtime/lib/social/quests.js) ghi toàn bộ; PHP (models/Quest_model.php) chỉ đọc.
-- Các bảng GIẢI ĐẤU (tournaments, tournament_players, tournament_matches, tournament_log — đặc tả mục 5.1) KHÔNG nằm ở đây:
-- agent giải đấu thêm vào file mới `011_tournaments.sql` (Schema.php áp theo tên file, số tăng dần).

-- 1 dòng / người / ngày / vị trí (slot 1..quests_per_day). quest_id = khóa trong config/quests.json; param = id game (play_game / win_game).
-- progress chỉ là bản chụp lần xét gần nhất — nguồn thật là sổ gốc (match_players, heart_events, messages, posts, post_comments).
-- granted = tim thực nhận (< reward khi chạm trần quest_heart_cap_day). UNIQUE (user_id, day, slot) + INSERT OR IGNORE: 2 tab cùng tạo
-- ngày mới vẫn ra 1 bộ duy nhất.
CREATE TABLE IF NOT EXISTS user_quests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    day        TEXT NOT NULL,
    slot       INTEGER NOT NULL,
    quest_id   TEXT NOT NULL,
    param      TEXT NOT NULL DEFAULT '',
    goal       INTEGER NOT NULL,
    progress   INTEGER NOT NULL DEFAULT 0,
    reward     INTEGER NOT NULL DEFAULT 1,
    granted    INTEGER NOT NULL DEFAULT 0,
    done_at    TEXT,
    rerolled   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, day, slot)
);
CREATE INDEX IF NOT EXISTS idx_uq_user_done ON user_quests (user_id, done_at);
CREATE INDEX IF NOT EXISTS idx_uq_day       ON user_quests (day);

-- 1 dòng / người / ngày: tổng tim hệ thống đã nhận trong ngày (nhiệm vụ + thưởng trọn ngày + streak) để kiểm trần; all_done_at = xong cả bộ.
-- rerolls = số lần đã đổi nhiệm vụ trong ngày (1 lần/ngày).
CREATE TABLE IF NOT EXISTS quest_days (
    user_id     INTEGER NOT NULL,
    day         TEXT NOT NULL,
    hearts      INTEGER NOT NULL DEFAULT 0,
    all_done_at TEXT,
    rerolls     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

-- Chuỗi ngày vào hội quán (đếm sẵn, xây lại được từ daily_checkins). freezes = thẻ nghỉ đang giữ (0..1).
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id     INTEGER PRIMARY KEY,
    cur_streak  INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_day    TEXT,
    freezes     INTEGER NOT NULL DEFAULT 0,
    total_days  INTEGER NOT NULL DEFAULT 0
);

-- Điểm danh (idempotent, PK (user_id, day)) + dữ liệu vẽ lịch 7 ô: streak = chuỗi SAU điểm danh, cycle_day 1..7, reward = tim định,
-- granted = tim thực nhận (trần ngày), freeze_used = ngày hôm trước được thẻ nghỉ cứu, freeze_given = hôm nay nhận thẻ nghỉ (N7).
CREATE TABLE IF NOT EXISTS daily_checkins (
    user_id      INTEGER NOT NULL,
    day          TEXT NOT NULL,
    streak       INTEGER NOT NULL,
    cycle_day    INTEGER NOT NULL,
    reward       INTEGER NOT NULL DEFAULT 0,
    granted      INTEGER NOT NULL DEFAULT 0,
    freeze_used  INTEGER NOT NULL DEFAULT 0,
    freeze_given INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_checkins_day ON daily_checkins (day);
