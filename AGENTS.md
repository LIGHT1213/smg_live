# Repository Guidelines

A Tampermonkey/Violentmonkey userscript (`smg_fivestar.user.js`) that unlocks SMGTV / 五星体育 live streams on `kankanews.com` by removing the trial countdown, page-switch pauses, and channel shielding.

## Project Structure & Module Organization

The repository is intentionally minimal — a single self-contained userscript plus docs.

- `smg_fivestar.user.js` — the entire userscript (metadata header + IIFE body). All logic lives here.
- `README.md` — installation and compatibility notes (in Chinese).
- `LICENSE` — MIT license, copyright `_xFox`.
- `.git/` — Git history; default branch is `main`.

There are no `src/`, `test/`, or `assets/` directories. The userscript header (`// ==UserScript==` block) declares `@match`, `@updateURL`, `@downloadURL`, `@version`, and `@run-at`.

## Build, Test, and Development Commands

There is **no build step**. The script is plain JavaScript loaded directly by the userscript manager.

- **Install locally:** load `smg_fivestar.user.js` into Tampermonkey/Violentmonkey (Dashboard → Utilities → import, or point the manager at the raw file).
- **Run/iterate:** edit the file, save in the manager's editor, reload `https://live.kankanews.com/huikan?id=10`.
- **Lint (optional):** `npx eslint smg_fivestar.user.js` — no config is committed, so use your own or the manager's built-in checker.

## Coding Style & Naming Conventions

- ES2015+ JavaScript, wrapped in an IIFE with `'use strict'`.
- 4-space indentation; single quotes; semicolons required.
- `camelCase` for functions and variables (`injectStyle`, `findComponentFromElement`); `UPPER_SNAKE_CASE` for constants (`STYLE_ID`, `VIDEO_READY_EVENTS`).
- Use `const`/`let`, never `var`. Prefer optional chaining (`el?.__vue__`) and `WeakSet` for tracking.
- Keep everything in one file; do not split modules unless adding a build pipeline.

## Testing Guidelines

There is **no automated test suite** — the script runs inside a live third-party page. Manual verification is required:

1. Install the edited script and open the channel page listed above.
2. Confirm the trial countdown is removed and video plays past the previous cutoff.
3. Switch channels/pages to verify playback is not paused by shield/`is_shield` flags.
4. Check the browser console (`F12`) for errors from `console.error('解析JSON响应时出错:', …)`.

## Commit & Pull Request Guidelines

History uses short imperative summaries (e.g. `Fix loading mask after video starts`, `Upgrade to version 0.7 with enhanced bypass features`). Follow these conventions:

- Start with a capitalized verb: `Fix`, `Add`, `Upgrade`, `Refactor`.
- Reference the issue or behavior in the body when relevant.
- Bump `@version` in the userscript header for any user-facing change.
- For PRs: describe the problem, the page/behavior tested, and browser/manager versions used. Screenshots or console output of before/after playback are welcome.
