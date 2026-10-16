-- 018_async_game_name: lưu sẵn tên hiển thị của trò trong ván cờ thư để vẫn đẹp khi game đã bị gỡ khỏi hội quán. Chỉ ADD.
ALTER TABLE async_games ADD COLUMN game_name TEXT;
