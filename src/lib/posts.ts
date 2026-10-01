// The blog's posts: posts/<slug>.md, each body compiled by MDX. The list is in post-list.ts; this
// file also runs in Node at build time (blog.ts, src/lib/head.ts).
export type Post = {
  slug: string
  // The file in posts/: <slug>.md, or <slug>.mdx for a post that uses a component (<Terminal>).
  file: string
  title: string
  description: string
  // YYYY-MM-DD, the day it was published; `updated` the day it last changed, if it did.
  date: string
  updated?: string
  tags: string[]
  minutes: number
  words: number
}

export const postPath = (slug: string) => `/blog/${slug}`

// The day of a post, the same in every time zone (so the pre-rendered page matches).
export const postDate = (day: string, year = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: year ? 'numeric' : undefined, timeZone: 'UTC' })
