-- 008_notifications: chuông thông báo dùng chung (mọi loại) + Web Push. Chỉ ADD (bảng notifications tạo ở 007).
-- Loại chung (kind = message | mention | invite | approved | system | …): chữ do nơi phát đặt sẵn ở title/body (PHP helper
-- notify_user() hoặc Node Realtime/lib/features/notify.js notify()); các loại P2 (heart, post_*, badge, report) vẫn dựng chữ từ kind+ref.
ALTER TABLE notifications ADD COLUMN title TEXT;
ALTER TABLE notifications ADD COLUMN body TEXT;
-- push: 0 = chỉ chuông trong app; 1 = gửi Web Push khi người nhận KHÔNG online; 2 = luôn gửi Web Push (SW tự bỏ qua nếu app đang mở).
-- Node (features/notify.js) gửi push cho dòng src='node' ngay lúc ghi; dòng src='php' được quét sau tín hiệu database/.posts_rev.
ALTER TABLE notifications ADD COLUMN push INTEGER NOT NULL DEFAULT 0;

-- Đăng ký Web Push của từng trình duyệt (PushSubscription): endpoint duy nhất; đăng nhập người khác trên cùng máy thì endpoint
-- chuyển sang user_id mới (POST /thong-bao/push). Node xóa khi dịch vụ đẩy trả 404/410 hoặc lỗi liên tiếp quá nhiều.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    ua         TEXT NOT NULL DEFAULT '',
    fail_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    last_ok_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions (user_id);
