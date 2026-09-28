# AGENTS.md

Guide for coding agents (Claude Code, Codex, Cursor, Copilot and others) working on this repo. `README.md` is for people; this file is the rules and the workflow.

## What this is

kishore's personal site, live at **https://kichoow.com**. React 19 + TypeScript + Vite, served by a Cloudflare Worker with static assets. Soft lavender, indie-web style, with a mascot, 88×31 buttons, a ⌘K menu and a secret `/offline` page.

| Path | What |
|---|---|
| `src/data.ts` | **All content** (text, links, buttons, offline note, 404 text). Change content here only. |
| `src/` | The React app. Pages: `index.html` → `main.tsx` (home), `offline.html` → `offline.tsx`, `404.html` → `notfound.tsx`, `log.html` → `log.tsx` (private logging page). All start through `mount()` in `src/lib/mount.tsx`. |
| `src/head.html` | Head tags shared by every page (icons, theme script, Umami). |
| `worker/` | The Worker: `/api/counters` (D1), `/api/github`, `/api/now-playing` (D1), `/api/scrobble/` (ListenBrainz-compatible, the phone sends songs), `/api/log` (chai, parotta, beach days from the `/log` page; `/api/log/days?range=84|365` feeds the "my days" card, edge-cached 60 s), `/api/photos` (the newest photos and videos of the shared Google Photos album in `site.photosAlbum`, edge-cached 1 h). Everything else is a static file. |
| `seo.ts` | Vite plugin: title, meta, Open Graph, JSON-LD, robots.txt, sitemap.xml, llms.txt and `/.well-known/button.json` (the 88×31 buttons for button-wall tools), all from `src/data.ts`. |
| `scripts/prerender.mjs` | Pre-renders every page into `dist/`, inlines the CSS (Beasties), preloads the fonts. |
| `scripts/sw.mjs` | Makes the service worker (Workbox) after the pre-render. |
| `migrations/` | D1 tables (0005: `log_hours`, the chai clock; 0006: badminton days). Apply new ones with `npx wrangler d1 migrations apply home --remote`. |
| `tests/ui.spec.ts` | UI tests (Playwright + axe-core). |
| `.claude/skills/` | The skills listed below. |
| `.claude/hooks/` | `session-start.sh`: sets up Claude Code on the web sessions (packages, test browser). |

## Rules

- **Real data only.** A part with no data is hidden, never filled with demo text.
- **Do not hand-roll.** Use an existing library, service or the documented method. Before a fix, search the library's docs or issues for the recommended way, and say which one you used.
- **Keep the code small.** No new dependency for something a few lines do; no copy-pasted code (check with `npx jscpd src worker scripts`).
- **Pre-render safe.** Anything that depends on the visitor's clock or browser renders only after `useIsClient()` is true (`src/lib/client.ts`), or hydration will not match.
- **Code loaded later** uses `lazyPreload()` from `src/lib/lazy.tsx`, not `React.lazy` (React 19 holds a lazy reveal for 300 ms). Preload it on hover, focus or idle.
- **Style:** soft lavender; colours are tokens in `src/index.css` (light and dark). Text needs 4.5:1 contrast.
- **SQL changes get a database review** before they ship: search the SQLite and D1 docs and expert write-ups for the pattern; run `EXPLAIN QUERY PLAN` on each new query (a primary key or covering index, no full scan of a table that grows, no temp B-tree); run the migration twice on a local D1 (`--local --persist-to <dir>`) to prove it is safe to repeat; count the rows a request reads and writes (D1 bills rows); keep remote D1's splitter rules (uppercase `BEGIN`/`END`, no comments or quotes inside trigger bodies).
- **Free tier only** (Cloudflare Workers, D1, Umami Cloud Hobby). Nothing that costs money.
- **Secrets** (API keys, tokens) never go in the code or Git. They are Worker secrets in the Cloudflare dashboard.
- **Analytics:** a click is tracked with `data-umami-event="Name"`; anything else with `track()` / `trackOnce()` / `trackHover()` from `src/lib/track.ts`. Umami sends with `fetch` keepalive, so a same-tab navigation does not wait for its event (see `CommandMenu.tsx`).

## Skills (read the one that fits the task)

