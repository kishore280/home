// The blog's posts: posts/<slug>.md. The list comes from their front matter at build time (blog.ts,
// through `__POSTS__` in vite.config.ts), newest first; each body is compiled by MDX.
export type Post = {
  slug: string
  title: string
  description: string
  // YYYY-MM-DD, the day it was published; `updated` the day it last changed, if it did.
  date: string
  updated?: string
  tags: string[]
  minutes: number
}

export const posts: Post[] = __POSTS__

export const postPath = (slug: string) => `/blog/${slug}`

// The day of a post, the same in every time zone (so the pre-rendered page matches).
export const postDate = (day: string, year = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: year ? 'numeric' : undefined, timeZone: 'UTC' })
