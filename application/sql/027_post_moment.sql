-- 027_post_moment: "Đăng khoảnh khắc" cuối ván -> bài Ảnh vui kèm liên kết "Xem lại ván". Chỉ ADD.
-- match_game NOT NULL = bài là khoảnh khắc ván; match_id = matches.id (0 = ván không có bản xem lại).
ALTER TABLE posts ADD COLUMN match_game TEXT;
ALTER TABLE posts ADD COLUMN match_id INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_posts_moment ON posts (user_id, created_at) WHERE match_game IS NOT NULL;
