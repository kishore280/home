# AGENTS.md

Guide for coding agents (Claude Code, Codex, Cursor, Copilot and others) working on this repo. `README.md` is for people; this file is the rules and the workflow.

## What this is

kishore's personal site, live at **https://kichoow.com**. React 19 + TypeScript + Vite, served by a Cloudflare Worker with static assets. Soft lavender, indie-web style, with a mascot, 88×31 buttons, a ⌘K menu and a secret `/offline` page.

| Path | What |
|---|---|
| `src/data.ts` | **All content** (text, links, buttons, offline note, 404 text). Change content here only. |
| `src/` | The React app. Pages: `index.html` → `main.tsx` (home), `offline.html` → `offline.tsx`, `404.html` → `notfound.tsx`, `log.html` → `log.tsx` (private logging page), `now.html` → `now.tsx` and `colophon.html` → `colophon.tsx` (slash pages: short lists from `src/data.ts`, drawn by `TextPage.tsx`), `blog.html` → `blog.tsx` (/blog) and `post.html` → `post.tsx` (the template for each post, `components/Blog.tsx`). All start through `mount()` in `src/lib/mount.tsx`. |
| `src/head.html` | Head tags shared by every page (icons, theme script, Umami). |
| `worker/` | The Worker: `/api/counters` (D1), `/api/github`, `/api/now-playing` (D1), `/api/scrobble/` (ListenBrainz-compatible, the phone sends songs), `/api/log` (chai, parotta, beach days from the `/log` page; `/api/log/days?range=84|365` feeds the "my days" card, edge-cached 60 s), `/api/photos` (the newest photos and videos of the shared Google Photos album in `site.photosAlbum`, edge-cached 1 h), `/api/scroll` ("now scrolling" from the phone's Brainrot app, github.com/kishore280/brainRot: a heartbeat every 30 s with today's total, time in Reels and per reel; D1 `scroll_now` for the live beat, `scroll_binges` for 30 days of finished binges; edge-cached 30 s). Everything else is a static file. |
| `posts/` | **The blog**: one Markdown file per post (see "Write a blog post" below). `blog.ts` reads their front matter at build time. |
| `seo.ts` | Vite plugin: title, meta, Open Graph, JSON-LD, robots.txt, sitemap.xml, llms.txt and `/.well-known/button.json` (the 88×31 buttons for button-wall tools), all from `src/data.ts`. |
| `scripts/prerender.mjs` | Pre-renders every page into `dist/`, inlines the CSS (Beasties), preloads the fonts. |
| `scripts/sw.mjs` | Makes the service worker (Workbox) after the pre-render. |
| `migrations/` | D1 tables (0005: `log_hours`, the chai clock; 0006: badminton days; 0007–0009: `scroll_now` and `scroll_binges`). Apply new ones with `npx wrangler d1 migrations apply home --remote`. |
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
- **Credit others.** Anything forked or taken from another person's work (code, art, an app) gets a short credit with a link in the colophon (`colophonPage` in `src/data.ts`), in the same pull request. Check its license first.
- **Secrets** (API keys, tokens) never go in the code or Git. They are Worker secrets in the Cloudflare dashboard.
- **Analytics:** a click is tracked with `data-umami-event="Name"`; anything else with `track()` / `trackOnce()` / `trackHover()` from `src/lib/track.ts`. Umami sends with `fetch` keepalive, so a same-tab navigation does not wait for its event (see `CommandMenu.tsx`).

## Working with kish

- **Reply in simple English** (ASD-STE100 Simplified Technical English): short sentences, common words.
- **Show before you build** anything a visitor sees: make a few options first (a mockup page or screenshots), let kish pick, then build only the pick. Send screenshots (web and mobile) of the result.
- **Taste:** cute, calm and personal, never "cringe". Jokes are short and dry, like blinkies.cafe and petrapixel ("ow my knees", "Bite me. :)"), not self-praise. No filler text.
- **Decided, do not redo:** the mascot stays the cat (a dog was tried and dropped). The polaroids have no date (the album only knows the day a photo was added). The runner button's two legs are one colour. The photos card shows at most 6 tiles; the viewer swipes the whole album.
- **Look things up first:** search the web for how experts or the library do it before a fix.

### Add a blinkie (150×20) or stamp (99×56)

