-- 034_match_scored.sql — phiên "không tính điểm" (CHUAN-GIAO-TIEP 5.7, chuẩn 2.2). Chỉ ADD.
-- matches.scored = 0: ứng dụng kết thúc không có thắng thua (Result.scored = false hoặc manifest "scored": false). Node (db.js insertMatch)
-- đặt 0 ngay sau khi ghi; ván này KHÔNG có dòng match_players / user_stats, không xếp hạng, huy hiệu, tim thưởng, nhiệm vụ; nạp bù bỏ qua.
ALTER TABLE matches ADD COLUMN scored INTEGER NOT NULL DEFAULT 1;
