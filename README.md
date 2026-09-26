# home

kishore's little corner of the internet. A soft lavender personal site: React + TypeScript + Vite, on a Cloudflare Worker with static assets.

## What is on the page

| Part | Data | Needs |
|---|---|---|
| Intro, about, links, email | `src/data.ts` | Nothing |
| Mascot (click to pat) and pat count | Cloudflare D1 | D1 binding (below) |
| Status | [status.cafe](https://status.cafe) | `statusCafe` in `src/data.ts` |
| Stats: updated, views | Build date + D1 | D1 binding |
| Right now: music | Last.fm | `LASTFM_API_KEY`, `LASTFM_USER` |
| Right now: building | Latest public GitHub push | `github` in `src/data.ts` |
| Right now: local time | Browser | `timeZone` in `src/data.ts` |
| Counts: parotta, chai, beach days | `src/log.json` | Nothing |
| Updates, 88×31 buttons | `src/data.ts`, `public/*.svg` | Nothing |
| ⌘K menu | cmdk | Nothing |

Only real data is shown. A part with no data is hidden.

## Local development

```sh
npm install
npm run dev         # Vite dev server (no API functions)
npm run build       # type-check and build to dist/
npm run preview     # build, then run the Worker and the site locally (wrangler dev)
npm run lint        # oxlint
npm run cf-typegen  # regenerate worker-configuration.d.ts
```

## Log parotta, chai and beach days

Each command adds an entry to `src/log.json` with the current time in IST. Commit and push to update the site.

```sh
npm run log parotta 2        # 2 parottas now
npm run log chai             # 1 chai now
npm run log beach "Marina"   # a beach day today, with an optional place
```

You can also edit `src/log.json` by hand. Times use ISO format with the IST offset, e.g. `2026-09-26T20:15:00+05:30`.

## Set up views and pats (Cloudflare D1)

1. Create the database: `npx wrangler d1 create home`. It prints a `database_id`.
2. In `wrangler.jsonc`, add the binding with that ID (the comment at the end of the file shows the line to add):
   `"d1_databases": [{ "binding": "DB", "database_name": "home", "database_id": "<id>" }]`
3. Create the table: `npx wrangler d1 execute home --remote --file migrations/0001_init.sql`
4. Commit and push. The next deploy turns the counters on.

Without the binding, the counters are hidden. The rest of the site still works.

## Live music (Last.fm)

In the Worker's settings (**Settings → Variables and Secrets**), add these. Make the API key a **secret**:

- `LASTFM_API_KEY`: get one at https://www.last.fm/api/account/create
- `LASTFM_USER`: your Last.fm user name

## Deploy (Cloudflare Workers)

The Worker in `worker/` answers `/api/*` and serves the built site from `dist/`.

In the Cloudflare dashboard (**Workers & Pages → the `home` Worker → Settings → Build**):

- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Each push to `main` then builds and deploys. From the command line: `npx wrangler login`, then `npm run deploy`.

## SEO and share cards

- `npm run build` pre-renders the page into `dist/index.html` (`src/entry-server.tsx`, `scripts/prerender.mjs`), so search engines and AI crawlers see the content without running JavaScript. Parts that depend on the visitor's clock (mascot mode, local time, counts) render in the browser only (`src/lib/client.ts`).
- `seo.ts` (a Vite plugin) builds the title, description, canonical, Open Graph / Twitter tags, JSON-LD (`ProfilePage` + `Person`), `robots.txt`, `sitemap.xml` and `llms.txt` from `src/data.ts`. Set `site.url` there to the public address.
- `public/og.png` (1200×630) is the share card; `public/apple-touch-icon.png`, `public/icon-512.png` and `public/manifest.webmanifest` are the app icons.

## Libraries

- [cmdk](https://github.com/pacocoursey/cmdk): the ⌘K menu, loaded only when it opens
- [sonner](https://github.com/emilkowalski/sonner): toasts
- [SWR](https://swr.vercel.app): data fetching and caching
- [Nunito](https://fonts.google.com/specimen/Nunito) and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), through Fontsource

## Agent skills

`.claude/skills/` has MIT-licensed skills: `react-best-practices` and `web-design-guidelines` from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), and `seo-mastery` from [kpab/seo-mastery-agent-skills](https://github.com/kpab/seo-mastery-agent-skills).
