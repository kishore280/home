# home

Personal site. React + TypeScript + Vite. Hosted on Cloudflare Pages.
Made with the Cloudflare CLI (`npm create cloudflare@latest -- --framework=react --platform=pages`).

## Local development

```sh
npm install
npm run dev         # start the Vite dev server
npm run build       # type-check and build to dist/
npm run preview     # build, then serve with wrangler pages dev
npm run lint        # run oxlint
npm run cf-typegen  # regenerate worker-configuration.d.ts
```

Cloudflare settings are in `wrangler.jsonc`.

## Edit the content

All text, links, songs, photos, and guestbook examples are in `src/data.ts`. The values there now are example data.

## Libraries

- [cmdk](https://github.com/pacocoursey/cmdk) (Paco Coursey): the ⌘K menu
- [sonner](https://github.com/emilkowalski/sonner) (Emil Kowalski): toasts
- [motion](https://motion.dev): animations and the photo viewer
- [Geist](https://vercel.com/font) (Vercel): fonts, through Fontsource

## Now playing (Last.fm)

`functions/api/now-playing.ts` is a Pages Function. To show live music, add these variables in the Pages project settings:

- `LASTFM_API_KEY`: get one at https://www.last.fm/api/account/create
- `LASTFM_USER`: your Last.fm user name

Without them, the site shows the example tracks from `src/data.ts`.

## Deploy from the command line

```sh
npx wrangler login
npm run deploy      # build, then wrangler pages deploy
```

## Deploy from Git (Cloudflare Pages)

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository.
3. Use these build settings:
   - Framework preset: **React (Vite)**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Save and deploy. Each push to the production branch deploys the site. Other branches get preview URLs.

The Node version for the build is in `.nvmrc`.
