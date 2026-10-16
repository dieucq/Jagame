# Jagame for developers (English summary)

Jagame is a self-hosted web game + chat server for families and friends (phones first, Vietnamese UI). Anyone can write a game (or a
small app that runs inside the game frame) and submit it to the **Game Market**. A maintainer reviews it and signs it as **community**
tier; each clubhouse admin decides whether to install it. The detailed docs are in Vietnamese; this page is a summary.

## Quick start (10 minutes)
Requirements: **Node ≥ 22.2** and **Python ≥ 3.8**. No `npm install`, no Jagame install.
```bash
git clone https://github.com/<you>/JagameServer.git     # your fork
cd JagameServer
node devkit/jagame.js new bongbay --name "Balloons" --author "Your name"   # games/bongbay/ from a template (+ README.md, LICENSE)
node devkit/jagame.js check bongbay      # manifest, icon, rules in a sandbox, test cases, 200 random games, bots, protocol v2
node devkit/jagame.js play bongbay       # http://127.0.0.1:7788/tools/play.html?game=bongbay  (&players=3 &bot=1 &tick=0)
node devkit/jagame.js submit bongbay     # copies to submissions/bongbay/
python3 devkit/check_submission.py submissions/bongbay   # same checks as the PR bot — must print "KẾT QUẢ: ĐẠT" (PASS)
```
Examples: `games/oantuti` (simultaneous + timer), `games/nhatque` (turn-based, bot, hints, custom end reason),
`games/xucxac` (2–6 players, `ctx.rng`, scores).

## A game = one self-contained folder
`manifest.json` (schema: `devkit/shared/sdk/manifest.schema.json`, `"manifest": 2`) · `icon.svg|png` · `server/game.js` (rules) ·
`client/index.js` (+ `style.css`, `client/assets/*`) · `test/cases.json` · `README.md` · `LICENSE`.

**Rules (server)** — pure functions on JSON state, written with the bundled SDK:
`module.exports = JGCore.game({kind, setup, moves:{name:{args, phase, turn, run}}, view, tick, legal, bot, hint, undo})`.
The runtime calls `setup / move / view(state, seat) / result` (+ `tick / bot / hint / undo / join / leave`). Seat `-1` is a spectator.
`view` must hide private information. Results are `{winners, reason, draw?, ranks?}` with `reason` from `devkit/shared/sdk/reasons.json`
or declared in `manifest.reasons`. Modes: `turn`, `simultaneous`, `realtime` (`tick_ms` + `tick()`), `events` (stroke streams).

**Isolation limits (community tier):** no `require`, `import`, `fs`, `process`, `Date` (use `ctx.now`), `Math.random` (use `ctx.rng()`),
`Promise`, timers, `eval`/`Function`, `Proxy`, `Reflect`, TypedArrays, `BigInt`, `WebAssembly`; the words `async`/`await` anywhere reject the
file. 150 ms per call (bot/hint 250 ms), bundled `server/game.js` ≤ 256 KB, state/view ≤ 256 KB, 64 MB memory, `tick_ms` ≥ 250, per-room CPU
1 000 ms / 10 s, no `action` mode.

**Client:** `JG.defineGame(function (game) { … return {destroy}; })` with `game.root, me, seat, players, options, view, send(move),
on('view'|'result'|'error'|'event'|'hint'|'chat'), toast, sound, highlight, openChat, menu` and helpers `JGUI.esc / chips / timer / bar /
banner / pad`. Runs in a sandboxed iframe: no network, no `parent`/`top`/`postMessage`, no cookies/IndexedDB, `localStorage` is a 64 KB
per-game shim (prefer `JG.storage`). Fullscreen: `ui.fullscreen` + `data-jg-menu` / `game.menu()`. Sounds: `move move-other turn win lose
draw error tick join leave chat send start capture check dice deal chip`.

**UI:** only the frame's CSS variables (`--bg --paper --ink --accent --line --soft --muted --radius --f-head …`; real-world objects use
`--jg-obj-ink/paper/line`), phone 360 px first, touch targets ≥ 44 px, respect `prefers-reduced-motion`, self-drawn SVG/CSS art.

**Content:** family-friendly; no real-money gambling (virtual "beans" only), no ads, links, data collection; no copyrighted characters,
art, music, fonts or brands; no ROMs/BIOS; third-party assets only with redistributable licenses, credited in `README.md`.

## Submitting
Open a **Pull Request that only touches `submissions/<game-id>/`** — one game per PR (`<game-id>` matches `^[a-z][a-z0-9-]{1,31}$`, equals
`manifest.id`, not an official game id). The PR check (`.github/workflows/check-submission.yml`, read-only, no secrets) rejects automatically:
files outside that folder, two games, invalid/duplicate id, schema errors, forbidden APIs, oversize, missing README/LICENSE, unknown binaries
or ROMs, dotfiles, symlinks. Then a maintainer reviews, plays, signs it **community** and publishes it. Updates: new PR, higher `version`.
Use the "Gửi game" issue template only for questions or if you cannot use pull requests.
