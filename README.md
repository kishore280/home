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
