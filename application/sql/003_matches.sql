-- 003_matches: ván chơi đã kết thúc (Node ghi — Realtime/lib/games). players/winners = JSON.
-- games_installed: gói game đang có trên máy, đồng bộ theo kho game.jagame.vn (Docs/GAME-STORE.md, libraries/Store.php).
CREATE TABLE IF NOT EXISTS matches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    game        TEXT NOT NULL,
    version     TEXT NOT NULL,
    room        TEXT NOT NULL,
    players     TEXT NOT NULL,
    winners     TEXT,
    reason      TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_game ON matches (game, ended_at);

CREATE TABLE IF NOT EXISTS games_installed (
    id           TEXT PRIMARY KEY,
    version      TEXT NOT NULL,
    sha256       TEXT NOT NULL,
    hidden       INTEGER NOT NULL DEFAULT 0,
    installed_at TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
