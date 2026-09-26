# home

Personal site. React + TypeScript + Vite. Hosted on Cloudflare Pages.

## Local development

```sh
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/
npm run preview  # serve the built site
npm run lint     # run oxlint
```

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository.
3. Use these build settings:
   - Framework preset: **React (Vite)**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Save and deploy. Each push to the production branch deploys the site. Other branches get preview URLs.

The Node version for the build is in `.nvmrc`.
