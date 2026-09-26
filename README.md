# home

kishore's little corner of the internet. A soft lavender personal site: React + TypeScript + Vite, on Cloudflare Pages.

## What is on the page

| Part | Data | Needs |
|---|---|---|
| Intro, about, links, email | `src/data.ts` | Nothing |
| Mascot (click to pat) and pat count | Cloudflare D1 | D1 binding (below) |
| Status | [status.cafe](https://status.cafe) | `statusCafe` in `src/data.ts` |
| Stats: updated, views, notes | Build date + D1 | D1 binding |
| Right now: music | Last.fm | `LASTFM_API_KEY`, `LASTFM_USER` |
| Right now: building | Latest public GitHub push | `github` in `src/data.ts` |
| Right now: local time | Browser | `timeZone` in `src/data.ts` |
| Guestbook | Cloudflare D1 | D1 binding |
| Site updates, 88×31 buttons | `src/data.ts`, `public/button.svg` | Nothing |
| ⌘K menu | cmdk | Nothing |

Only real data is shown. A part with no data is hidden.

## Local development

```sh
npm install
npm run dev         # Vite dev server (no API functions)
npm run build       # type-check and build to dist/
npm run preview     # build, then run with the functions (wrangler pages dev)
npm run lint        # oxlint
npm run cf-typegen  # regenerate worker-configuration.d.ts
```

## Set up the guestbook, views and pats (Cloudflare D1)

1. Create the database: `npx wrangler d1 create home`
2. Create the tables: `npx wrangler d1 execute home --remote --file migrations/0001_init.sql`
3. In the Cloudflare dashboard, open the Pages project → **Settings → Bindings → Add → D1 database**. Variable name: `DB`. Database: `home`.
4. Deploy again.

Without the binding, the guestbook and the counters are hidden. The rest of the site still works.

## Live music (Last.fm)

In the Pages project settings, add these variables:

- `LASTFM_API_KEY`: get one at https://www.last.fm/api/account/create
- `LASTFM_USER`: your Last.fm user name

## Deploy

From Git: in the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**, select this repository, production branch `main`, build command `npm run build`, output directory `dist`.

From the command line: `npx wrangler login`, then `npm run deploy`.

## Libraries

- [cmdk](https://github.com/pacocoursey/cmdk): the ⌘K menu, loaded only when it opens
- [sonner](https://github.com/emilkowalski/sonner): toasts
- [SWR](https://swr.vercel.app): data fetching and caching
- [Nunito](https://fonts.google.com/specimen/Nunito) and [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), through Fontsource

## Agent skills

`.claude/skills/` has two MIT-licensed skills from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills): `react-best-practices` and `web-design-guidelines`.