1. Copy an existing one in `scripts/og/stamps/` (for example `blinkie-bite-me.svg`) to `<name>.svg`, with its `<style>` block (the `.px`, `.bl`, `.bob`, `.beat`, `.fl` classes and the `prefers-reduced-motion` rule). Keep the style: a dashed border inside the edge, pixel icons (`<rect class="px">`), plain `<text>` with `x`, `y`, `font-size` and `fill`, and one moving part. To centre the words, add `text-anchor="middle"` and set `x` to the centre (75 for a blinkie). Set `data-loop` on the `<svg>` to the time after which every animation repeats.
2. Add it to `myStamps` in `src/data.ts` (blinkies first, then stamps).
3. Run `npm run og`: it turns the `<text>` into Pixelify Sans paths and writes `public/<name>.svg` and `.gif`. It also remakes the share card, the icons and every button GIF; commit only those that look different (a re-encode can change the bytes and not the pixels).
4. Update the item count and the stamp's index in the "blinkies and stamps" test in `tests/ui.spec.ts`.
5. Screenshot the card for kish: `npm run build`, `npx vite preview`, then a Playwright screenshot of the `.card` that has the heading "blinkies & stamps", at 1280 px and 390 px wide.

### Write a blog post

1. Add `posts/<name>.md` (a-z, 0-9 and `-`; the name is the address `/blog/<name>`), with front matter: `title`, `description` (one or two sentences, for search and RSS), `date: 'YYYY-MM-DD'` in quotes, and `tags`. The README has an example.
2. The post is kish's words: draft it only when asked, and let kish read it before it ships. Code in ``` fences gets colours (Shiki, Rosé Pine) and a copy button; name the language (```ts, ```sh).
3. `npm run build` checks the fields and makes the page, the list, the home card, its share card (`og/blog/<name>.png`), its Markdown copy (`/blog/<name>.md`), RSS, sitemap, llms.txt and llms-full.txt. Screenshot the post at 1280 px and 390 px wide.

### Other tips

- A new git worktree has no `node_modules`: run `npm ci` in it first (the session hook installs only the main checkout).
- Fonts do not move when they load: fontaine (`vite.config.ts`) makes local fallback fonts sized like Nunito and Pixelify Sans; their names are in `--body` and `--display`. A Linux test machine needs Noto Sans (`fonts-noto-core`; the session hook installs it), or the layout shift test can fail now and then.
- The tests reuse a server already on port 8787 (`reuseExistingServer`). Stop any other `wrangler dev` first, or the tests check that one.
- Only the 88×31 buttons go in `/.well-known/button.json`: the draft is for 88×31 buttons, not blinkies or stamps.

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
- **JavaScript budget.** The home page loads at most 410 KB of JavaScript (before compression); a test enforces it. Raise it only with a reason in the PR.
- **D1 rows.** Say how many rows a new request reads and writes, and cache what many visitors ask for (Workers Cache API).

**Dead links:** `.github/workflows/links.yml` runs lychee every day, and on a pull request that changes `posts/`, `src/data.ts` or the README. Fix a dead link; add a site that blocks bots to `exclude` in `lychee.toml`, with the reason.

When you add or change something a visitor can see or tap, **add a test** in `tests/ui.spec.ts`. Use web-first assertions (`toBeVisible`, `toBeFocused`, `toHaveCount`, `expect.poll`), not fixed waits; the only fixed wait is `settle()`, for "nothing happened" checks. A failed test leaves a trace and a report in `.context/` (ignored by Git).

For a wider check, follow `.claude/skills/ui-test` (three planning rounds: functional, adversarial, coverage gaps), and turn every real bug you find into a test.

## Ship

1. Work on a branch, not `main`.
2. Run the three checks above.
3. Open a pull request with what changed and how you checked it; merge it when it passes.
4. Cloudflare builds and deploys `main` by itself (about 1–2 minutes).
5. Check the live site (`curl` the changed page or file on https://kichoow.com) before you say it is done.

Things that are set in the Cloudflare dashboard, not in code: Worker secrets (`SCROBBLE_TOKEN`, the phone's one token for `/api/scrobble` and `/api/log`; `PURGE_TOKEN`, optional, for "refresh photos" everywhere; its `ZONE_ID` is a var in `wrangler.jsonc`), the WAF rate-limiting rule on `/api/counters`, HSTS, the `www` → apex redirect and Web Analytics.
