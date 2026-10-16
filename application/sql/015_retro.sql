-- 015_retro: Máy chơi game cổ điển (NES/SNES) — game do CHỦ NHÀ tự nạp ROM của mình. Chỉ ADD.
-- Tệp lưu ở database/roms/<2 hex>/<file_key> KHÔNG đuôi, chỉ phục vụ qua GET /may-co-dien/rom/<id> (Retro.php).
CREATE TABLE IF NOT EXISTS retro_roms (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    system         TEXT NOT NULL,                 -- nes | snes
    title          TEXT NOT NULL,
    sha256         TEXT NOT NULL UNIQUE,          -- của nội dung đã lưu (SNES: sau khi bỏ header 512 B)
    size           INTEGER NOT NULL,
    file_key       TEXT NOT NULL UNIQUE,          -- 128-bit hex
    mapper         INTEGER,                       -- NES: số mapper; SNES: NULL
    header_info    TEXT NOT NULL DEFAULT '',      -- chữ mô tả: "Mapper 4 · PRG 128 KB · CHR 128 KB"
    cover_key      TEXT,                          -- ảnh bìa: uploads/photos/<2 hex>/<key>_m.jpg
    players        INTEGER NOT NULL DEFAULT 1,    -- 1 | 2
    enabled        INTEGER NOT NULL DEFAULT 1,
    added_by       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    play_count     INTEGER NOT NULL DEFAULT 0,
    last_played_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_retro_system ON retro_roms (system, enabled);

INSERT OR IGNORE INTO settings (key, value) VALUES ('retro_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('retro_guest', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('retro_max_mb', '8');