| Skill | Use for |
|---|---|
| `.claude/skills/add-log-kind` | A new thing to count (badminton, gym, …): the migration, the code, the tests |
| `.claude/skills/react-best-practices` | React code and performance |
| `.claude/skills/web-design-guidelines` | UI and accessibility review |
| `.claude/skills/seo-mastery` | SEO, meta tags, structured data, crawlers |
| `.claude/skills/workers-best-practices` | The Worker and `wrangler.jsonc` |
| `.claude/skills/owasp-security` | Security review |
| `.claude/skills/webapp-testing` | Browser testing with Playwright |
| `.claude/skills/ui-test` | Adversarial UI testing method (its `browse` CLI does not run in every container; use Playwright then) |

## Commands

```sh
npm install
npm run dev          # Vite dev server (no Worker, no service worker)
npm run build        # type-check, build, pre-render, service worker → dist/
npm run lint         # oxlint
npm run audit        # build, then the UI tests (not `npm audit`, which is npm's dependency check)
npm run preview      # build, then the Worker and the site locally (wrangler dev)
npm run og           # remake the share card, icons and button GIFs after changing the 88×31 buttons
npm run cf-typegen   # regenerate Worker types after changing wrangler.jsonc
```

`npm run audit` and `npm run og` need a Chromium once: `npx playwright install chromium` (or set `CHROMIUM_PATH` to a Chrome/Chromium you already have).

**Claude Code on the web:** `.claude/hooks/session-start.sh` runs `npm install` and sets `CHROMIUM_PATH` to the container's Chromium (`/opt/pw-browsers/chromium-*`); without it, Playwright looks for a browser build that is not there and every UI test fails at launch. Other cloud agents: set `CHROMIUM_PATH` the same way.

**Testing video:** Playwright's Chromium has no H.264, so an MP4 never plays in it. To see a video play, use Chrome for Testing: `npx @puppeteer/browsers install chrome@stable --path <dir>`, then launch it with `executablePath`. A browser behind the container's proxy gets Google's media only with `proxy: { server: process.env.HTTPS_PROXY }` (and the local site in `bypass`).

## Test

Before you push, all of these must pass:

1. `npm run build`
2. `npm run lint`
3. `npm run audit`: Playwright on desktop and mobile. It checks every tap target, the ⌘K menu, `/offline` and the service worker, the 404 page, layout width, keyboard use, axe-core accessibility and the Umami events (captured, never sent).

**Speed (what a performance engineer checks):**
- **No layout shift.** Anything that loads late keeps its exact place while it loads, and never collapses (web.dev "Optimize CLS"). The layout shift test runs with two data shapes (every kind logged, and only chai as live); add a shape when you add a data-driven part. Check a change with Lighthouse on a local `wrangler dev` whose D1 holds live-like data: `CHROME_PATH=/opt/pw-browsers/chromium npx lighthouse@12 http://127.0.0.1:<port>/ --only-categories=performance` (mobile profile by default). Use real-user data where it exists: Cloudflare Web Analytics shows Core Web Vitals from visitors.
- **JavaScript budget.** The home page loads at most 400 KB of JavaScript (before compression); a test enforces it. Raise it only with a reason in the PR.
- **D1 rows.** Say how many rows a new request reads and writes, and cache what many visitors ask for (Workers Cache API).

When you add or change something a visitor can see or tap, **add a test** in `tests/ui.spec.ts`. Use web-first assertions (`toBeVisible`, `toBeFocused`, `toHaveCount`, `expect.poll`), not fixed waits; the only fixed wait is `settle()`, for "nothing happened" checks. A failed test leaves a trace and a report in `.context/` (ignored by Git).

For a wider check, follow `.claude/skills/ui-test` (three planning rounds: functional, adversarial, coverage gaps), and turn every real bug you find into a test.

## Ship

1. Work on a branch, not `main`.
2. Run the three checks above.
3. Open a pull request with what changed and how you checked it; merge it when it passes.
4. Cloudflare builds and deploys `main` by itself (about 1–2 minutes).
5. Check the live site (`curl` the changed page or file on https://kichoow.com) before you say it is done.

Things that are set in the Cloudflare dashboard, not in code: Worker secrets (`SCROBBLE_TOKEN`, the phone's one token for `/api/scrobble` and `/api/log`; `PURGE_TOKEN`, optional, for "refresh photos" everywhere; its `ZONE_ID` is a var in `wrangler.jsonc`), the WAF rate-limiting rule on `/api/counters`, HSTS, the `www` → apex redirect and Web Analytics.
