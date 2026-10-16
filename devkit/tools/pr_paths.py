#!/usr/bin/env python3
"""Luật đường dẫn của Pull Request gửi game: MỌI tệp đổi phải nằm trong ĐÚNG MỘT thư mục `submissions/<id>/`.

    python3 -I pr_paths.py --repo <thư mục git> --base <sha/nhánh gốc> --head <sha/nhánh PR> [--github-output <tệp>]
    python3 -I pr_paths.py --files a.txt b.txt ...          # kiểm thẳng danh sách đường dẫn (thử cục bộ)

Mã thoát 0 = hợp lệ (in id; với --github-output ghi `id=<id>`), 1 = bị chặn (in lý do). Chỉ đọc git, không chạy mã nào của PR.
Bị chặn khi: đụng tệp ngoài submissions/<id>/ (kể cả README.md gốc, .github/, devkit/), có từ 2 game trở lên, tên thư mục không phải id
hợp lệ, tệp/thư mục chấm, symlink (mode 120000) hoặc submodule (160000), đường dẫn lạ (\\, .., ký tự ngoài A-Z a-z 0-9 . _ - @ +).
"""
import argparse
import os
import re
import subprocess
import sys

ID_RE = re.compile(r'^[a-z][a-z0-9-]{1,31}$')
PART_RE = re.compile(r'^[A-Za-z0-9._@+-]+$')
HERE = os.path.dirname(os.path.abspath(__file__))
# ai-rules.json = nguồn sự thật (cạnh tệp này trong devkit, hoặc Script/publish/developers/ trong kho)
for _p in (os.path.join(HERE, 'ai-rules.json'), os.path.join(HERE, '..', '..', 'developers', 'ai-rules.json'),
           os.path.join(HERE, '..', '..', 'Script', 'publish', 'developers', 'ai-rules.json')):
    if os.path.isfile(_p):
        import json
        with open(_p, encoding='utf-8') as _f:
            _r = json.load(_f)
        ID_RE = re.compile(_r['id']['regex'])
        PART_RE = re.compile(_r['paths']['path_part_regex'])
        break


def git(repo, *args):
    r = subprocess.run(['git', '-C', repo] + list(args), capture_output=True)
    if r.returncode != 0:
        raise SystemExit('LỖI git %s: %s' % (' '.join(args), r.stderr.decode('utf-8', 'replace').strip()))
    return r.stdout


def changed(repo, base, head):
    """[(trạng thái, mode mới, đường dẫn)] — dùng merge-base để chỉ tính thay đổi CỦA PR, -z để tên lạ không bị trích dẫn."""
    mb = git(repo, 'merge-base', base, head).decode().strip()
    raw = git(repo, 'diff', '--raw', '-z', '--no-renames', '--no-ext-diff', mb, head)
    parts = raw.split(b'\0')
    out = []
    i = 0
    while i < len(parts) - 1:
        meta = parts[i].decode('utf-8', 'replace')
        path = parts[i + 1].decode('utf-8', 'replace')
        i += 2
        if not meta.startswith(':'):
            continue
        f = meta[1:].split()
        out.append((f[4][:1], f[1], path))     # :<mode cũ> <mode mới> <sha cũ> <sha mới> <trạng thái>
    return out


def check(entries):
    """entries: [(trạng thái, mode, đường dẫn)]. Trả (id | None, [lỗi]); mỗi lỗi bắt đầu bằng mã ổn định [E_…] (ai-rules.json)."""
    errs = []
    ids = set()
    if not entries:
        return None, ['[E_PATH_OUTSIDE] Pull Request không đổi tệp nào']
    for st, mode, p in entries:
        parts = p.split('/')
        if len(parts) < 3 or parts[0] != 'submissions':
            errs.append('[E_PATH_OUTSIDE] %s: nằm ngoài submissions/<id>/ — bài gửi chỉ được thêm/sửa tệp trong thư mục game của mình' % p)
            continue
        gid = parts[1]
        ids.add(gid)
        if not ID_RE.match(gid):
            errs.append('[E_ID_INVALID] %s: "%s" không phải id hợp lệ (%s)' % (p, gid, ID_RE.pattern))
        if '\\' in p or any(x in ('', '.', '..') for x in parts):
            errs.append('[E_FILE_NAME] %s: đường dẫn lạ' % p)
        elif any(x.startswith('.') for x in parts):
            errs.append('[E_DOTFILE] %s: tệp/thư mục chấm (ẩn) không được phép' % p)
        elif any(not PART_RE.match(x) for x in parts):
            errs.append('[E_FILE_NAME] %s: ký tự không cho phép trong tên (chỉ A-Z a-z 0-9 . _ - @ +)' % p)
        if st != 'D' and mode == '120000':
            errs.append('[E_SYMLINK] %s: là symlink' % p)
        if st != 'D' and mode == '160000':
            errs.append('[E_SYMLINK] %s: là submodule' % p)
    if len(ids) > 1:
        errs.append('[E_MULTI_GAME] Pull Request đụng %d game (%s) — mỗi PR chỉ 1 game' % (len(ids), ', '.join(sorted(ids))))
    only = next(iter(ids)) if len(ids) == 1 else None
    return (only if not errs else None), errs


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--repo', default='.')
    ap.add_argument('--base')
    ap.add_argument('--head', default='HEAD')
    ap.add_argument('--files', nargs='*')
    ap.add_argument('--github-output')
    a = ap.parse_args()
    if a.files is not None:
        entries = [('M', '100644', f) for f in a.files]
    else:
        if not a.base:
            ap.error('cần --base (hoặc --files)')
        entries = changed(a.repo, a.base, a.head)
    gid, errs = check(entries)
    print('Tệp thay đổi trong PR: %d' % len(entries))
    for st, mode, p in entries[:50]:
        print('  %s %s' % (st, p))
    if errs:
        print('\nBỊ CHẶN — Pull Request gửi game chỉ được thêm/sửa tệp trong ĐÚNG MỘT thư mục submissions/<id>/:')
        for e in errs:
            print('  ✗ ' + e)
        print('Cách sửa từng mã: developers/AI-RULES.md mục "Mã lỗi" · developers/GUI-GAME.md mục "Bị từ chối tự động nếu".')
        return 1
    if all(st == 'D' for st, _, _ in entries):
        print('\nPR chỉ XÓA tệp của submissions/%s/ — không có gì để kiểm (người duyệt xem tay).' % gid)
    print('\nĐẠT — PR chỉ đụng submissions/%s/' % gid)
    if a.github_output:
        with open(a.github_output, 'a', encoding='utf-8') as f:
            f.write('id=%s\n' % gid)
            f.write('deleted_only=%s\n' % ('true' if all(st == 'D' for st, _, _ in entries) else 'false'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
