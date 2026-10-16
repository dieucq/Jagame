-- 001_init: schema khởi tạo của Jagame. Libraries/Schema.php áp mỗi file .sql trong thư mục này đúng 1 lần
-- theo thứ tự tên, ghi vào app_migrations. File mới chỉ được ADD (bảng/cột/index).
-- CSDL dùng chung giữa PHP (Web/) và Node (Realtime/): Node đọc users, ghi tin nhắn/ván chơi ở các bảng sau này.

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- role:   owner (chủ server, tạo lúc cài đặt — duy nhất) | admin (được chủ cấp: sửa trang, quản lý thành viên) | member
-- status: active | pending (chờ chủ duyệt, khi chế độ vào = duyệt) | banned
-- session_version: tăng khi đổi mật khẩu / khóa tài khoản -> mọi phiên cũ (web + vé realtime) mất hiệu lực.
-- avatar_key: file_key ảnh đại diện trong photos (NULL = chữ cái đầu trên nền màu).
-- hearts: tổng tim đã nhận (đếm sẵn cho bảng xếp hạng).
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    avatar_key      TEXT,
    role            TEXT NOT NULL DEFAULT 'member',
    status          TEXT NOT NULL DEFAULT 'active',
    session_version INTEGER NOT NULL DEFAULT 0,
    hearts          INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    last_login_at   TEXT,
    last_seen_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status, id);

-- Ảnh tải lên (ảnh trang trí trang chủ, ảnh đại diện; sau này ảnh chat / ảnh vui).
-- file_key: 32 hex ngẫu nhiên — tên file trên đĩa (uploads/photos/<2 ký tự đầu>/<key>_{o,m,s,t}.<ext>), không đoán được.
-- album_id: 0 = ảnh trang trí trang chủ (Content_model), giữ tên cột để dùng lại Photo_model của thiep.site.
-- kind: deco | avatar | chat | post
CREATE TABLE IF NOT EXISTS photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id      INTEGER NOT NULL DEFAULT 0,
    kind          TEXT NOT NULL DEFAULT 'deco',
    user_id       INTEGER,
    file_key      TEXT NOT NULL UNIQUE,
    ext           TEXT NOT NULL,
    orig_name     TEXT,
    width         INTEGER,
    height        INTEGER,
    size_bytes    INTEGER,
    taken_at      TEXT,
    caption       TEXT,
    status        TEXT NOT NULL DEFAULT 'approved',
    source        TEXT NOT NULL DEFAULT 'owner',
    guest_name    TEXT,
    guest_message TEXT,
    uploader_ip   TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_album_status ON photos (album_id, status, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_photos_kind ON photos (kind, user_id, id);

-- Nhật ký cho rate-limit (đăng nhập, đăng ký...). device = mã thiết bị (cookie), '' = chỉ tính theo IP.
CREATE TABLE IF NOT EXISTS rate_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    scope      TEXT NOT NULL,
    ip         TEXT NOT NULL,
    device     TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_events ON rate_events (scope, ip, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_events_device ON rate_events (scope, device, created_at);
