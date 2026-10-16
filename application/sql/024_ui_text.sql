-- 024_ui_text: cỡ chữ người chơi chọn ở /ho-so: '' = Vừa, 'l' = Lớn, 'xl' = Rất lớn. Đồng bộ giữa máy (localStorage jg_text cho khách / máy này). Chỉ ADD.
ALTER TABLE users ADD COLUMN ui_text TEXT NOT NULL DEFAULT '';
