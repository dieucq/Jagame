/* JGSnes: lõi SNES (LakeSnes, MIT) chạy WebAssembly thuần (WASI reactor) — không Emscripten.
 * API giống jsnes để dùng chung ở client:
 *   const snes = await JGSnes.create(urlWasm?);   // mặc định lakesnes.wasm cạnh tệp này
 *   snes.loadRom(Uint8Array) -> bool;  snes.reset(hard?)
 *   snes.setButtons(pad 0|1, bitmask 12 nút);  // JGSnes.BTN.{B,Y,SELECT,START,UP,DOWN,LEFT,RIGHT,A,X,L,R}
 *   snes.frame();                              // chạy đúng 1 khung (tất định theo ROM + input)
 *   snes.getFrameBuffer(hires?) -> Uint8ClampedArray RGBA 256x224 (hires: 512x448) — mảng dùng lại mỗi khung
 *   snes.getAudio(n?) -> Int16Array PCM stereo xen kẽ (n mẫu/kênh, mặc định 800 = 48 kHz / 60,1 fps); getAudioFloat(L, R)
 *   snes.saveState() -> Uint8Array; snes.loadState(Uint8Array) -> bool;  snes.ramChecksum() -> uint32
 * Mã gốc: Tools/retro-src/ (build_snes.sh). Giấy phép: LICENSE-lakesnes.txt. */
(function (root) {
  'use strict';
  var SRC = (document.currentScript && document.currentScript.src) || '';
  var BTN = { B: 1, Y: 2, SELECT: 4, START: 8, UP: 16, DOWN: 32, LEFT: 64, RIGHT: 128, A: 256, X: 512, L: 1024, R: 2048 };

  function JGSnes(instance) {
    this._x = instance.exports;
    this._mem = this._x.memory;
    this.audioSamples = 800;
    this._rgba = new Uint8ClampedArray(256 * 224 * 4);
    this._rgbaHi = null;
    this.width = 256; this.height = 224;
    this._loaded = false;
    if (this._x._initialize) this._x._initialize();
    this._x.jg_init();
  }

  JGSnes.BTN = BTN;

  function imports(getMem) {
    var ok = function () { return 0; };
    return { wasi_snapshot_preview1: {
      // 5 hàm WASI giả: không đĩa, không giờ thật, chỉ nuốt stdout/stderr
      clock_time_get: function (id, prec, out) { new DataView(getMem().buffer).setBigUint64(out, 0n, true); return 0; },
      fd_close: ok,
      fd_fdstat_get: function (fd, out) { new Uint8Array(getMem().buffer, out, 24).fill(0); return 0; },
      fd_seek: function () { return 70; },
      fd_write: function (fd, iov, n, outp) {
        var dv = new DataView(getMem().buffer), t = 0;
        for (var i = 0; i < n; i++) t += dv.getUint32(iov + i * 8 + 4, true);
        dv.setUint32(outp, t, true); return 0;
      }
    } };
  }

  JGSnes.create = function (url) {
    url = url || (SRC ? new URL('lakesnes.wasm', SRC).href : 'lakesnes.wasm');
    var mem = null, imp = imports(function () { return mem; });
    var p;
    if (WebAssembly.instantiateStreaming) {
      p = WebAssembly.instantiateStreaming(fetch(url), imp).catch(function () {
        // máy chủ trả sai MIME (không phải application/wasm) -> nạp bằng ArrayBuffer
        return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.instantiate(b, imp); });
      });
    } else {
      p = fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return WebAssembly.instantiate(b, imp); });
    }
    return p.then(function (r) { mem = r.instance.exports.memory; return new JGSnes(r.instance); });
  };

  var P = JGSnes.prototype;

  P.loadRom = function (rom) {
    var x = this._x, ptr = x.jg_alloc(rom.length);
    new Uint8Array(this._mem.buffer, ptr, rom.length).set(rom);
    var ok = x.jg_load_rom(ptr, rom.length) === 1;
    x.jg_free(ptr);
    this._loaded = ok;
    return ok;
  };
  P.reset = function (hard) { this._x.jg_reset(hard ? 1 : 0); };
  P.setButtons = function (pad, mask) { this._x.jg_set_buttons(pad ? 1 : 0, mask | 0); };
  P.frame = function () { if (this._loaded) this._x.jg_frame(this.audioSamples); };

  // Bộ đệm gốc: 512x480 RGBA, mỗi dòng SNES lặp 2 lần; vùng 224 dòng bắt đầu ở dòng 16.
  P.getFrameBuffer = function (hires) {
    var src = new Uint32Array(this._mem.buffer, this._x.jg_pixels(), 512 * 480), o, x, y, d;
    if (hires) {
      if (!this._rgbaHi) this._rgbaHi = new Uint8ClampedArray(512 * 448 * 4);
      o = new Uint32Array(this._rgbaHi.buffer);
      for (y = 0; y < 448; y++) for (x = 0; x < 512; x++) o[y * 512 + x] = src[(y + 16) * 512 + x] | 0xff000000;
      this.width = 512; this.height = 448;
      return this._rgbaHi;
    }
    o = new Uint32Array(this._rgba.buffer);
    for (y = 0, d = 0; y < 224; y++) {
      var r = (y * 2 + 16) * 512;
      for (x = 0; x < 256; x++) o[d++] = src[r + x * 2] | 0xff000000;
    }
    this.width = 256; this.height = 224;
    return this._rgba;
  };

  P.getAudio = function (samples) {
    var n = Math.min(samples || this.audioSamples, this.audioSamples);
    return new Int16Array(this._mem.buffer, this._x.jg_audio(), n * 2).slice();
  };
  P.getAudioFloat = function (left, right) {
    var n = Math.min(left.length, this.audioSamples),
      a = new Int16Array(this._mem.buffer, this._x.jg_audio(), n * 2);
    for (var i = 0; i < n; i++) { left[i] = a[i * 2] / 32768; right[i] = a[i * 2 + 1] / 32768; }
    return n;
  };

  P.saveState = function () {
    var n = this._x.jg_save_state();
    return new Uint8Array(this._mem.buffer, this._x.jg_state_ptr(), n).slice();
  };
  P.loadState = function (buf) {
    var x = this._x, ptr = x.jg_alloc(buf.length);
    new Uint8Array(this._mem.buffer, ptr, buf.length).set(buf);
    var ok = x.jg_load_state(ptr, buf.length) === 1;
    x.jg_free(ptr);
    return ok;
  };
  P.ramChecksum = function () { return this._x.jg_checksum() >>> 0; };

  root.JGSnes = JGSnes;
})(typeof window !== 'undefined' ? window : globalThis);
