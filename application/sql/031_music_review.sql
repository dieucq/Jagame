-- 031_music_review.sql — Album nhạc do thành viên nạp phải được admin duyệt (Docs/spec/ALBUMS-MUSIC.md, yêu cầu chủ dự án 15/10). Chỉ ADD.
-- music_albums.status thêm 'pending' (chờ duyệt) | 'rejected' (bị từ chối, tệp tự dọn sau 7 ngày). created_by = người đăng ("Đăng bởi <tên>").
ALTER TABLE music_albums ADD COLUMN submitted_at TEXT;      -- lúc gửi duyệt (thành viên nạp xong)
ALTER TABLE music_albums ADD COLUMN reviewed_by INTEGER;    -- admin duyệt / từ chối
ALTER TABLE music_albums ADD COLUMN reviewed_at TEXT;
ALTER TABLE music_albums ADD COLUMN review_note TEXT NOT NULL DEFAULT '';   -- lý do từ chối (hiện cho người nạp)
CREATE INDEX IF NOT EXISTS idx_music_albums_owner ON music_albums (created_by, status);
