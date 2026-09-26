// Vite plugin: SEO tags in <head>, plus robots.txt, sitemap.xml and llms.txt, all built
// from src/data.ts so they never drift from the page. Follows .claude/skills/seo-mastery.
import type { Plugin } from 'vite'
import { links, site } from './src/data.ts'

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

  const head = [
    `<title>${esc(site.title)}</title>`,
    `<meta name="description" content="${esc(site.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="${esc(site.title)}" />`,
    `<meta property="og:title" content="${esc(site.title)}" />`,
    `<meta property="og:description" content="${esc(site.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(site.title)}" />`,
    `<meta name="twitter:description" content="${esc(site.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')

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
    transformIndexHtml(html) {
      return html.replace('<!-- seo -->', head)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llms })
    },
  }
}
