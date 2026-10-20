#!/bin/bash
# Jagame — bấm đúp để chạy trên macOS (Finder mở Terminal và chạy tệp này). Chỉ gọi run_mac.sh cùng thư mục.
# Lần đầu macOS có thể chặn ("không thể mở vì không xác định được nhà phát triển"): bấm CHUỘT PHẢI vào Jagame.command
# -> Mở -> Mở. macOS 15 trở lên: Cài đặt hệ thống -> Quyền riêng tư & Bảo mật -> kéo xuống -> "Vẫn mở".
# Cách khác (không cần bấm đúp): mở Terminal, gõ "bash " rồi kéo tệp run_mac.sh vào cửa sổ, nhấn Enter.

cd "$(dirname "$0")" || exit 1
if [ ! -f ./run_mac.sh ]; then
    echo "[LỖI] Không thấy run_mac.sh cạnh Jagame.command — hãy giải nén lại cả gói jagame."
    read -r -n 1 -p "Nhấn phím bất kỳ để đóng..." _
    exit 1
fi
# Tệp tải từ trình duyệt mang cờ "quarantine": gỡ trong thư mục này để các lần sau bấm đúp không bị hỏi lại.
[ "$(uname -s)" = "Darwin" ] && xattr -d com.apple.quarantine ./*.command 2>/dev/null

bash ./run_mac.sh
RC=$?
echo ""
case "$RC" in
    0|129|130|143) ;;   # tắt bình thường: Ctrl+C / đóng cửa sổ / lệnh dừng
    *) echo "Jagame đã dừng (mã $RC). Đọc thông báo phía trên để biết lý do." ;;
esac
read -r -n 1 -p "Nhấn phím bất kỳ để đóng cửa sổ này..." _
echo ""
