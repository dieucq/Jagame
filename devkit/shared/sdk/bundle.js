'use strict';
/*
 * Gộp SDK v2 vào mã game — bản Node của jgame.py sdk_bundle() (PHẢI ra ĐÚNG từng byte như bản Python).
 * Dùng bởi: tools/runner.js (test_game), devkit jagame.js. play.html (trình duyệt) ghép y hệt trong tools/play.js.
 *
 *   server = "'use strict';\n" + shared/sdk/server/jg-core.js + "\n/* ===== <entry.server> (mã game) ===== *\/\n" + server/game.js
 *   client = shared/sdk/client/jg-ui.js + "\n/* ===== <entry.client> (mã game) ===== *\/\n" + client/index.js
 * Chỉ khi manifest "sdk": "2". Không khai "sdk" -> trả nguyên mã game (gói v1 không đổi byte nào).
 * Không phụ thuộc đường dẫn cứng: thư mục SDK = thư mục chứa file này.
 */
const fs = require('node:fs');
const path = require('node:path');

const SDK_VERSIONS = ['2'];
const SDK_DIR = __dirname;
const sep = (rel) => '\n/* ===== ' + rel + ' (mã game) ===== */\n';

function libPath(kind, sdkDir) {
  return path.join(sdkDir || SDK_DIR, kind === 'server' ? 'server/jg-core.js' : 'client/jg-ui.js');
}

/** Nội dung (Buffer) của entry.server hoặc entry.client trong gói. kind = 'server' | 'client'. */
function bundled(gameDir, manifest, kind, sdkDir) {
  const rel = manifest.entry[kind];
  const src = fs.readFileSync(path.join(gameDir, ...rel.split('/')));
  if (manifest.sdk === undefined || manifest.sdk === null) return src;
  if (SDK_VERSIONS.indexOf(manifest.sdk) < 0) throw new Error('manifest "sdk" phải là một trong ' + SDK_VERSIONS.join(', '));
  const head = kind === 'server' ? Buffer.from("'use strict';\n") : Buffer.alloc(0);
  return Buffer.concat([head, fs.readFileSync(libPath(kind, sdkDir)), Buffer.from(sep(rel)), src]);
}

/** Số dòng SDK chèn trước mã game (để đổi số dòng trong thông báo lỗi về đúng dòng của game.js). */
function prefixLines(manifest, kind, sdkDir) {
  if (manifest.sdk === undefined || manifest.sdk === null) return 0;
  const lib = fs.readFileSync(libPath(kind, sdkDir), 'utf8');
  return (kind === 'server' ? 1 : 0) + lib.split('\n').length - 1 + 2;
}

module.exports = { bundled, prefixLines, SDK_VERSIONS, SDK_DIR };
