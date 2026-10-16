# Thành phần bên thứ ba — lõi giả lập retro

| Thành phần | Giấy phép | Nguồn | Ghi chú |
|---|---|---|---|
| **LakeSnes** (angelo-wf), commit `9db90b86e46a377609305e298dd92d71cd1d4c8a` (02/12/2023) | MIT — `snes/LICENSE-lakesnes.txt` | https://github.com/angelo-wf/LakeSnes | Biên dịch WebAssembly bằng wasi-sdk 34 (Apache-2.0 with LLVM exceptions; wasi-libc: Apache-2.0/MIT/CC0) → `snes/lakesnes.wasm`. Mã + script dựng: `Tools/retro-src/`. |
| **jsnes** 2.1.0 | Apache-2.0 — `nes/LICENSE-jsnes.txt` | https://github.com/bfirsh/jsnes | Lõi NES thuần JS. `nes/jsnes.min.js` = jsnes dựng bằng esbuild (IIFE, `window.JSNES`) kèm 2 mapper do Jagame viết thêm (BMC 202/227, `nes/mappers-extra.js`, Apache-2.0 như jsnes). Không sửa mã jsnes. |
| **JGUI.pad** (Jagame) | cùng dự án | `PakageServer/shared/sdk/client/jg-ui.js` | `jg-ui.js` là bản chép nguyên văn của SDK (cho tay cầm ảo, bàn phím, gamepad). |

Jagame không kèm ROM nào. Người chơi tự mang ROM của mình hoặc dùng homebrew có giấy phép mở.
