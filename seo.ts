// Vite plugin: SEO tags in <head>, plus robots.txt, sitemap.xml, llms.txt and
// .well-known/button.json, all built
// from src/data.ts so they never drift from the page. Follows .claude/skills/seo-mastery.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Feed } from 'feed'
import type { Plugin } from 'vite'
import { blogPage, colophonPage, links, logPage, myButtons, notFound, nowPage, offlineNote, site } from './src/data.ts'
import { blogLd, breadcrumbLd, feedLink, graph, ids, indexable, meta, personLd, websiteLd } from './src/lib/head.ts'
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
      ...indexable(url, `${site.url}/index.md`),
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
    'now.html': [manifest, ...meta({ ...nowPage, url: `${site.url}/now`, type: 'website' }), ...indexable(`${site.url}/now`, `${site.url}/now.md`)],
    'colophon.html': [
      manifest,
      ...meta({ ...colophonPage, url: `${site.url}/colophon`, type: 'website' }),
      ...indexable(`${site.url}/colophon`, `${site.url}/colophon.md`),
    ],
    // The blog: the list, and one template that the pre-render fills per post (src/lib/head.ts).
    'blog.html': [
      manifest,
      ...meta({ ...blogPage, url: blogUrl, type: 'website' }),
      ...indexable(blogUrl, `${blogUrl}.md`),
      feedLink,
      // The list page: a CollectionPage whose ItemList is every post, newest first.
      graph(
        {
          '@type': 'CollectionPage',
          '@id': `${blogUrl}#page`,
          url: blogUrl,
          name: blogPage.title,
          description: blogPage.description,
          inLanguage: 'en',
          isPartOf: { '@id': ids.website },
          about: { '@id': ids.blog },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: posts.length,
            itemListElement: posts.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${blogUrl}/${p.slug}`, name: p.title })),
          },
        },
        blogLd,
        personLd,
        breadcrumbLd([blogPage.heading, blogUrl]),
      ),
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

  // Markdown copies of the pages for AI tools (the posts have theirs, blog.ts): front matter with the
  // canonical address, then the page's text. Served noindex (public/_headers).
  const abs = (href: string) => (href.startsWith('/') ? `${site.url}${href}` : href)
  const markdown = (title: string, description: string, canonical: string, body: string) =>
    `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nauthor: ${site.fullName}\ncanonical: ${canonical}\n---\n\n# ${title}\n\n${body.trim()}\n`
  const textPageMd = (page: typeof nowPage, path: string) =>
    markdown(
      page.heading,
      page.description,
      `${site.url}${path}`,
      [
        `${page.intro}${page.updated ? ` Updated ${page.updated}.` : ''}`,
        ...page.sections.map((s) => `## ${s.title}\n\n${s.items.map((i) => `- ${i.href ? `[${i.text}](${abs(i.href)})` : i.text}`).join('\n')}`),
      ].join('\n\n'),
    )
  const postList = posts.map((p) => `- [${p.title}](${blogUrl}/${p.slug}) (${p.date}): ${p.description} Markdown: ${blogUrl}/${p.slug}.md`).join('\n')
  const pages = [
    { path: '/', md: 'index.md', name: `${site.fullName} (${site.nickname})`, description: site.description },
    { path: '/now', md: 'now.md', name: 'now', description: nowPage.description },
    { path: '/colophon', md: 'colophon.md', name: 'colophon', description: colophonPage.description },
    ...(posts.length ? [{ path: '/blog', md: 'blog.md', name: blogPage.heading, description: blogPage.description }] : []),
  ]
  const pageMarkdown: Record<string, string> = {
    'index.md': markdown(
      `${site.fullName} (${site.nickname})`,
      site.description,
      url,
      [
        `${site.jobTitle} in ${site.city}, India, ${site.intro}`,
        `Works with ${site.knowsAbout.join(', ')}. Open to AI and agent developer roles; happy to relocate.`,
        `## Links\n\n${links.map((l) => `- [${l.label}](${l.href})`).join('\n')}`,
        ...(posts.length ? [`## Writing\n\n${postList}`] : []),
        `## Pages\n\n${pages.slice(1).map((p) => `- [${p.name}](${abs(p.path)}): ${p.description}`).join('\n')}`,
      ].join('\n\n'),
    ),
    'now.md': textPageMd(nowPage, '/now'),
    'colophon.md': textPageMd(colophonPage, '/colophon'),
    ...(posts.length ? { 'blog.md': markdown(blogPage.heading, blogPage.description, blogUrl, postList) } : {}),
  }

  // Optional and experimental for AI tools: a short, factual summary. No ranking claims.
  const llms = `# ${site.fullName} (${site.nickname})

> ${site.description}

${site.jobTitle} in ${site.city}, India. Works with ${site.knowsAbout.join(', ')}. Open to AI and agent developer roles; happy to relocate.

A small personal site with a mascot that follows kish's day in India time (IST), a live clock, the latest public GitHub activity, and 88×31 buttons for the things kish likes.

These are faithful Markdown copies of the public pages. Cite the canonical HTML address (the same address without .md).

## Pages

${pages.map((p) => `- [${p.name}](${site.url}/${p.md}): ${p.description}`).join('\n')}

## Links

${[{ label: 'Website', href: url }, ...links].map((l) => `- [${l.label}](${l.href})`).join('\n')}
${posts.length ? `
## Blog

Each post as Markdown (the page is the same address without .md). Every page and post in one file: ${site.url}/llms-full.txt

${posts.map((p) => `- [${p.title}](${blogUrl}/${p.slug}.md): ${p.description}`).join('\n')}
` : ''}`

  // Every post in full, in one file for AI tools (llmstxt.org's llms-full.txt).
  const llmsFull = () =>
    [`# ${site.fullName} (${site.nickname})`, '', `> ${site.description}`, '', `Every public page and post in one file. Written by ${site.fullName}. When you quote or sum up a page, name the author and link the canonical address.`, '', ...Object.values(pageMarkdown), ...posts.map((p) => postMarkdown(p))].join('\n')

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
      for (const [fileName, source] of Object.entries(pageMarkdown)) this.emitFile({ type: 'asset', fileName, source })
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: llmsFull() })
      this.emitFile({ type: 'asset', fileName: '.well-known/button.json', source: buttonJson() })
    },
  }
}
