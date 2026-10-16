-- 012_match_moves: chuỗi nước của ván đã xong để XEM LẠI (GAME-BENCHMARK §3.2). Chỉ ADD. Node (Realtime/lib/games/rooms.js +
-- db.js insertMatch) là bên DUY NHẤT ghi; PHP (models/Replay_model.php) chỉ đọc quyền xem + dọn ván cũ (Health /health?beat=1,
-- settings.replay_keep_days). Dựng lại tất định: setup({players, options, now: t0}) với seed rồi lần lượt move()/undo() theo `moves`
-- (Realtime/lib/games/replay.js). Trò có tick() (thời gian thực) không ghi — không dựng lại được từ chuỗi nước.
CREATE TABLE IF NOT EXISTS match_moves (
    match_id   INTEGER PRIMARY KEY,                    -- = matches.id
    seed       INTEGER NOT NULL,                       -- seed rng của ván (sandbox mulberry32)
    t0         INTEGER NOT NULL,                       -- ms epoch lúc setup() (ctx.now); mỗi nước ghi t = ms tính từ t0
    options    TEXT NOT NULL,                          -- JSON tùy chọn ván (room.options)
    moves      TEXT NOT NULL,                          -- JSON [{s: ghế, m: nước, t, r?: seed rng trước nước khi lệch chuỗi} | {u: ghế, t, r?}]
    n          INTEGER NOT NULL,                       -- số mục trong moves
    bytes      INTEGER NOT NULL,                       -- kích thước moves (byte) — trần settings.replay_max_kb lúc ghi
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_match_moves_created ON match_moves (created_at);
