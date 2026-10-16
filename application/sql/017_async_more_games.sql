-- Cờ thư giai đoạn 2: mở thêm cờ tướng, gánh, ô ăn quan, cờ úp (đã qua ca kiểm tuần tự hóa state). Chỉ đổi khi chủ nhà chưa chỉnh danh sách.
UPDATE settings SET value = 'caro,covua,cotuong,ganh,oanquan,coup' WHERE key = 'async_games' AND value = 'caro,covua';
