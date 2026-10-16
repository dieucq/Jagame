-- 010_moderation: báo cáo, từ cấm, nhật ký kiểm duyệt, cờ nhỏ tuổi (P3 — Docs/spec/P3-nhiem-vu-giai-dau-kiem-duyet.md mục 3).
-- Node ghi reports / moderation_log (filter_hit, automute, xử lý); PHP ghi mod_words, users.is_minor, moderation_log (admin). Chỉ ADD.
-- (009 để dành cho nhiệm vụ ngày + giải đấu; Schema.php áp theo tên nên thiếu 009 vẫn chạy.)
ALTER TABLE users ADD COLUMN is_minor INTEGER NOT NULL DEFAULT 0;     -- 1 = tài khoản nhỏ tuổi (admin đánh dấu tay, không lưu ngày sinh)

-- Báo cáo nội dung: kind message (messages.id) | room_msg (<mã phòng>:<id tin RAM>) | image (messages.id của tin ảnh/album) | user (users.id).
-- snapshot: JSON chụp lúc báo (nội dung + ≤ 5 tin liền trước cùng kênh + tên/ảnh người bị báo) -> tin thu hồi sau đó vẫn xét được.
-- Chỉ admin đọc snapshot (DM chỉ xem qua báo cáo do chính người trong cuộc gửi — Q9 đã chốt).
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,
    ref         TEXT NOT NULL,
    channel     TEXT NOT NULL DEFAULT '',           -- kênh chat của tin / mã phòng (để xóa, thu hồi)
    target_id   INTEGER NOT NULL,                   -- người bị báo
    target_name TEXT NOT NULL DEFAULT '',           -- tên lúc báo (giữ khi tài khoản bị xóa)
    reporter_id INTEGER NOT NULL,
    reason      TEXT NOT NULL,                      -- rude|bully|unsafe|stranger|private|other
    severity    TEXT NOT NULL DEFAULT 'normal',     -- normal|high (stranger/unsafe/private)
    note        TEXT,
    snapshot    TEXT,
    status      TEXT NOT NULL DEFAULT 'open',       -- open|dismissed|actioned
    action      TEXT,                               -- dismiss|warn|mute|delete (hành động cuối)
    handled_by  INTEGER,
    handled_at  TEXT,
    created_at  TEXT NOT NULL,
    UNIQUE (reporter_id, kind, ref)                 -- 1 người 1 báo cáo / đối tượng
);
CREATE INDEX IF NOT EXISTS idx_reports_queue    ON reports (status, severity, id);
CREATE INDEX IF NOT EXISTS idx_reports_target   ON reports (target_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id, created_at);

-- Từ cấm (admin sửa ở Quản trị → Kiểm duyệt → Từ cấm; danh sách khởi đầu config/badwords.default.json nạp lần đầu mở trang).
-- mode: exact (khớp nguyên từ, giữ dấu) | loose (nguyên từ, bỏ dấu + leet) | sub (chuỗi con bỏ dấu, chỉ từ ≥ 5 ký tự).
CREATE TABLE IF NOT EXISTS mod_words (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    word       TEXT NOT NULL UNIQUE,                -- chữ thường, đã trim
    mode       TEXT NOT NULL DEFAULT 'loose',
    enabled    INTEGER NOT NULL DEFAULT 1,
    builtin    INTEGER NOT NULL DEFAULT 0,          -- 1 = thuộc danh sách mặc định
    created_by INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Nhật ký kiểm duyệt (admin xem/lọc; giữ 180 ngày, filter_hit 30 ngày — dọn ở nhịp /health?beat=1).
-- action: report|dismiss|warn|mute|unmute|delete|ban|unban|automute|filter_hit|word_edit|setting_edit|minor_flag
-- detail: câu mô tả ngắn — KHÔNG chứa nguyên văn tin (filter_hit chỉ lưu đoạn trích ≤ 60 ký tự đã che).
CREATE TABLE IF NOT EXISTS moderation_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id   INTEGER NOT NULL DEFAULT 0,          -- 0 = hệ thống
    action     TEXT NOT NULL,
    target_id  INTEGER,
    ref        TEXT NOT NULL DEFAULT '',            -- report id / kênh / từ khớp…
    detail     TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_modlog_time   ON moderation_log (created_at);
CREATE INDEX IF NOT EXISTS idx_modlog_target ON moderation_log (target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_modlog_action ON moderation_log (action, created_at);
