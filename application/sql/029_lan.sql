-- 029_lan: Mạng LAN ảo (Docs/research/LAN-HOST.md) — chỉ bản tự host. Cài đặt nằm ở settings (lan_enabled, lan_who, lan_allow,
-- lan_rate_kbps, lan_burst_kbps — mặc định ở Settings_model::DEFAULTS, TẮT). Node (Realtime/lib/features/lan.js) ghi 1 dòng mỗi
-- lần 1 người rời mạng; PHP chỉ đọc (Quản trị → Mạng LAN: lịch sử gần đây) và dọn dòng cũ. Chỉ ADD.
CREATE TABLE IF NOT EXISTS lan_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  ip          TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  ended_at    TEXT NOT NULL,
  bytes_in    INTEGER NOT NULL DEFAULT 0,
  bytes_out   INTEGER NOT NULL DEFAULT 0,
  frames_in   INTEGER NOT NULL DEFAULT 0,
  frames_out  INTEGER NOT NULL DEFAULT 0,
  drops       INTEGER NOT NULL DEFAULT 0,
  rtt_ms      INTEGER,
  end_reason  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_lan_sessions_end ON lan_sessions (ended_at);
CREATE INDEX IF NOT EXISTS idx_lan_sessions_user ON lan_sessions (user_id, ended_at);
