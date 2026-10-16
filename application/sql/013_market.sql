-- 013_market: Chợ game (Docs/spec/GAME-MARKET.md) — nguồn/hạng tin cậy từng game, tự cập nhật, đề xuất của người chơi. Chỉ ADD.
ALTER TABLE games_installed ADD COLUMN source TEXT NOT NULL DEFAULT 'official';
ALTER TABLE games_installed ADD COLUMN tier TEXT NOT NULL DEFAULT 'official';
ALTER TABLE games_installed ADD COLUMN auto_update INTEGER NOT NULL DEFAULT 1;
ALTER TABLE games_installed ADD COLUMN delisted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games_installed ADD COLUMN last_error TEXT;
ALTER TABLE games_installed ADD COLUMN installed_by INTEGER;

CREATE TABLE IF NOT EXISTS game_suggestions (
    user_id    INTEGER NOT NULL,
    game_id    TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, game_id)
);

-- Hội quán đang chạy (đã có game) giữ hành vi cũ: tự cài game chính thức mới = BẬT; hội quán mới = TẮT.
INSERT OR IGNORE INTO settings (key, value) SELECT 'market_auto_official', CASE WHEN EXISTS (SELECT 1 FROM games_installed) THEN '1' ELSE '0' END;
INSERT OR IGNORE INTO settings (key, value) VALUES ('market_community', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('market_telemetry', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('sideload_enabled', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('store_channel', 'stable');
