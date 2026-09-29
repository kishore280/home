// The blog's list, read at build time: the front matter of each posts/<slug>.md (vfile-matter, as the
// MDX docs show for "data without compiling"). The bodies are compiled by MDX (@mdx-js/rollup in
// vite.config.ts). A post with a missing or wrong field stops the build.
import { readdirSync, readFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { createElement, type CSSProperties, type ReactNode } from 'react'
import satori from 'satori'
import { readSync } from 'to-vfile'
import { matter } from 'vfile-matter'
import { site } from './src/data.ts'
import { postDate, type Post } from './src/lib/posts.ts'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function readPosts(dir = 'posts'): Post[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.slice(0, -3)
      const file = readSync(`${dir}/${f}`)
      matter(file, { strip: true })
      const m = (file.data.matter ?? {}) as Record<string, unknown>
      const text = (k: string) => (typeof m[k] === 'string' && m[k] ? (m[k] as string) : undefined)
      const title = text('title')
      const description = text('description')
      const date = text('date')
      const updated = text('updated')
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`posts/${f}: name the file with a-z, 0-9 and -`)
      if (!title || !description) throw new Error(`posts/${f}: add a title and a description`)
      if (!date || !DAY.test(date) || (updated && !DAY.test(updated))) throw new Error(`posts/${f}: write date (and updated) as YYYY-MM-DD, in quotes`)
      const tags = Array.isArray(m.tags) ? m.tags.map(String) : []
      // About 200 words a minute.
      const minutes = Math.max(1, Math.round(String(file).split(/\s+/).filter(Boolean).length / 200))
      return { slug, title, description, date, ...(updated ? { updated } : {}), tags, minutes }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
}

// Each post's share card (1200×630 PNG, og/blog/<slug>.png), drawn at build time with satori (React
// elements → SVG) and resvg (SVG → PNG), as Vercel's OG images and yagiz.co do; no browser needed, so
// Cloudflare's build makes them too. Same look as public/og.png: dots, the cat in its card, Pixelify.
const font = (file: string) => readFileSync(`node_modules/@fontsource/${file}`)
const fonts = [
  { name: 'Nunito', data: font('nunito/files/nunito-latin-600-normal.woff'), weight: 600 as const },
  { name: 'Pixelify', data: font('pixelify-sans/files/pixelify-sans-latin-700-normal.woff'), weight: 700 as const },
]
// The page's dots: one dot in a 30 px tile, repeated.
const dot = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle cx="15" cy="15" r="2.5" fill="#e6def6"/></svg>').toString('base64')}`
const mascot = `data:image/svg+xml;base64,${readFileSync('scripts/og/mascot.svg').toString('base64')}`
// satori lays out with flexbox only: every box is display: flex.
const el = (type: string, style: CSSProperties, ...children: ReactNode[]) => createElement(type, { style: { display: 'flex', ...style } }, ...children)

export async function postCard(post: Post): Promise<Buffer> {
  const svg = await satori(
    el(
      'div',
      {
        width: 1200,
        height: 630,
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '0 72px',
        backgroundColor: '#f6f3fc',
        backgroundImage: `url(${dot})`,
        backgroundSize: '30px 30px',
        fontFamily: 'Nunito',
        color: '#3a3150',
      },
      el(
        'div',
        { display: 'flex', flexDirection: 'column', flex: 1, gap: 22 },
        el('div', { fontFamily: 'Pixelify', fontSize: 30, color: '#7358c4' }, 'kish · writing'),
        el('div', { fontFamily: 'Pixelify', fontSize: post.title.length > 48 ? 58 : 70, lineHeight: 1.08 }, post.title),
        el('div', { fontSize: 28, color: '#6f6590' }, `${postDate(post.date, true)} · ${post.minutes} min read`),
        el('div', { fontFamily: 'Pixelify', fontSize: 30, color: '#9b7fe0', marginTop: 12 }, 'kichoow.com'),
      ),
      el(
        'div',
        {
          width: 300,
          height: 330,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          border: '4px solid #e8e0f7',
          borderRadius: 32,
          boxShadow: '0 8px 0 #e8e0f7',
        },
        createElement('img', { src: mascot, width: 220, height: 220 }),
      ),
    ),
    { width: 1200, height: 630, fonts },
  )
  return new Resvg(svg).render().asPng()
}

// A post as Markdown for AI tools (blog/<slug>.md and llms-full.txt, seo.ts), as llmstxt.org and
// yagiz.co do: the facts in YAML front matter, then the text as kish wrote it.
export function postMarkdown(post: Post, dir = 'posts'): string {
  const file = readSync(`${dir}/${post.slug}.md`)
  matter(file, { strip: true })
  const url = `${site.url}/blog/${post.slug}`
  const yaml = [
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `date: ${post.date}`,
    ...(post.updated ? [`updated: ${post.updated}`] : []),
    `author: ${site.fullName}`,
    `canonical: ${url}`,
  ]
  return `---\n${yaml.join('\n')}\n---\n\n# ${post.title}\n\n${String(file).trim()}\n`
}
