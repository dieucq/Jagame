-- 021_ui_mode: chế độ giao diện người chơi chọn (G11): '' = theo hội quán, 'light', 'dark'. Đồng bộ giữa máy (localStorage jg_mode vẫn ưu tiên trên máy này). Chỉ ADD.
ALTER TABLE users ADD COLUMN ui_mode TEXT NOT NULL DEFAULT '';
