-- 019_activity: công tắc riêng tư "hiện tôi đang chơi gì" (Rich Presence kiểu Discord). 1 = hiện (mặc định), 0 = ẩn. Trẻ is_minor luôn ẩn. Chỉ ADD.
ALTER TABLE users ADD COLUMN show_activity INTEGER NOT NULL DEFAULT 1;
