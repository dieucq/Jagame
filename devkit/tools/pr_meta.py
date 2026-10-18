#!/usr/bin/env python3
"""Kiểm TÊN NHÁNH, TIÊU ĐỀ ([Gửi game] hoặc [Gửi ứng dụng]) và MÔ TẢ của Pull Request gửi game/ứng dụng (QUY-TAC-GUI-GAME.md R3, R4, R11) — chỉ đọc chữ, không chạy mã nào.

    python3 -I pr_meta.py --id <id> --manifest submissions/<id>/manifest.json [--branch gui-<id>] [--title "…"] [--body-file pr.md]
    # GitHub Actions: tiêu đề / mô tả / nhánh truyền qua BIẾN MÔI TRƯỜNG PR_TITLE, PR_BODY, PR_BRANCH (không nội suy vào lệnh shell)

Có --owners: id đã có chủ trong submissions/OWNERS.json -> người mở PR (--author / PR_AUTHOR) PHẢI là chủ (E_NOT_OWNER) và bài gửi
PHẢI có CHANGELOG.md ghi phiên bản mới (E_CHANGELOG) — QUY-TRINH-DONG-GOP.md luồng 3–4.
Mã thoát 0 = ĐẠT; 1 = TRƯỢT, mỗi lỗi in kèm mã [E_BRANCH_NAME] / [E_PR_TITLE] / [E_PR_BODY] / [E_NOT_OWNER] / [E_CHANGELOG]. Mẫu lấy từ ai-rules.json → "pr".
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = {
    'branch': 'gui-<id>',
    'title_regex': r'^\[Gửi (?:game|ứng dụng)\] (?P<id>[a-z][a-z0-9-]{1,31}) v(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) — (?P<name>\S.*)$',
    'title_example': '[Gửi game] bongbay v0.1.0 — Bóng bay',
    'sections': ['Tên game', 'Mô tả ngắn', 'Số người chơi', 'Tác giả và liên hệ', 'Giấy phép (mã + tài sản)', 'Nguồn ảnh và âm thanh',
                 'Xác nhận', 'Kết quả 3 lệnh', 'Ảnh chụp màn hình'],
    'results_must_contain': ['KẾT QUẢ: ĐẠT — 0 lỗi', 'PR ĐẠT — giống workflow GitHub'],
}


def load_rules():
    for p in (os.path.join(HERE, 'ai-rules.json'), os.path.join(HERE, '..', '..', 'developers', 'ai-rules.json'),
              os.path.join(HERE, '..', '..', 'Script', 'publish', 'developers', 'ai-rules.json')):
        if os.path.isfile(p):
            with open(p, encoding='utf-8') as f:
                return json.load(f).get('pr', DEFAULT)
    return DEFAULT


def sections(body):
    """{tiêu đề '## …': nội dung đã bỏ chú thích HTML}."""
    out, cur = {}, None
    body = re.sub(r'<!--.*?-->', '', body, flags=re.S)
    for line in body.replace('\r\n', '\n').split('\n'):
        m = re.match(r'^##\s+(.+?)\s*$', line)
        if m:
            cur = m.group(1).strip()
            out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return {k: '\n'.join(v).strip() for k, v in out.items()}


PLACEHOLDER = re.compile(r'<(?!img\s)[^<>\n]{1,200}>')   # chỗ trống mẫu <…> chưa điền (trừ thẻ <img>)


def empty(text):
    t = PLACEHOLDER.sub('', text)
    t = re.sub(r'[\s\-*`:·|]+', '', t)
    return not t


def check(rules, gid, manifest, branch=None, title=None, body=None):
    errs = []
    if branch is not None:
        want = rules['branch'].replace('<id>', gid)
        if branch != want:
            errs.append('[E_BRANCH_NAME] nhánh "%s" — PHẢI là "%s"' % (branch, want))
    if title is not None:
        m = re.match(rules['title_regex'], title.strip())
        if not m:
            errs.append('[E_PR_TITLE] tiêu đề "%s" sai mẫu — PHẢI đúng: "[Gửi game] %s v%s — %s" (ứng dụng: "[Gửi ứng dụng] …"; dấu — là gạch dài)' %
                        (title.strip(), gid, manifest.get('version'), manifest.get('name')))
        else:
            if m.group('id') != gid:
                errs.append('[E_PR_TITLE] tiêu đề ghi id "%s" nhưng thư mục là submissions/%s/' % (m.group('id'), gid))
            if m.group('version') != manifest.get('version'):
                errs.append('[E_PR_TITLE] tiêu đề ghi v%s nhưng manifest.version là %s' % (m.group('version'), manifest.get('version')))
            if m.group('name').strip() != str(manifest.get('name', '')).strip():
                errs.append('[E_PR_TITLE] tiêu đề ghi tên "%s" nhưng manifest.name là "%s"' % (m.group('name').strip(), manifest.get('name')))
    if body is not None:
        sec = sections(body)
        for name in rules['sections']:
            if name not in sec:
                errs.append('[E_PR_BODY] thiếu mục "## %s" (dùng mẫu .github/pull_request_template.md)' % name)
            elif empty(sec[name]):
                errs.append('[E_PR_BODY] mục "## %s" còn trống' % name)
            elif name != 'Xác nhận' and PLACEHOLDER.search(sec[name]):
                errs.append('[E_PR_BODY] mục "## %s" còn chỗ mẫu chưa điền: %s' % (name, PLACEHOLDER.search(sec[name]).group(0)[:60]))
        conf = sec.get('Xác nhận', '')
        if conf and (re.search(r'^\s*[-*]\s*\[ \]', conf, re.M) or not re.search(r'^\s*[-*]\s*\[[xX]\]', conf, re.M)):
            errs.append('[E_PR_BODY] mục "## Xác nhận": mọi ô PHẢI được đánh [x]')
        res = sec.get('Kết quả 3 lệnh', '')
        for want in rules['results_must_contain']:
            if res and want not in res:
                errs.append('[E_PR_BODY] mục "## Kết quả 3 lệnh" thiếu dòng "%s" (dán nguyên đầu ra của 3 lệnh)' % want)
        if res and res.count('KẾT QUẢ: ĐẠT') < 2:
            errs.append('[E_PR_BODY] mục "## Kết quả 3 lệnh" phải có dòng KẾT QUẢ: ĐẠT của CẢ jagame.js check và check_submission.py')
        shots = sec.get('Ảnh chụp màn hình', '')
        if shots and not re.search(r'!\[[^\]]*\]\([^)]+\)|<img\s|screenshots/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp)', shots):
            errs.append('[E_PR_BODY] mục "## Ảnh chụp màn hình" PHẢI có ảnh (![…](…)) hoặc đường dẫn screenshots/<tệp>.png trong bài gửi')
    return errs


def load_owners(path):
    """{id: github login} từ submissions/OWNERS.json (chủ kho ghi khi duyệt lần đầu). Không có tệp = {}."""
    if not path or not os.path.isfile(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return {str(k): str(v) for k, v in (json.load(f).get('owners') or {}).items()}


def check_owner(gid, author, owners, game_dir=None, version=None):
    """QUY-TRINH-DONG-GOP.md luồng 3–4: id đã có chủ -> chỉ chủ được gửi bản cập nhật, và bản cập nhật MUST có CHANGELOG.md ghi phiên bản."""
    errs = []
    owner = owners.get(gid)
    if not owner:
        return errs
    if author is not None and author.lower() != owner.lower():
        errs.append('[E_NOT_OWNER] game "%s" thuộc @%s — chỉ tác giả gốc được gửi bản cập nhật; @%s hãy mở Issue gắn @%s '
                    'hoặc gửi PR vào bản fork của @%s (QUY-TRINH-DONG-GOP.md luồng 4)' % (gid, owner, author, owner, owner))
    if game_dir is not None:
        cp = os.path.join(game_dir, 'CHANGELOG.md')
        if not os.path.isfile(cp):
            errs.append('[E_CHANGELOG] bản cập nhật của "%s" thiếu submissions/%s/CHANGELOG.md' % (gid, gid))
        elif version and version not in open(cp, encoding='utf-8', errors='replace').read():
            errs.append('[E_CHANGELOG] CHANGELOG.md chưa có mục cho phiên bản %s' % version)
    return errs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--id', required=True)
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--branch')
    ap.add_argument('--title')
    ap.add_argument('--body-file')
    ap.add_argument('--author', help='tài khoản GitHub người mở PR (GitHub Actions: biến PR_AUTHOR)')
    ap.add_argument('--owners', help='submissions/OWNERS.json của NHÁNH GỐC (tin cậy)')
    a = ap.parse_args()
    author = a.author if a.author is not None else os.environ.get('PR_AUTHOR')
    branch = a.branch if a.branch is not None else os.environ.get('PR_BRANCH')
    title = a.title if a.title is not None else os.environ.get('PR_TITLE')
    body = open(a.body_file, encoding='utf-8').read() if a.body_file else os.environ.get('PR_BODY')
    try:
        with open(a.manifest, encoding='utf-8') as f:
            manifest = json.load(f)
    except (OSError, ValueError) as e:
        print('  ✗ [E_MANIFEST_JSON] không đọc được %s: %s' % (a.manifest, e))
        return 1
    errs = check(load_rules(), a.id, manifest, branch, title, body)
    if a.owners:
        errs += check_owner(a.id, author, load_owners(a.owners), os.path.dirname(os.path.abspath(a.manifest)), manifest.get('version'))
    done = [x for x, v in (('nhánh', branch), ('tiêu đề', title), ('mô tả', body), ('tác giả', author if a.owners else None)) if v is not None]
    if errs:
        for e in errs:
            print('  ✗ ' + e)
        print('TRƯỢT — %s PR chưa đúng QUY-TAC-GUI-GAME.md (R3, R4, R11) / QUY-TRINH-DONG-GOP.md' % ' / '.join(done))
        return 1
    print('ĐẠT — %s đúng mẫu' % (' / '.join(done) or 'không có gì để kiểm'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
