-- 028_room_persist: lưu phòng chơi + ván đang chơi để khôi phục sau khi Node khởi động lại / kill -9 (Docs/spec/ROOM-PERSIST.md).
-- Chỉ Node (Realtime/lib/games/room-persist.js) đọc/ghi; PHP chỉ đọc để giữ bản luật cũ (Store::archive_for_replay,
-- Replay_model::clean_archives). Chỉ ADD.
CREATE TABLE IF NOT EXISTS room_saves (
  code         TEXT PRIMARY KEY,
  game         TEXT NOT NULL,
  game_version TEXT NOT NULL,
  host_id      INTEGER NOT NULL,
  status       TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  seats_json   TEXT NOT NULL DEFAULT '[]',
  specs_json   TEXT NOT NULL DEFAULT '[]',
  clock_json   TEXT,
  round        INTEGER NOT NULL DEFAULT 0,
  tour_json    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_room_saves_upd ON room_saves (updated_at);
CREATE INDEX IF NOT EXISTS idx_room_saves_game ON room_saves (game, game_version);

CREATE TABLE IF NOT EXISTS room_match_saves (
  code          TEXT PRIMARY KEY REFERENCES room_saves (code) ON DELETE CASCADE,
  seed          INTEGER NOT NULL,
  rng           INTEGER NOT NULL,
  state_json    TEXT NOT NULL,
  players_json  TEXT NOT NULL,
  rec_json      TEXT,
  clock_json    TEXT,
  undo_json     TEXT,
  n_moves       INTEGER NOT NULL DEFAULT 0,
  started_at    TEXT NOT NULL,
  saved_at      TEXT NOT NULL
);
