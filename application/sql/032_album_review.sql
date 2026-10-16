-- 032_album_review.sql — Album ảnh do thành viên tạo, admin duyệt (yêu cầu chủ dự án 15/10/2026, sau Docs/spec/ALBUMS-MUSIC.md). Chỉ ADD.
-- albums.status thêm 2 giá trị: 'pending' (thành viên tạo, chờ admin duyệt — chỉ người tạo + admin thấy) | 'rejected' (bị từ chối, kèm lý do;
-- người tạo xem được + xóa được; tự dọn sau 7 ngày ở /health?beat=1). source: admin (quản trị tạo) | member (thành viên/khách tạo).
ALTER TABLE albums ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE albums ADD COLUMN review_note TEXT NOT NULL DEFAULT '';   -- lý do từ chối
ALTER TABLE albums ADD COLUMN reviewed_by INTEGER;
ALTER TABLE albums ADD COLUMN reviewed_at TEXT;
ALTER TABLE albums ADD COLUMN review_notified INTEGER NOT NULL DEFAULT 0;   -- 1 = đã báo admin "album mới chờ duyệt" (khi có ảnh đầu tiên)
CREATE INDEX IF NOT EXISTS idx_albums_owner ON albums (created_by, status);
