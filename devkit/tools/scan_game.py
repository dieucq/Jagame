#!/usr/bin/env python3
"""Kiểm + đóng gói 1 game cho Gamescan (PHP gọi) — DÙNG LẠI jgame.py của kho (không chép lệch luật).

    python3 tools/scan_game.py <games/<id>> [--out <file.jgame>] [--icon-out <file>] [--json]

Tìm jgame.py theo thứ tự: $JAGAME_TOOLS/jgame.py, tools/jgame.py.
In JSON 1 dòng: {ok, soon, errors[], manifest, files[], source_hash, sha256, size}. Mã thoát 0 kể cả khi game lỗi (ok=false);
2 = không tìm thấy jgame.py / lỗi hệ thống.
"""
import argparse
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# Mục dev trong games/<id>/ theo GAME-PROTOCOL.md §2.1 KHÔNG vào gói: jgame.collect_package_files (luật cũ) chỉ biết bỏ test/,
# nên đóng gói từ bản chép tạm đã bỏ các mục này — byte gói y hệt build.py với game không có các mục đó.
DEV_ONLY = {'store.json', 'CHANGELOG.md', 'LICENSE', 'test'}


def load_jgame():
    cands = []
    if os.environ.get('JAGAME_TOOLS'):
        cands.append(os.environ['JAGAME_TOOLS'])
    cands += [HERE]
    for d in cands:
        if os.path.isfile(os.path.join(d, 'jgame.py')):
            sys.path.insert(0, d)
            import jgame  # noqa: E402
            return jgame
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('game_dir')
    ap.add_argument('--out', help='ghi gói .jgame vào đây (chỉ khi game đạt, không soon)')
    ap.add_argument('--icon-out', help='chép icon vào đây')
    a = ap.parse_args()
    jgame = load_jgame()
    if jgame is None:
        print(json.dumps({'ok': False, 'errors': ['không tìm thấy jgame.py (đặt JAGAME_TOOLS=<thư mục tools>)']}))
        return 2
    gdir = os.path.abspath(a.game_dir)
    gid = os.path.basename(gdir)
    res = {'ok': False, 'soon': False, 'errors': [], 'manifest': None, 'files': [], 'source_hash': None, 'sha256': None, 'size': None}
    try:
        if os.path.islink(gdir) or not os.path.isdir(gdir):
            raise jgame.StoreError('games/%s không phải thư mục thường' % gid)
        mpath = os.path.join(gdir, 'manifest.json')
        if not os.path.isfile(mpath):
            raise jgame.StoreError('thiếu manifest.json')
        try:
            m = jgame.read_json(mpath)
        except ValueError as e:
            raise jgame.StoreError('manifest.json không phải JSON hợp lệ: %s' % e)
        if not isinstance(m, dict):
            raise jgame.StoreError('manifest.json phải là object')
        res['manifest'] = m
        icon_rel = m.get('icon') if isinstance(m.get('icon'), str) else 'icon.svg'
        if m.get('soon'):
            jgame.validate_manifest(m, folder_id=gid, need_package=False)
            icon = os.path.join(gdir, icon_rel)
            if not os.path.isfile(icon) or os.path.islink(icon):
                raise jgame.StoreError('thiếu %s' % icon_rel)
            if os.path.getsize(icon) > jgame.MAX_ICON:
                raise jgame.StoreError('%s > 200 KB' % icon_rel)
            if a.icon_out:
                os.makedirs(os.path.dirname(a.icon_out), exist_ok=True)
                shutil.copyfile(icon, a.icon_out)
            res['soon'] = True
            res['ok'] = True
            print(json.dumps(res, ensure_ascii=False))
            return 0
        jgame.validate_manifest(m, folder_id=gid)
        files, src_dir, tmp = package_source(jgame, gdir, gid, m)
        jgame.check_limits(files)
        jgame.check_server_source(src_dir, m)
        names = {e[0] for e in files}
        need = [m['icon'], m['entry']['client'], m['entry']['server']] + ([m['entry']['style']] if 'style' in m['entry'] else [])
        for n in need:
            if n not in names:
                raise jgame.StoreError('thiếu %s (manifest trỏ tới)' % n)
        if os.path.getsize(os.path.join(src_dir, m['icon'])) > jgame.MAX_ICON:
            raise jgame.StoreError('%s > 200 KB' % m['icon'])
        data = jgame.pack(files)
        mm = jgame.safe_extract(data, expect_id=gid, expect_version=m['version'])   # tự kiểm theo luật của máy hội quán
        if mm != m:
            raise jgame.StoreError('manifest trong gói khác nguồn')
        if jgame.sha256_bytes(jgame.pack(files)) != jgame.sha256_bytes(data):
            raise jgame.StoreError('đóng gói không tất định')
        res.update({'ok': True, 'files': [e[0] for e in files], 'source_hash': jgame.source_hash(files),
                    'sha256': jgame.sha256_bytes(data), 'size': len(data)})
        if a.out:
            jgame.write_bytes(a.out, data)
        if a.icon_out:
            os.makedirs(os.path.dirname(a.icon_out), exist_ok=True)
            shutil.copyfile(os.path.join(gdir, m['icon']), a.icon_out)
    except jgame.StoreError as e:
        res['errors'].append(str(e))
    except Exception as e:  # lỗi bất ngờ vẫn trả JSON để PHP hiện được
        res['errors'].append('lỗi khi kiểm: %s' % e)
    finally:
        tmp = locals().get('tmp')
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps(res, ensure_ascii=False))
    return 0


def package_source(jgame, gdir, gid, m):
    """(files, thư mục nguồn để đóng gói, thư mục tạm cần xóa|None).

    Game không có mục DEV_ONLY (ngoài test/ mà jgame đã bỏ) -> đóng gói thẳng như build.py. Có -> chép tạm (giữ symlink để jgame
    vẫn bắt) rồi bỏ các mục đó; mọi luật khác vẫn do jgame.collect_package_files áp."""
    extra = [n for n in os.listdir(gdir) if n in DEV_ONLY and n != 'test']
    if not extra:
        return jgame.collect_package_files(gdir, m), gdir, None
    import tempfile
    tmp = tempfile.mkdtemp(prefix='jg_scan_')
    dst = os.path.join(tmp, gid)
    shutil.copytree(gdir, dst, symlinks=True, ignore=lambda d, names: [n for n in names if d == gdir and n in DEV_ONLY])
    return jgame.collect_package_files(dst, m), dst, tmp


if __name__ == '__main__':
    sys.exit(main())
