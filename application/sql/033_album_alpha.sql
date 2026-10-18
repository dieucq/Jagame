-- 033_album_alpha.sql — ảnh album có nền trong suốt (QA56 BUG-2). Chỉ ADD.
-- photos.vext: đuôi các cỡ _m/_s/_t. NULL = 'jpg' như mọi ảnh cũ; 'png' = ảnh có kênh alpha thật được giữ trong suốt ở mọi cỡ
-- (Imageproc::store với $keep_alpha; chỉ ảnh album dùng). Đường dẫn: helper album_photo_path().
ALTER TABLE photos ADD COLUMN vext TEXT;
