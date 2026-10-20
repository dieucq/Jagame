#!/bin/bash
# Jagame — CẬP NHẬT trên macOS: bấm đúp tệp này trong thư mục jagame MỚI vừa giải nén, kéo thư mục jagame CŨ vào cửa sổ,
# nhấn Enter. Dữ liệu (database, uploads, games, cloudflared) được chép sang bản mới rồi bản mới tự chạy; thư mục cũ giữ nguyên.
# macOS chặn lần đầu: bấm CHUỘT PHẢI -> Mở -> Mở (macOS 15+: Cài đặt hệ thống -> Quyền riêng tư & Bảo mật -> "Vẫn mở").
cd "$(dirname "$0")" || exit 1
[ "$(uname -s)" = "Darwin" ] && xattr -d com.apple.quarantine ./*.command 2>/dev/null
bash ./cap-nhat-tu-ban-cu.sh "$@"
RC=$?
echo ""
read -r -n 1 -p "Nhấn phím bất kỳ để đóng cửa sổ này..." _
echo ""
exit "$RC"
