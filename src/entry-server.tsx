// Build-time pre-render: turns each page into static HTML so search engines and AI
// crawlers that do not run JavaScript still see the content (see scripts/prerender.mjs).
import type { MDXContent } from 'mdx/types'
import { StrictMode, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { BlogIndex, PostPage } from './components/Blog'
import { LogPage } from './components/LogPage'
import { NotFoundPage } from './components/NotFoundPage'
import { OfflinePage } from './components/OfflinePage'
import { TextPage } from './components/TextPage'
import { colophonPage, nowPage } from './data'
import { postHead } from './lib/head'
import { posts } from './lib/post-list'

const html = (page: ReactNode) => () => renderToString(<StrictMode>{page}</StrictMode>)

const bodies = import.meta.glob<MDXContent>('/posts/*.md', { import: 'default', eager: true })

// HTML file in dist/ → its pre-rendered #root, the built page it starts from (default: itself) and
// the head tags that go in place of <!-- page-head -->. /offline is built twice: online
// (offline.html) and offline (offline-now.html, which the service worker serves when the real
// request fails). Each blog post is post.html filled in: dist/blog/<slug>.html, served at /blog/<slug>.
export const pages: Record<string, { render: () => string; from?: string; head?: string }> = {
  'index.html': { render: html(<App />) },
  'offline.html': { render: html(<OfflinePage initial="online" />) },
  'offline-now.html': { render: html(<OfflinePage initial="offline" />), from: 'offline.html' },
  '404.html': { render: html(<NotFoundPage />) },
  'log.html': { render: html(<LogPage />) },
  'now.html': { render: html(<TextPage page={nowPage} />) },
  'colophon.html': { render: html(<TextPage page={colophonPage} />) },
  'blog.html': { render: html(<BlogIndex />) },
  ...Object.fromEntries(
    posts.map((p) => [
      `blog/${p.slug}.html`,
      { render: html(<PostPage post={p} Body={bodies[`/posts/${p.slug}.md`]} />), from: 'post.html', head: postHead(p) },
    ]),
  ),
}
