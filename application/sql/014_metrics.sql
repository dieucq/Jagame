-- 014_metrics: R6 nhắc chủ động + R9 "Sức khỏe hội quán" (Docs/spec/RETENTION.md). Chỉ ADD. Mọi số liệu nằm trong CSDL này, không gửi đi đâu.
-- Bộ đếm phễu theo ngày: KHÔNG có người dùng/IP, chỉ (ngày, sự kiện, nguồn) -> n. Giữ 90 ngày (dọn ở nhịp /health?beat=1).
CREATE TABLE IF NOT EXISTS funnel_daily (
    day    TEXT NOT NULL,
    event  TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    n      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, event, source)
);

-- Sổ lời nhắc chủ động đã gửi: PRIMARY KEY (user_id, day) = tối đa 1 lời nhắc hệ thống / người / ngày. kind: streak | pinned | tour.
CREATE TABLE IF NOT EXISTS reengage_log (
    user_id INTEGER NOT NULL,
    day     TEXT NOT NULL,
    kind    TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_reengage_day ON reengage_log (day);

-- Loại nhắc người dùng đã TẮT ở /ho-so (không có dòng = đang bật).
CREATE TABLE IF NOT EXISTS reengage_off (
    user_id INTEGER NOT NULL,
    kind    TEXT NOT NULL,
    PRIMARY KEY (user_id, kind)
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('reengage_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('funnel_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('club_closed', '0');
