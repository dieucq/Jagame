# Quy trình đóng góp — BẮT BUỘC cho mọi đóng góp vào Jagame

Ai muốn đưa bất cứ thứ gì vào hệ thống (báo lỗi, game mới, bản cập nhật, sửa game) đều đi qua **đúng 1 trong 4 luồng** dưới đây.
Không có luồng thứ năm. Lõi hệ thống (máy chủ hội quán, đồng bộ kho, tên miền, bảo mật) là **mã đóng**, chỉ phát hành ở dạng đã mã hóa,
nên repo này **không nhận Pull Request sửa lõi**. Ứng xử: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Lỗi bảo mật: [SECURITY.md](SECURITY.md).

| Bạn muốn | Luồng | Kênh |
|---|---|---|
| Báo lỗi hoặc xin tính năng (lõi, game chính thức, game cộng đồng) | 1 | Issue (mẫu `Báo lỗi` / `Yêu cầu tính năng`) |
| Gửi game hoặc ứng dụng mới | 2 | Pull Request vào `submissions/<id>/` |
| Sửa / cập nhật game **của chính mình** | 3 | Pull Request vào `submissions/<id>/` (chỉ tác giả gốc) |
| Sửa game **của người khác** | 4 | Issue gắn @tác-giả, hoặc PR vào bản fork của tác giả |

---
## Luồng 1 — Báo lỗi / yêu cầu sửa
- **Ai:** bất kỳ ai có tài khoản GitHub.
- **Các bước:** (1) tìm Issue trùng trước; (2) mở Issue mới bằng mẫu **Báo lỗi** (`bao-loi.md`) hoặc **Yêu cầu tính năng** (`yeu-cau-tinh-nang.md`);
  (3) ghi rõ phạm vi: *lõi hệ thống* / *game chính thức `<id>`* / *game cộng đồng `<id>`* (game cộng đồng: gắn @tác-giả, xem `submissions/OWNERS.json`);
  (4) Báo lỗi phải có bước tái hiện, kết quả mong đợi/thực tế, thiết bị + trình duyệt, phiên bản hội quán (Quản trị → Sức khỏe), ảnh chụp.
- **Mẫu:** `.github/ISSUE_TEMPLATE/bao-loi.md`, `.github/ISSUE_TEMPLATE/yeu-cau-tinh-nang.md`.
- **Thời hạn phản hồi:** đội Jagame xác nhận/gắn nhãn trong **7 ngày**; game cộng đồng do tác giả trả lời (đội Jagame theo dõi lỗi nặng).
- **Kết quả:** lõi + game chính thức → đội Jagame sửa và phát hành bản mới (hội quán tự cập nhật); game cộng đồng → tác giả gửi bản sửa theo luồng 3.
- **Lỗi bảo mật:** KHÔNG mở Issue công khai — báo riêng qua **GitHub Security Advisory** theo [SECURITY.md](SECURITY.md).
- **Bị đóng khi:** trùng Issue khác · thiếu bước tái hiện sau 14 ngày nhắc · là câu hỏi cài đặt (chuyển sang hướng dẫn) · kèm PR sửa lõi · nội dung vi phạm CODE_OF_CONDUCT.

## Luồng 2 — Gửi game hoặc ứng dụng mới
- **Ai:** bất kỳ ai (người hoặc AI agent thay người) — trừ tài khoản bị chặn.
- **Các bước + mẫu:** làm đúng [QUY-TAC-GUI-GAME.md](QUY-TAC-GUI-GAME.md) (R1–R16) theo chuẩn [CHUAN-GIAO-TIEP.md](CHUAN-GIAO-TIEP.md). Tóm tắt: fork →
  `node devkit/jagame.js new <id>` → viết game → `submit` → nhánh `gui-<id>` → 3 lệnh kiểm ĐẠT → PR tiêu đề `[Gửi game] <id> v<version> — <Tên>`,
  mô tả theo `.github/pull_request_template.md`.
- **Thời hạn:** máy kiểm chạy ngay; chủ kho duyệt tay trong khoảng **7 ngày**.
- **Kết quả:** PR **không merge**; game được ký hạng **Cộng đồng**, lên Chợ game, PR đóng kèm "đã phát hành v<version>". Tài khoản GitHub mở PR
  được ghi là **chủ sở hữu** game (`submissions/OWNERS.json`).
- **Bị từ chối khi:** máy kiểm báo mã `E_…` (bảng: `developers/AI-RULES.md` mục 7), hoặc vi phạm R15–R16 khi duyệt tay.

## Luồng 3 — Sửa / cập nhật game của chính mình
- **Ai:** **chỉ tác giả gốc** = tài khoản GitHub được ghi lúc duyệt lần đầu (`submissions/OWNERS.json`). Người khác mở PR cho id đó → máy kiểm
  chặn **`E_NOT_OWNER`**.
