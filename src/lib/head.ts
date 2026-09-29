// Head tags shared by seo.ts (the fixed pages) and the pre-render (one per blog post).
// Follows .claude/skills/seo-mastery.
import { blogPage, links, site } from '../data.ts'
import type { Post } from './posts.ts'

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const siteImage = `${site.url}/og.png`
const siteImageAlt = 'kish’s lavender mascot next to a row of 88×31 buttons: beach, running, badminton, parotta, Himalayan, chai and coding'
export const ldJson = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

// Title, description and share-card tags for one page.
export const meta = ({ image = siteImage, imageAlt = siteImageAlt, ...p }: { title: string; description: string; url: string; type: string; image?: string; imageAlt?: string }) => [
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

// Structured data as one linked graph (schema.org @id), so search engines tie every page and post to
// the same person and site. Google reads WebSite `name` as the site name in results.
const home = `${site.url}/`
const blogUrl = `${site.url}/blog`
export const ids = { person: `${site.url}/#person`, website: `${site.url}/#website`, blog: `${blogUrl}#blog` }
export const personLd = {
  '@type': 'Person',
  '@id': ids.person,
  name: site.fullName,
  alternateName: [site.name, site.nickname],
  description: site.description,
  jobTitle: site.jobTitle,
  knowsAbout: site.knowsAbout,
  homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: site.city, addressCountry: site.country } },
  image: `${site.url}/icon-512.png`,
  url: home,
  sameAs: links.map((l) => l.href),
}
export const websiteLd = {
  '@type': 'WebSite',
  '@id': ids.website,
  url: home,
  name: site.nickname,
  alternateName: site.fullName,
  description: site.description,
  inLanguage: 'en',
  publisher: { '@id': ids.person },
}
export const blogLd = {
  '@type': 'Blog',
  '@id': ids.blog,
  url: blogUrl,
  name: blogPage.title,
  description: blogPage.description,
  author: { '@id': ids.person },
  isPartOf: { '@id': ids.website },
}
// home › … (the last crumb is the page itself).
export const breadcrumbLd = (...crumbs: [name: string, url: string][]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['home', home], ...crumbs].map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
})
export const graph = (...nodes: object[]) => ldJson({ '@context': 'https://schema.org', '@graph': nodes })

// A page for search engines: its canonical address, permission for long text quotes and large images
// in results (Google's max-snippet / max-image-preview; AI Overviews quote from snippets), and its
// Markdown copy for AI tools (seo.ts writes it).
export const indexable = (url: string, markdown: string) => [
  `<link rel="canonical" href="${url}" />`,
  `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
  `<link rel="alternate" type="text/markdown" href="${markdown}" />`,
]

// Feed readers find the blog's RSS from any page that has this.
export const feedLink = `<link rel="alternate" type="application/rss+xml" title="${esc(`${site.nickname}’s blog`)}" href="${site.url}/blog/rss.xml" />`

// A post's own tags, put in place of <!-- page-head --> by the pre-render.
export function postHead(post: Post) {
  const url = `${site.url}/blog/${post.slug}`
  // Its own share card (blog.ts, postCard).
  const image = `${site.url}/og/blog/${post.slug}.png`
  return [
    ...meta({ title: `${post.title} · ${site.nickname}`, description: post.description, url, type: 'article', image, imageAlt: `${post.title}, by kish` }),
    `<meta property="article:published_time" content="${post.date}" />`,
    ...(post.updated ? [`<meta property="article:modified_time" content="${post.updated}" />`] : []),
    `<meta property="article:author" content="${home}" />`,
    `<meta property="article:section" content="${blogPage.heading}" />`,
    ...indexable(url, `${url}.md`),
    feedLink,
    graph(
      {
        '@type': 'BlogPosting',
        '@id': `${url}#post`,
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        author: { '@id': ids.person },
        publisher: { '@id': ids.person },
        isPartOf: { '@id': ids.blog },
        url,
        mainEntityOfPage: url,
        image,
        keywords: post.tags,
        articleSection: blogPage.heading,
        wordCount: post.words,
        inLanguage: 'en',
      },
      personLd,
      breadcrumbLd([blogPage.heading, blogUrl], [post.title, url]),
    ),
  ].join('\n    ')
}
