# home

Personal site: React 19 + TypeScript + Vite on a Cloudflare Worker with static assets. The Worker in `worker/` answers `/api/*`; the site is built to `dist/`. Optional D1 database (`migrations/`).

- All content is in `src/data.ts`. Show only real data: a part with no data is hidden, never filled with demo text.
- Follow `.claude/skills/react-best-practices` for React code and `.claude/skills/web-design-guidelines` for UI.
- Keep the code small: prefer an existing library or service over hand-written code.
- Style: soft lavender, tokens in `src/index.css` (light and dark).
- Before pushing, run `npm run build` and `npm run lint`.
