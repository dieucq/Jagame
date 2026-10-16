-- 005_chat_groups: nhóm chat (kênh 'group:<id>') + ghim hội thoại/người. Node đọc/ghi (lib/chat/*); PHP chỉ tạo schema.
-- Thành viên nhóm: role 'owner' (1 người, người tạo; chuyển quyền khi rời) | 'member'. Xóa khỏi nhóm = mất quyền đọc/gửi ngay
-- (ChatService.access() kiểm lại CSDL mỗi lần, không cache). Tối đa 50 người/nhóm (giới hạn ở service.js, không ở CSDL).
CREATE TABLE IF NOT EXISTS chat_groups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    avatar_key TEXT,
    owner_id   INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_group_members (
    group_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    role       TEXT NOT NULL DEFAULT 'member',
    joined_at  TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user ON chat_group_members (user_id);

-- Ghim hội thoại (DM hoặc nhóm) để luôn hiện đầu danh sách; DM ghim còn lên hàng "Bạn thân". Tối đa 8 (service.js).
CREATE TABLE IF NOT EXISTS chat_pins (
    user_id    INTEGER NOT NULL,
    channel    TEXT NOT NULL,
    pinned_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, channel)
);
