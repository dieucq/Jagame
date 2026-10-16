-- 026_async_vacation: "Nghỉ phép" cho Cờ thư. Chỉ ADD. Node (lib/games/async.js) là bên duy nhất ghi.
CREATE TABLE IF NOT EXISTS async_vacation (
    user_id    INTEGER PRIMARY KEY,
    until      INTEGER NOT NULL DEFAULT 0,   -- ms epoch hết kỳ nghỉ hiện tại (0 / quá khứ = không nghỉ)
    started_at INTEGER NOT NULL DEFAULT 0,
    year       INTEGER NOT NULL DEFAULT 0,   -- năm của used_ms
    used_ms    INTEGER NOT NULL DEFAULT 0    -- quỹ đã dùng trong năm (hoàn phần chưa nghỉ khi tắt sớm)
);
ALTER TABLE async_games ADD COLUMN vac_added INTEGER NOT NULL DEFAULT 0;  -- ms hạn hiện tại đang được cộng do người tới lượt nghỉ phép
