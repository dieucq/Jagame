-- 022_chat_voice: tin thoại trong chat (messages.kind 'voice'). Chỉ ADD.
-- Tệp ghi âm lưu như file đính kèm (chat_files kind 'audio'); messages.file_key = khóa tệp, messages.body = JSON {"d": giây, "w": [≤ 48 cột sóng 0..100]}.
-- chat_voice_heard: ai đã nghe tin thoại nào (Node ghi qua chat:voice_heard) -> chấm "chưa nghe" đúng cả khi đổi thiết bị.
CREATE TABLE IF NOT EXISTS chat_voice_heard (
    message_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    heard_at   TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
);
