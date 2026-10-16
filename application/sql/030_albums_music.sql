-- 030_albums_music.sql — Album ảnh + Nghe nhạc (Docs/spec/ALBUMS-MUSIC.md mục 8). Chỉ ADD.
-- Album ảnh: Album_model + controllers/Albums.php + admin/Albums.php. Bảng nhạc tạo sẵn cho phần Nghe nhạc (logic ở nơi khác).

-- Album ảnh. Ảnh = photos (kind='album', album_id = albums.id). status draft|published.
-- visibility public|members|accounts|admins. download: -1 theo settings.album_download, 0 không, 1 có.
-- date_from/date_to: 'YYYY-MM-DD' (NULL = tự lấy từ taken_at). contrib: 1 = thành viên được góp ảnh chờ duyệt.
CREATE TABLE IF NOT EXISTS albums (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    slug           TEXT NOT NULL DEFAULT '',          -- chỉ để URL đẹp: /album/<id>-<slug>; tra theo id
    description    TEXT NOT NULL DEFAULT '',
    date_from      TEXT,
    date_to        TEXT,
    date_auto      INTEGER NOT NULL DEFAULT 1,        -- 1 = date_from/date_to tự tính từ ngày chụp (admin chưa nhập); admin nhập -> 0
    cover_photo_id INTEGER,                           -- NULL = ảnh đầu theo thứ tự
    cover_pos      TEXT NOT NULL DEFAULT '',          -- "x y zoom" như ed_img()
    visibility     TEXT NOT NULL DEFAULT 'members',
    download       INTEGER NOT NULL DEFAULT -1,
    contrib        INTEGER NOT NULL DEFAULT 0,
    sort_mode      TEXT NOT NULL DEFAULT 'taken',     -- taken | newest | manual
    status         TEXT NOT NULL DEFAULT 'draft',
    pinned         INTEGER NOT NULL DEFAULT 0,
    photo_count    INTEGER NOT NULL DEFAULT 0,        -- đếm ảnh approved (phi chuẩn hóa cho lưới vỏ album, cập nhật cùng giao dịch)
    pending_count  INTEGER NOT NULL DEFAULT 0,
    created_by     INTEGER NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    published_at   TEXT,                              -- lần xuất bản đầu (chống báo lại)
    notified_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_albums_list ON albums (status, pinned DESC, date_from DESC, id DESC);

-- Ảnh góp chờ duyệt: photos.status 'pending' -> 'approved' | xóa khi từ chối; photos.source 'member'. Ảnh admin ẩn: status 'hidden'.
CREATE INDEX IF NOT EXISTS idx_photos_album_taken ON photos (album_id, status, taken_at, id);
-- Chống trùng trong album (AL-02 AC6) + gỡ theo băm.
ALTER TABLE photos ADD COLUMN sha256 TEXT;
-- Màu chủ đạo '#rrggbb' (ảnh album: tính 1×1 lúc xử lý) — nền ô ảnh khi chưa nạp (Docs/design/ALBUMS-MUSIC.md 3.2).
ALTER TABLE photos ADD COLUMN color TEXT;
CREATE INDEX IF NOT EXISTS idx_photos_sha ON photos (album_id, sha256);

-- Nhãn "Mới": người đã mở album.
CREATE TABLE IF NOT EXISTS album_views (
    album_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    seen_at    TEXT NOT NULL,
    PRIMARY KEY (album_id, user_id)
);

-- Album nhạc. visibility như albums (không cho 'public'). credit: ghi công giấy phép (CC BY), hiện khi phát.
CREATE TABLE IF NOT EXISTS music_albums (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    artist         TEXT NOT NULL DEFAULT '',
    year           INTEGER,
    description    TEXT NOT NULL DEFAULT '',
    credit         TEXT NOT NULL DEFAULT '',
    cover_photo_id INTEGER,                           -- photos kind='music_cover'
    visibility     TEXT NOT NULL DEFAULT 'members',
    download       INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'draft',     -- draft | published | removed (gỡ do khiếu nại: giữ dòng để kiểm toán)
    source         TEXT NOT NULL DEFAULT 'owner',     -- owner | builtin (thư viện tự do của gói/nền tảng)
    sort_order     INTEGER NOT NULL DEFAULT 0,
    track_count    INTEGER NOT NULL DEFAULT 0,
    total_ms       INTEGER NOT NULL DEFAULT 0,
    size_bytes     INTEGER NOT NULL DEFAULT 0,
    created_by     INTEGER NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    published_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_music_albums_list ON music_albums (status, sort_order, id DESC);

-- Bài nhạc. Tệp: uploads/music/<2 hex>/<file_key> KHÔNG đuôi; phục vụ qua /nhac/tep/<file_key>.
CREATE TABLE IF NOT EXISTS music_tracks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id    INTEGER NOT NULL,
    import_id   INTEGER,
    file_key    TEXT NOT NULL UNIQUE,                 -- 32 hex ngẫu nhiên
    ext         TEXT NOT NULL,                        -- mp3|m4a|ogg|opus|flac (chỉ để đặt tên khi tải về)
    mime        TEXT NOT NULL,
    codec       TEXT NOT NULL DEFAULT '',             -- mp3|aac|alac|vorbis|opus|flac (cảnh báo tương thích)
    title       TEXT NOT NULL,
    artist      TEXT NOT NULL DEFAULT '',
    disc_no     INTEGER NOT NULL DEFAULT 1,
    track_no    INTEGER,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    duration_est INTEGER NOT NULL DEFAULT 0,          -- 1 = ước tính theo bitrate
    bitrate     INTEGER,
    gain_db     REAL,                                 -- ReplayGain nếu có
    size_bytes  INTEGER NOT NULL,
    sha256      TEXT NOT NULL,
    orig_name   TEXT,
    tag_flags   TEXT NOT NULL DEFAULT '',             -- vd 'enc' = tên có ký tự lạ cần kiểm
    status      TEXT NOT NULL DEFAULT 'ready',        -- ready | removed
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_music_tracks_album ON music_tracks (album_id, status, disc_no, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_music_tracks_sha ON music_tracks (sha256);

-- Một lần nạp (tệp lẻ / thư mục / zip) + CAM KẾT bản quyền. Tiến độ khúc tải để ở tệp job (như market_jobs), không ở đây.
CREATE TABLE IF NOT EXISTS music_imports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    kind         TEXT NOT NULL,                       -- files | folder | zip
    status       TEXT NOT NULL DEFAULT 'uploading',   -- uploading | review | done | failed | cancelled
    attest_text  TEXT NOT NULL,                       -- nguyên văn câu cam kết đã hiện
    attested_at  TEXT NOT NULL,
    attest_ip    TEXT,
    files_total  INTEGER NOT NULL DEFAULT 0,
    files_ok     INTEGER NOT NULL DEFAULT 0,
    files_skip   INTEGER NOT NULL DEFAULT 0,
    bytes_total  INTEGER NOT NULL DEFAULT 0,
    errors       TEXT NOT NULL DEFAULT '[]',          -- JSON [{name, code}]
    created_at   TEXT NOT NULL,
    finished_at  TEXT
);
