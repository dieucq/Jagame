> **Đọc trước:** [CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) — chuẩn giao tiếp chính thức (manifest, hàm, đối tượng, thông điệp) · [QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) — luật gửi R1–R16 · [developers/ai-rules.json](../developers/ai-rules.json) — luật máy đọc.

# Dành cho nhà phát triển — viết game cho Jagame

Ai cũng viết được game (và ứng dụng nhỏ chạy trong khung game: bình chọn, bảng điểm, đố vui tự soạn…) cho Jagame rồi gửi lên **Chợ game**. Chủ kho duyệt, ký hạng
**Cộng đồng**, admin từng hội quán tự quyết cài. Bạn chỉ cần Node + Python, không cần cài Jagame.

| Tài liệu | Nội dung |
|---|---|
| [BAT-DAU-NHANH.md](BAT-DAU-NHANH.md) | Game đầu tiên trong 10 phút: tạo, chạy thử, đóng gói, tự kiểm |
| [../CHUAN-GIAO-TIEP.md](../CHUAN-GIAO-TIEP.md) | **Chuẩn giao tiếp chính thức** (nguồn duy nhất): gói, manifest, luật/logic, view, client, `JGUI`, khung cách ly, thông điệp, được sửa/cấm sửa, ứng dụng không phải game |
| [GIAO-DIEN.md](GIAO-DIEN.md) | Mỹ thuật: hướng nghệ thuật, bố cục điện thoại, tín hiệu nước đi, chuyển động, âm thanh |
| [NOI-DUNG.md](NOI-DUNG.md) | Quy tắc nội dung + bản quyền (không nhân vật/tài sản có bản quyền, không ROM, hợp gia đình) |
| [GUI-GAME.md](GUI-GAME.md) | Gửi game từng bước (fork, nhánh, PR), duyệt, cập nhật, gỡ — luật gốc ở [../QUY-TAC-GUI-GAME.md](../QUY-TAC-GUI-GAME.md) |
| [AI-RULES.md](AI-RULES.md) + [ai-rules.json](ai-rules.json) | Luật dành cho AI agent (Claude Code, Codex, Cursor…): MUST/MUST NOT, cây thư mục, manifest mẫu, mã lỗi `E_…`, lệnh tự test |
| [README.en.md](README.en.md) | English summary |

Bộ công cụ: [`../devkit/`](../devkit/) — SDK, `manifest.schema.json`, `reasons.json`, `jagame.js` (new · check · play · pack · submit),
`check_submission.py`, trang chơi thử, 4 mẫu (`oantuti`, `nhatque`, `xucxac`, `binhchon` — ứng dụng không phải game).

```bash
node devkit/jagame.js new bongbay --name "Bóng bay" --author "Tên bạn"
node devkit/jagame.js play bongbay
node devkit/jagame.js submit bongbay && python3 devkit/check_submission.py submissions/bongbay
```
