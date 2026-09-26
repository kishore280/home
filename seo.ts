// Vite plugin: SEO tags in <head>, plus robots.txt, sitemap.xml and llms.txt, all built
// from src/data.ts so they never drift from the page. Follows .claude/skills/seo-mastery.
import type { Plugin } from 'vite'
import { links, notFound, offlineNote, site } from './src/data.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function seo(buildDate: string): Plugin {
  const url = `${site.url}/`
  const image = `${site.url}/og.png`
  const imageAlt = 'kish’s lavender mascot next to a row of 88×31 buttons: beach, running, badminton, parotta, Himalayan, chai and coding'

  // ProfilePage + Person: who the site is about, and where else they are.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    dateModified: buildDate,
    mainEntity: {
      '@type': 'Person',
      name: 'Kishore',
      alternateName: 'kish',
      url,
      sameAs: links.map((l) => l.href),
    },
  }

  // Title, description and share-card tags for one page.
  const meta = (p: { title: string; description: string; url: string; type: string }) => [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:site_name" content="${esc(site.title)}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${p.url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]

  const heads: Record<string, string[]> = {
    'index.html': [
      ...meta({ title: site.title, description: site.description, url, type: 'profile' }),
      `<link rel="canonical" href="${url}" />`,
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    ],
    // A secret page with a short note: shareable, but kept out of search and the sitemap.
    'offline.html': [
      ...meta({ ...offlineNote, url: `${site.url}/offline`, type: 'website' }),
      `<meta name="robots" content="noindex" />`,
    ],
    '404.html': [...meta({ ...notFound, url: `${site.url}/404`, type: 'website' }), `<meta name="robots" content="noindex" />`],
  }

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${buildDate.slice(0, 10)}</lastmod>
  </url>
</urlset>
`

  // Optional and experimental for AI tools: a short, factual summary. No ranking claims.
  const llms = `# ${site.title}

> ${site.description}

A small personal site with a mascot that follows kish's day in India time (IST), a live clock, the latest public GitHub activity, and 88×31 buttons for the things kish likes.

## Links

${[{ label: 'Website', href: url }, ...links].map((l) => `- [${l.label}](${l.href})`).join('\n')}
`

  return {
    name: 'home-seo',
    transformIndexHtml(html, ctx) {
      const page = heads[ctx.filename.split('/').pop() ?? '']
      if (!page) throw new Error(`seo: no head for ${ctx.filename}`)
      return html.replace('<!-- seo -->', page.join('\n    '))
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llms })
    },
  }
}
