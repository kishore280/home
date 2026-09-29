import { readFileSync } from 'node:fs'
import mdx from '@mdx-js/rollup'
import react from '@vitejs/plugin-react'
import rehypeShiki from '@shikijs/rehype'
import remarkFrontmatter from 'remark-frontmatter'
import { FontaineTransform } from 'fontaine'
import { defineConfig, type Plugin } from 'vite'
import csp from 'vite-plugin-csp-guard'
import { readPosts } from './blog.ts'
import { seo } from './seo.ts'

const buildDate = new Date().toISOString()
const posts = readPosts()

// Every page gets the same icons, theme script and analytics from src/head.html.
const sharedHead = (): Plugin => ({
  name: 'shared-head',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('<!-- head -->', readFileSync('src/head.html', 'utf8')),
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    sharedHead(),
    // A local fallback font sized like each web font (metrics read from the Fontsource files), so
    // nothing moves when the web font arrives (web.dev "Optimize CLS": font-display and size-adjust).
    // The names go in --body and --display in src/index.css. The list covers macOS, Windows,
    // Android and Linux.
    FontaineTransform.vite({ fallbacks: ['Helvetica Neue', 'Arial', 'Segoe UI', 'Roboto', 'Noto Sans', 'DejaVu Sans'] }),
    // Blog posts (posts/*.md) become React components; the front matter is only read, not shown
    // (MDX docs: "Vite" and "Frontmatter"). MDX runs before the React plugin. Code is coloured at
    // build time by Shiki (Rosé Pine Dawn / Moon); light-dark() follows the page's color-scheme,
    // so the site's theme switch works with no extra CSS (Shiki docs: "Dual themes").
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter],
        rehypePlugins: [
          [
            rehypeShiki,
            {
              themes: { light: 'rose-pine-dawn', dark: 'rose-pine-moon' },
              defaultColor: 'light-dark()',
              // Rosé Pine's softer colours are under 4.5:1 on its own background (AGENTS.md: text needs
              // 4.5:1). Each is the same colour, darker (Dawn) or lighter (Moon) in OKLCH until 4.6:1,
              // found with culori's wcagContrast (Shiki docs: "colorReplacements").
              colorReplacements: {
                'rose-pine-dawn': {
                  '#9893a5': '#706b7c',
                  '#d7827e': '#a75754',
                  '#56949f': '#397782',
                  '#907aa9': '#7b6693',
                  '#b4637a': '#a5566d',
                  '#797593': '#6f6b88',
                  '#ea9d34': '#9b6200',
                },
                'rose-pine-moon': { '#6e6a86': '#8d89a6', '#3e8fb0': '#4595b6' },
              },
            },
          ],
        ],
      }),
    },
    react({ include: /\.(md|tsx?)$/ }),
    seo(posts),
    // Content-Security-Policy as a <meta> tag; the plugin adds the hash of the inline theme script.
    csp({
      override: true,
      policy: {
        'default-src': ["'self'"],
        // Cloudflare Web Analytics (Cloudflare adds its beacon) and Umami Cloud.
        'script-src': ["'self'", 'https://static.cloudflareinsights.com', 'https://cloud.umami.is'],
        // React style props and sonner's injected styles.
        'style-src': ["'self'", "'unsafe-inline'"],
        // Photos from the shared Google Photos album (worker/photos.ts).
        'img-src': ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
        // Album videos: lh3 sends the stream on to Google's video servers (worker/photos.ts).
        'media-src': ['https://lh3.googleusercontent.com', 'https://*.googlevideo.com'],
        'font-src': ["'self'", 'data:'],
        // status.cafe is read directly by the browser; the analytics scripts report to their own hosts.
        'connect-src': ["'self'", 'https://status.cafe', 'https://cloudflareinsights.com', 'https://gateway.umami.is'],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    }),
  ],
  build: {
    // The home page, /offline, the 404 page, the private /log page, the slash pages and the blog
    // (post.html is the template the pre-render copies for each post).
    rollupOptions: { input: ['index.html', 'offline.html', '404.html', 'log.html', 'now.html', 'colophon.html', 'blog.html', 'post.html'] },
  },
  define: {
    // Shown as "updated" in the stats card.
    __BUILD_DATE__: JSON.stringify(buildDate),
    // The blog's list (blog.ts), for the home card, /blog and each post page.
    __POSTS__: JSON.stringify(posts),
  },
})
