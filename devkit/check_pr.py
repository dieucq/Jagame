#!/usr/bin/env python3
"""Chạy CỤC BỘ đúng 2 bước của workflow GitHub "Kiểm bài gửi game" trên nhánh hiện tại (đã commit), trước khi mở Pull Request.

    python3 devkit/check_pr.py                     # so với upstream/main, origin/main hoặc main của repo gốc (tự tìm)
    python3 devkit/check_pr.py --base upstream/main

  Bước 1: pr_paths.py — mọi tệp đổi (so với nhánh gốc) phải nằm trong ĐÚNG MỘT submissions/<id>/.
  Bước 2: check_submission.py submissions/<id> --rounds 120.
ĐẠT khi in dòng cuối "PR ĐẠT — giống workflow GitHub" (mã thoát 0). Chỉ tính thay đổi ĐÃ COMMIT — giống GitHub.
"""
import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
UPSTREAM = 'https://github.com/phamduybk/JagameServer.git'


def git(*args, check=True):
    r = subprocess.run(['git', '-C', REPO] + list(args), capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit('LỖI git %s: %s' % (' '.join(args), r.stderr.strip()))
    return r


def find_base(want):
    if want:
        return want
    br = git('rev-parse', '--abbrev-ref', 'HEAD').stdout.strip()
    if br in ('main', 'master'):
        sys.exit('Đang ở nhánh %s. Bài gửi MUST nằm trên nhánh riêng: git checkout -b gui-<id>  (đã lỡ commit trên %s thì: '
                 'git branch gui-<id> && git reset --hard HEAD~<số commit của bạn> && git checkout gui-<id>), rồi chạy lại.' % (br, br))
    for ref in ('upstream/main', 'origin/main', 'main'):
        if git('rev-parse', '--verify', '-q', ref, check=False).returncode == 0:
            cur = git('rev-parse', 'HEAD').stdout.strip()
            if git('rev-parse', ref).stdout.strip() != cur:     # nhánh gốc phải khác HEAD (đang ở nhánh gửi game)
                return ref
    if git('fetch', '-q', UPSTREAM, 'main', check=False).returncode == 0:
        return 'FETCH_HEAD'
    sys.exit('Không tìm được nhánh gốc — chạy: git remote add upstream %s && git fetch upstream, rồi --base upstream/main' % UPSTREAM)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base')
    ap.add_argument('--rounds', default='120')
    a = ap.parse_args()
    if git('rev-parse', '--is-inside-work-tree', check=False).returncode != 0:
        sys.exit('Không phải repo git — clone bản fork của JagameServer rồi chạy trong đó')
    base = find_base(a.base)
    dirty = [l for l in git('status', '--porcelain').stdout.splitlines() if l.strip() and '/devkit/games/' not in '/' + l[3:]]
    if dirty:
        print('LƯU Ý: còn thay đổi CHƯA commit (GitHub không thấy):')
        for l in dirty[:10]:
            print('   ' + l)
    print('== Bước 1: luật đường dẫn (so với %s)' % base)
    out = os.path.join(REPO, '.jg_check_pr_out')
    try:
        r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'tools', 'pr_paths.py'), '--repo', REPO, '--base', base, '--head', 'HEAD',
                            '--github-output', out])
        if r.returncode != 0:
            print('\nPR TRƯỢT ở bước 1 (xem mã [E_…] ở trên).')
            return 1
        kv = dict(l.split('=', 1) for l in open(out, encoding='utf-8').read().split() if '=' in l)
    finally:
        if os.path.exists(out):
            os.remove(out)
    if kv.get('deleted_only') == 'true':
        print('\nPR chỉ xóa tệp — workflow bỏ qua bước 2. PR ĐẠT — giống workflow GitHub')
        return 0
    gid = kv.get('id', '')
    print('\n== Bước 2: check_submission.py submissions/%s' % gid)
    r = subprocess.run([sys.executable, '-I', os.path.join(HERE, 'check_submission.py'), os.path.join(REPO, 'submissions', gid),
                        '--rounds', a.rounds])
    if r.returncode != 0:
        print('\nPR TRƯỢT ở bước 2 (xem mã [E_…] ở trên).')
        return 1
    print('\nPR ĐẠT — giống workflow GitHub')
    return 0


if __name__ == '__main__':
    sys.exit(main())
