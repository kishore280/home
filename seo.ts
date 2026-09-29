// Vite plugin: SEO tags in <head>, plus robots.txt, sitemap.xml, llms.txt and
// .well-known/button.json, all built
// from src/data.ts so they never drift from the page. Follows .claude/skills/seo-mastery.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { colophonPage, links, logPage, myButtons, notFound, nowPage, offlineNote, site } from './src/data.ts'

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
      name: site.fullName,
      alternateName: [site.name, site.nickname],
      description: site.description,
      jobTitle: site.jobTitle,
      knowsAbout: site.knowsAbout,
      homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: site.city, addressCountry: site.country } },
      image: `${site.url}/icon-512.png`,
      url,
      sameAs: links.map((l) => l.href),
    },
  }

  // Title, description and share-card tags for one page.
  const meta = (p: { title: string; description: string; url: string; type: string }) => [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:site_name" content="${esc(site.nickname)}" />`,
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

  // The site's app manifest; /log has its own (an installable "kish log" app with shortcuts).
  const manifest = `<link rel="manifest" href="/manifest.webmanifest" />`
  const heads: Record<string, string[]> = {
    'index.html': [
      manifest,
      ...meta({ title: site.title, description: site.description, url, type: 'profile' }),
      `<link rel="canonical" href="${url}" />`,
      `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    ],
    // A secret page with a short note: shareable, but kept out of search and the sitemap.
    'offline.html': [
      manifest,
      ...meta({ ...offlineNote, url: `${site.url}/offline`, type: 'website' }),
      `<meta name="robots" content="noindex" />`,
    ],
    '404.html': [manifest, ...meta({ ...notFound, url: `${site.url}/404`, type: 'website' }), `<meta name="robots" content="noindex" />`],
    // Slash pages, in search and the sitemap.
    'now.html': [manifest, ...meta({ ...nowPage, url: `${site.url}/now`, type: 'website' }), `<link rel="canonical" href="${site.url}/now" />`],
    'colophon.html': [
      manifest,
      ...meta({ ...colophonPage, url: `${site.url}/colophon`, type: 'website' }),
      `<link rel="canonical" href="${site.url}/colophon" />`,
    ],
    // Private: not in search or the sitemap.
    'log.html': [
      `<link rel="manifest" href="/log.webmanifest" />`,
      ...meta({ title: logPage.title, description: logPage.description, url: `${site.url}/log`, type: 'website' }),
      `<meta name="robots" content="noindex, nofollow" />`,
    ],
  }

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}</loc>
    <lastmod>${buildDate.slice(0, 10)}</lastmod>
  </url>
  <url>
    <loc>${site.url}/now</loc>
    <lastmod>${nowPage.updated ?? buildDate.slice(0, 10)}</lastmod>
  </url>
  <url>
    <loc>${site.url}/colophon</loc>
    <lastmod>${buildDate.slice(0, 10)}</lastmod>
  </url>
</urlset>
`

  // Optional and experimental for AI tools: a short, factual summary. No ranking claims.
  const llms = `# ${site.fullName} (${site.nickname})

> ${site.description}

${site.jobTitle} in ${site.city}, India. Works with ${site.knowsAbout.join(', ')}. Open to AI and agent developer roles; happy to relocate.

A small personal site with a mascot that follows kish's day in India time (IST), a live clock, the latest public GitHub activity, and 88×31 buttons for the things kish likes.

## Links

${[{ label: 'Website', href: url }, ...links].map((l) => `- [${l.label}](${l.href})`).join('\n')}
`

  // /.well-known/button.json: the 88×31 buttons for button-wall tools, per the IETF draft "The Well
  // Known Button Information Specification" (draft-filmroellchen-lunar-well-known-button-00). The
  // GIFs, as they are what other sites embed; hotlink: true says linking them from here is fine.
  const buttonJson = () =>
    JSON.stringify(
      {
        $schema:
          'https://codeberg.org/LunarEclipse/well-known-button/raw/branch/main/drafts/draft-filmroellchen-lunar-well-known-button-00.schema.json',
        default: myButtons[0].file,
        buttons: myButtons.map((b) => ({
          id: b.file,
          uri: `${site.url}/${b.file}.gif`,
          alt: b.alt,
          link: url,
          sha256: createHash('sha256').update(readFileSync(`public/${b.file}.gif`)).digest('hex'),
          hotlink: true,
        })),
      },
      null,
      2,
    )

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
      this.emitFile({ type: 'asset', fileName: '.well-known/button.json', source: buttonJson() })
    },
  }
}
