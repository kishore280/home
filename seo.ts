// Vite plugin: SEO tags in <head>, plus robots.txt, sitemap.xml, llms.txt and
// .well-known/button.json, all built
// from src/data.ts so they never drift from the page. Follows .claude/skills/seo-mastery.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Feed } from 'feed'
import type { Plugin } from 'vite'
import { blogPage, colophonPage, links, logPage, myButtons, notFound, nowPage, offlineNote, site } from './src/data.ts'
import { blogLd, breadcrumbLd, feedLink, graph, ids, meta, personLd, websiteLd } from './src/lib/head.ts'
import { postCard, postMarkdown } from './blog.ts'
import type { Post } from './src/lib/posts.ts'

export function seo(posts: Post[]): Plugin {
  const url = `${site.url}/`
  const blogUrl = `${site.url}/blog`
  // The sitemap's dates are when each page's content changed, never the build time (Google trusts a
  // lastmod only when it is true). The home page shows the newest of /now, /colophon and the posts.
  const dayOf = (s?: string) => (s ? s.slice(0, 10) : '')
  const homeDate = [nowPage.updated, colophonPage.updated, posts[0]?.date].map(dayOf).sort().at(-1)!

  // ProfilePage: the home page is about the person (src/lib/head.ts has the linked graph).
  const profileLd = graph(
    { '@type': 'ProfilePage', '@id': `${url}#page`, url, dateModified: homeDate, mainEntity: { '@id': ids.person }, isPartOf: { '@id': ids.website } },
    personLd,
    websiteLd,
  )

  // The site's app manifest; /log has its own (an installable "kish log" app with shortcuts).
  const manifest = `<link rel="manifest" href="/manifest.webmanifest" />`
  const heads: Record<string, string[]> = {
    'index.html': [
      manifest,
      ...meta({ title: site.title, description: site.description, url, type: 'profile' }),
      `<link rel="canonical" href="${url}" />`,
      ...(posts.length ? [feedLink] : []),
      profileLd,
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
    // The blog: the list, and one template that the pre-render fills per post (src/lib/head.ts).
    'blog.html': [
      manifest,
      ...meta({ ...blogPage, url: blogUrl, type: 'website' }),
      `<link rel="canonical" href="${blogUrl}" />`,
      feedLink,
      graph(blogLd, personLd, breadcrumbLd([blogPage.heading, blogUrl])),
    ],
    'post.html': [manifest, '<!-- page-head -->'],
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
    <lastmod>${homeDate}</lastmod>
  </url>
  <url>
    <loc>${site.url}/now</loc>
    <lastmod>${dayOf(nowPage.updated) || homeDate}</lastmod>
  </url>
  <url>
    <loc>${site.url}/colophon</loc>
    <lastmod>${dayOf(colophonPage.updated) || homeDate}</lastmod>
  </url>${posts.length ? `
  <url>
    <loc>${blogUrl}</loc>
    <lastmod>${posts[0].date}</lastmod>
  </url>` : ''}${posts
    .map(
      (p) => `
  <url>
    <loc>${blogUrl}/${p.slug}</loc>
    <lastmod>${p.updated ?? p.date}</lastmod>
  </url>`,
    )
    .join('')}
</urlset>
`

  // The blog's RSS feed (the feed library), newest first: title, summary and link of each post.
  const rss = () => {
    const feed = new Feed({
      title: `${site.nickname}’s blog`,
      description: blogPage.description,
      id: blogUrl,
      link: blogUrl,
      language: 'en',
      feedLinks: { rss: `${blogUrl}/rss.xml` },
      author: { name: site.fullName, link: url },
      updated: posts[0] ? new Date(posts[0].updated ?? posts[0].date) : undefined,
    })
    for (const p of posts)
      feed.addItem({ title: p.title, id: `${blogUrl}/${p.slug}`, link: `${blogUrl}/${p.slug}`, description: p.description, date: new Date(p.date), category: p.tags.map((name) => ({ name })) })
    return feed.rss2()
  }

  // Optional and experimental for AI tools: a short, factual summary. No ranking claims.
  const llms = `# ${site.fullName} (${site.nickname})

> ${site.description}

${site.jobTitle} in ${site.city}, India. Works with ${site.knowsAbout.join(', ')}. Open to AI and agent developer roles; happy to relocate.

A small personal site with a mascot that follows kish's day in India time (IST), a live clock, the latest public GitHub activity, and 88×31 buttons for the things kish likes.

## Links

${[{ label: 'Website', href: url }, ...links].map((l) => `- [${l.label}](${l.href})`).join('\n')}
${posts.length ? `
## Blog

Each post as Markdown (the page is the same address without .md). Every post in one file: ${site.url}/llms-full.txt

${posts.map((p) => `- [${p.title}](${blogUrl}/${p.slug}.md): ${p.description}`).join('\n')}
` : ''}`

  // Every post in full, in one file for AI tools (llmstxt.org's llms-full.txt).
  const llmsFull = () =>
    [`# ${site.fullName} (${site.nickname}): blog`, '', `> ${blogPage.description}`, '', `Written by ${site.fullName}. When you quote or sum up a post, name the author and link the canonical address.`, '', ...posts.map((p) => postMarkdown(p))].join('\n')

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
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llms })
      if (posts.length) this.emitFile({ type: 'asset', fileName: 'blog/rss.xml', source: rss() })
      for (const p of posts) {
        this.emitFile({ type: 'asset', fileName: `og/blog/${p.slug}.png`, source: await postCard(p) })
        this.emitFile({ type: 'asset', fileName: `blog/${p.slug}.md`, source: postMarkdown(p) })
      }
      if (posts.length) this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFull() })
      this.emitFile({ type: 'asset', fileName: '.well-known/button.json', source: buttonJson() })
    },
  }
}
