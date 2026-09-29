import type { Post } from './posts'

// Every post, newest first: their front matter, read at build time (blog.ts, through `__POSTS__` in
// vite.config.ts).
export const posts: Post[] = __POSTS__
