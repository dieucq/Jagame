#!/usr/bin/env python3
"""Tự kiểm 1 thư mục game TRƯỚC KHI GỬI (cùng bộ kiểm máy của kho chạy trên Pull Request):

    python3 check_submission.py <thư mục game>            # vd: python3 check_submission.py ../submissions/bongbay
    python3 check_submission.py <thư mục game> --json report.json --rounds 200

Cần Python ≥ 3.8 + Node ≥ 22.2. ĐẠT = mã thoát 0. Xem developers/GUI-GAME.md.
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, 'tools', 'check_submission.py')
sys.path.insert(0, os.path.join(HERE, 'tools'))
if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
    print(__doc__)
    sys.exit(0 if len(sys.argv) > 1 else 2)
if sys.argv[1].startswith('-'):
    sys.exit('Dùng: python3 check_submission.py <thư mục game>')
sys.argv[0] = TOOL
runpy.run_path(TOOL, run_name='__main__')
