// The blog's list, read at build time: the front matter of each posts/<slug>.md (vfile-matter, as the
// MDX docs show for "data without compiling"). The bodies are compiled by MDX (@mdx-js/rollup in
// vite.config.ts). A post with a missing or wrong field stops the build.
import { readdirSync } from 'node:fs'
import { readSync } from 'to-vfile'
import { matter } from 'vfile-matter'
import type { Post } from './src/lib/posts.ts'

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
