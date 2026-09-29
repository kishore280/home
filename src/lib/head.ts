// Head tags shared by seo.ts (the fixed pages) and the pre-render (one per blog post).
// Follows .claude/skills/seo-mastery.
import { site } from '../data.ts'
import type { Post } from './posts.ts'

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const image = `${site.url}/og.png`
const imageAlt = 'kish’s lavender mascot next to a row of 88×31 buttons: beach, running, badminton, parotta, Himalayan, chai and coding'
export const ldJson = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

// Title, description and share-card tags for one page.
export const meta = (p: { title: string; description: string; url: string; type: string }) => [
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

// Feed readers find the blog's RSS from any page that has this.
export const feedLink = `<link rel="alternate" type="application/rss+xml" title="${esc(`${site.nickname}’s blog`)}" href="${site.url}/blog/rss.xml" />`

// A post's own tags, put in place of <!-- page-head --> by the pre-render.
export function postHead(post: Post) {
  const url = `${site.url}/blog/${post.slug}`
  return [
    ...meta({ title: `${post.title} · ${site.fullName}`, description: post.description, url, type: 'article' }),
    `<meta property="article:published_time" content="${post.date}" />`,
    ...(post.updated ? [`<meta property="article:modified_time" content="${post.updated}" />`] : []),
    `<link rel="canonical" href="${url}" />`,
    feedLink,
    ldJson({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      author: { '@type': 'Person', name: site.fullName, url: `${site.url}/` },
      url,
      mainEntityOfPage: url,
      image,
      keywords: post.tags,
      inLanguage: 'en',
    }),
  ].join('\n    ')
}
