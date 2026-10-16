-- 016_async: "Cờ thư" (cờ bất đồng bộ, Docs/spec/ASYNC-CHESS.md) — đi 1 nước rồi chờ đối thủ đáp trong hạn. Chỉ ADD.
-- Node (Realtime/lib/games/async.js) là bên DUY NHẤT ghi; PHP (models/Async_model.php) chỉ đọc.
CREATE TABLE IF NOT EXISTS async_games (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    game          TEXT    NOT NULL,
    game_version  TEXT    NOT NULL,                  -- phiên bản luật ghim lúc tạo (ghim theo ván)
    status        TEXT    NOT NULL,                  -- invited | playing | done | cancelled
    options       TEXT    NOT NULL DEFAULT '{}',     -- JSON tùy chọn ván của game
    per_move_ms   INTEGER NOT NULL,                  -- hạn mỗi nước (ms)
    inviter       INTEGER NOT NULL,                  -- người thách
    first_pref    TEXT    NOT NULL DEFAULT 'random', -- me | them | random (ai đi trước, chốt lúc nhận lời)
    p0            INTEGER NOT NULL,                  -- ghế luật 0 (đi trước)
    p1            INTEGER NOT NULL,                  -- ghế luật 1
    seed          INTEGER NOT NULL DEFAULT 0,
    rng           INTEGER NOT NULL DEFAULT 0,        -- trạng thái rng sau nước gần nhất
    state_json    TEXT,                              -- state sau nước gần nhất (NULL khi invited)
    moves_json    TEXT    NOT NULL DEFAULT '[]',     -- [{s, m, t}] cùng dạng match_moves.moves (t = ms từ t0)
    n_moves       INTEGER NOT NULL DEFAULT 0,
    turn_seat     INTEGER,                           -- ghế tới lượt (view.turn); NULL khi chưa chơi / đã xong
    due_at        INTEGER,                           -- ms epoch: hạn nước hiện tại / hạn lời mời
    due_orig      INTEGER,                           -- hạn gốc trước khi gia hạn giờ yên tĩnh / ân hạn
    grace_used    INTEGER NOT NULL DEFAULT 0,        -- đã dùng ân hạn 24 giờ (1 lần/ván)
    remind_n      INTEGER NOT NULL DEFAULT 0,        -- số lần đã nhắc ở lượt này
    push_held     INTEGER NOT NULL DEFAULT 0,        -- 1 = push "tới lượt" đang hoãn tới hết giờ yên tĩnh (chuông trong app đã gửi)
    version       INTEGER NOT NULL DEFAULT 0,        -- khóa lạc quan: tăng mỗi nước
    t0            INTEGER NOT NULL DEFAULT 0,        -- ms lúc setup()
    last_move_at  INTEGER,                           -- ms nước gần nhất (đo thời gian đáp)
    match_id      INTEGER,                           -- matches.id khi xong
    result_reason TEXT,
    winner        INTEGER,                           -- user id người thắng (NULL = hòa / chưa xong)
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    ended_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_async_due ON async_games (status, due_at);
CREATE INDEX IF NOT EXISTS idx_async_p0  ON async_games (p0, status);
CREATE INDEX IF NOT EXISTS idx_async_p1  ON async_games (p1, status);

-- Chat theo ván (chỉ 2 người chơi).
CREATE TABLE IF NOT EXISTS async_msgs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_async_msgs ON async_msgs (game_id, id);

-- Mốc đã đọc chat theo người (huy hiệu chưa đọc trên dòng ván).
CREATE TABLE IF NOT EXISTS async_reads (
    game_id  INTEGER NOT NULL,
    user_id  INTEGER NOT NULL,
    last_id  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, user_id)
);

-- Bảng xếp hạng Cờ thư RIÊNG (không trộn user_stats của ván trực tiếp). game = '*' là tổng.
CREATE TABLE IF NOT EXISTS async_stats (
    user_id    INTEGER NOT NULL,
    game       TEXT    NOT NULL,
    played     INTEGER NOT NULL DEFAULT 0,
    won        INTEGER NOT NULL DEFAULT 0,
    drawn      INTEGER NOT NULL DEFAULT 0,
    lost       INTEGER NOT NULL DEFAULT 0,
    expired    INTEGER NOT NULL DEFAULT 0,          -- số ván thua do hết hạn (chính họ bỏ dở)
    resp_n     INTEGER NOT NULL DEFAULT 0,          -- số nước đã đáp (để tính thời gian đáp TB)
    resp_ms    INTEGER NOT NULL DEFAULT 0,          -- tổng ms từ lúc tới lượt tới lúc đi
    PRIMARY KEY (user_id, game)
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('async_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('async_default_days', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('async_max', '5');
INSERT OR IGNORE INTO settings (key, value) VALUES ('async_max_minor', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('async_games', 'caro,covua');
INSERT OR IGNORE INTO settings (key, value) VALUES ('async_invite_ttl_h', '72');