- **Các bước:** (1) PR MỚI vào `submissions/<id>/`, nhánh `gui-<id>`, gửi lại **đủ cả thư mục** (bản trước không nằm trong `main`);
  (2) tăng `version` theo semver: sửa lỗi `0.1.0 → 0.1.1`, thêm tính năng `0.1.1 → 0.2.0`, đổi lớn `→ 1.0.0`; (3) cập nhật `changelog` + `news` trong
  manifest **và** có `submissions/<id>/CHANGELOG.md` ghi mục cho phiên bản mới (thiếu → `E_CHANGELOG`); (4) chạy 3 lệnh kiểm như luồng 2.
- **Đổi luật thắng/thua / tính điểm:** PHẢI ghi rõ trong mục "Mô tả ngắn" của PR (cái gì đổi, vì sao); chủ kho chơi thử trước khi duyệt.
- **Tương thích:** luật được **ghim theo phiên bản** cho ván cờ thư và ván đang lưu — bản mới MUST đọc được state của bản cũ hoặc không đổi
  dạng state; không đổi tên loại nước đi đang dùng; xóa tùy chọn ván phải có giá trị mặc định thay thế.
- **Thời hạn:** như luồng 2 (~7 ngày). **Kết quả:** bản mới lên Chợ; hội quán đã cài tự cập nhật; ván đang dở vẫn chơi theo bản cũ.
- **Bị từ chối khi:** `E_NOT_OWNER`, `E_CHANGELOG`, version không tăng, phá ván đang dở, đổi luật không ghi rõ, hoặc mọi lý do của luồng 2.

## Luồng 4 — Sửa game của người khác
- **Ai:** bất kỳ ai, nhưng **không được gửi PR trực tiếp** vào `submissions/<id>/` của game không phải của mình (`E_NOT_OWNER`).
- **Các bước:** (1) mở Issue mẫu **Báo lỗi** / **Yêu cầu tính năng**, gắn **@tác-giả** (login trong `submissions/OWNERS.json`), hoặc
  (2) gửi PR vào **repo/bản fork của tác giả**; tác giả tự đưa thay đổi vào bản cập nhật theo luồng 3 (ghi công bạn trong CHANGELOG).
- **Game chính thức của Jagame:** chỉ nhận Issue báo lỗi / đề xuất — **không nhận PR**.
- **Tiếp quản game bị bỏ:** tác giả không phản hồi Issue/PR **quá 90 ngày** → mở Issue "Xin tiếp quản `<id>`" (lý do, các Issue không được trả lời,
  kế hoạch). Chủ kho xem xét trong **14 ngày** và quyết định; được chấp thuận thì bạn gửi theo luồng 3 và trở thành chủ sở hữu mới (ghi sổ).
  Game giữ nguyên giấy phép gốc; tác giả cũ vẫn được ghi công.
- **Bị từ chối khi:** PR thẳng vào game của người khác · xin tiếp quản khi chưa đủ 90 ngày · thay đổi trái giấy phép gốc.

---
## Áp dụng chung
- Mọi PR chỉ được chạm **đúng 1** thư mục `submissions/<id>/` (`E_PATH_OUTSIDE`, `E_MULTI_GAME`); tệp gốc repo, `devkit/`, `developers/`, `.github/`,
  `submissions/OWNERS.json` chỉ chủ kho sửa.
- Máy kiểm GitHub chỉ đọc (`contents: read`, không secret), chạy công cụ của nhánh gốc. Chủ kho kiểm lại toàn bộ trên máy riêng trước khi ký.
- Vi phạm nghiêm trọng (mã độc, đánh cắp dữ liệu, giả danh tác giả) → thu hồi game ở mọi hội quán + chặn tài khoản.

---
## English summary
Mandatory for every contribution. The server core is closed source (shipped encrypted): **no pull requests to the core**.
**Flow 1 — bug reports / feature requests** (core, official games, community games): GitHub Issues only, using the `bao-loi.md` (repro steps,
device, clubhouse version, screenshots) or `yeu-cau-tinh-nang.md` templates; triage within 7 days; the Jagame team fixes core/official games, community
authors fix theirs. Security issues: never public — private GitHub Security Advisory ([SECURITY.md](SECURITY.md)).
**Flow 2 — new game/app:** follow [QUY-TAC-GUI-GAME.md](QUY-TAC-GUI-GAME.md) and [CHUAN-GIAO-TIEP.md](CHUAN-GIAO-TIEP.md); PR to `submissions/<id>/`,
reviewed in ~7 days, not merged; published as Community tier; the PR opener becomes the game owner (`submissions/OWNERS.json`).
**Flow 3 — update your own game:** only the original author (GitHub login recorded at first approval; others get `E_NOT_OWNER`); new PR with the full
folder, semver bump, `CHANGELOG.md` entry (`E_CHANGELOG`), clearly state any win/score rule change, keep saved/correspondence games compatible
(rules are pinned per version).
**Flow 4 — fix someone else's game:** never a direct PR; open an Issue mentioning @author or send a PR to the author's fork. Official Jagame games accept
issues only. Abandoned games (author silent > 90 days): request a takeover via Issue; the maintainer decides within 14 days.
