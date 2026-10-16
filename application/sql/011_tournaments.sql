-- 011_tournaments: giải đấu mini loại trực tiếp 4/8/16 (P3 mục 2 — Docs/spec/P3-nhiem-vu-giai-dau-kiem-duyet.md). Chỉ ADD.
-- Node (Realtime/lib/social/tournaments.js) là bên DUY NHẤT ghi; PHP (models/Tournament_model.php) chỉ đọc để dựng HTML/JSON.
-- Không FK cứng (users có thể bị xóa -> hiện "Người đã rời"); room_code không FK vì phòng chơi sống ở RAM của Node.

CREATE TABLE IF NOT EXISTS tournaments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    game          TEXT NOT NULL,                       -- id game 2 người (players.min = max = 2)
    size          INTEGER NOT NULL,                    -- 4|8|16 (sức chứa đăng ký)
    bracket_size  INTEGER,                             -- cỡ cây thực sau bốc thăm (lũy thừa 2 nhỏ nhất >= số người)
    rounds        INTEGER,
    status        TEXT NOT NULL DEFAULT 'registering', -- registering|running|finished|cancelled
    creator_id    INTEGER NOT NULL,
    start_at      TEXT,                                -- NULL = khi đủ người / chủ giải bấm
    wait_min      INTEGER NOT NULL DEFAULT 10,         -- phút chờ vào phòng đấu kể từ lúc trận sẵn sàng
    champion_id   INTEGER,
    runner_up_id  INTEGER,
    cancel_reason TEXT,
    created_at    TEXT NOT NULL,
    started_at    TEXT,
    finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_tour_status  ON tournaments (status, start_at);
CREATE INDEX IF NOT EXISTS idx_tour_creator ON tournaments (creator_id, status);

CREATE TABLE IF NOT EXISTS tournament_players (
    tournament_id INTEGER NOT NULL,
    user_id       INTEGER NOT NULL,
    seed          INTEGER,                             -- NULL tới khi bốc thăm
    status        TEXT NOT NULL DEFAULT 'active',      -- active|out|withdrawn|champion
    out_round     INTEGER,
    joined_at     TEXT NOT NULL,
    PRIMARY KEY (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tp_user ON tournament_players (user_id, status);

-- Mỗi trận: thắng ở (round, slot) đi tới (round+1, floor(slot/2)), vào vị trí a nếu slot chẵn, b nếu lẻ. a_id/b_id NULL = chưa có / bye.
CREATE TABLE IF NOT EXISTS tournament_matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round         INTEGER NOT NULL,                    -- 1..rounds
    slot          INTEGER NOT NULL,                    -- 0..(bracket_size / 2^round) - 1
    a_id          INTEGER,
    b_id          INTEGER,
    winner_id     INTEGER,
    state         TEXT NOT NULL DEFAULT 'waiting',     -- waiting|ready|live|done
    how           TEXT,                                -- played|bye|walkover|coin|admin
    room_code     TEXT,
    match_id      INTEGER,                             -- matches.id của ván quyết định
    draws         INTEGER NOT NULL DEFAULT 0,          -- số ván hòa đã chơi lại (tối đa 2)
    ready_at      TEXT,
    deadline_at   TEXT,
    a_in_at       TEXT,
    b_in_at       TEXT,
    nudged_at     TEXT,
    done_at       TEXT,
    UNIQUE (tournament_id, round, slot)
);
CREATE INDEX IF NOT EXISTS idx_tm_state ON tournament_matches (state, deadline_at);
CREATE INDEX IF NOT EXISTS idx_tm_room  ON tournament_matches (room_code);

-- Nhật ký hiển thị trên trang giải ("Cả hai vắng — bốc thăm may rủi", "Hòa — chơi lại"...).
CREATE TABLE IF NOT EXISTS tournament_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    text          TEXT NOT NULL,
    at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tlog ON tournament_log (tournament_id, id);
