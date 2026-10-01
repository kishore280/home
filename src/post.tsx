import type { MDXContent } from 'mdx/types'
import { PostPage } from './components/Blog'
import { mount } from './lib/mount'
import { posts } from './lib/post-list'

// One page for every post (dist/blog/<slug>.html, pre-rendered from post.html): find this post by
// its address, load only its body (one small file per post), then hydrate.
const bodies = import.meta.glob<MDXContent>('/posts/*.{md,mdx}', { import: 'default' })
const slug = location.pathname.replace(/(\.html)?\/?$/, '').split('/').pop()
const post = posts.find((p) => p.slug === slug)
const load = post && bodies[`/posts/${post.file}`]
if (post && load) void load().then((Body) => mount(<PostPage post={post} Body={Body} />))
