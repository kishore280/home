import type { MDXContent } from 'mdx/types'
import { useRef, useState, type ComponentProps } from 'react'
import { blogPage } from '../data'
import { posts } from '../lib/post-list'
import { postDate, postPath, type Post } from '../lib/posts'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'

// A code block in a post (MDX's `pre`), with a button that copies its text.
function CodeBlock(props: ComponentProps<'pre'>) {
  const pre = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pre.current?.innerText ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard (an old browser, or permission refused): the text can still be selected.
    }
  }
  return (
    <div className="code">
      <pre ref={pre} {...props} />
      <button type="button" className="copy" onClick={copy} data-umami-event="Code copy">
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}

// The blog: a plain reading page, no card around the text (the "B" look kish picked). Each post is
// an h-entry (microformats2), so IndieWeb readers find its title, date, author and text.
export function PostPage({ post, Body }: { post: Post; Body: MDXContent }) {
  return (
    <main className="blog-main" id="main">
      <article className="blog-page post h-entry">
        <p className="post-meta small">
          <a href="/blog">
            <span aria-hidden="true">←</span> {blogPage.heading}
          </a>{' '}
          · <time className="dt-published" dateTime={post.date}>{postDate(post.date, true)}</time> · {post.minutes} min read
        </p>
        <h1 className="p-name">{post.title}</h1>
        <div className="prose e-content">
          <Body components={{ pre: CodeBlock }} />
        </div>
        <footer className="post-foot">
          {post.tags.length ? (
            <ul className="tags" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t} className="p-category">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="post-by small">
            written by{' '}
            <a className="p-author h-card" href="/">
              kish
            </a>{' '}
            with {chaiIcon}
            <span className="sr-only">chai</span>
          </p>
        </footer>
      </article>
      <BackHome />
    </main>
  )
}

// /blog: every post, newest first, by year.
export function BlogIndex() {
  const years = [...new Set(posts.map((p) => p.date.slice(0, 4)))]
  return (
    <main className="blog-main" id="main">
      <div className="blog-page">
        <h1>{blogPage.heading}</h1>
        {years.map((y) => (
          <section key={y} aria-labelledby={`y${y}`}>
            <h2 id={`y${y}`}>{y}</h2>
            <ul className="post-list">
              {posts
                .filter((p) => p.date.startsWith(y))
                .map((p) => (
                  <li key={p.slug}>
                    <time dateTime={p.date}>{postDate(p.date)}</time>
                    <a href={postPath(p.slug)}>{p.title}</a>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        <p className="small">
          <a href="/blog/rss.xml">RSS feed</a>
        </p>
      </div>
      <BackHome />
    </main>
  )
}

// The home page's "writing" card: the newest three posts. No posts: no card.
export function Writing() {
  if (!posts.length) return null
  return (
    <Card title={blogPage.heading}>
      <ul className="post-rows">
        {posts.slice(0, 3).map((p) => (
          <li key={p.slug}>
            <time dateTime={p.date}>{postDate(p.date)}</time>
            <a href={postPath(p.slug)}>{p.title}</a>
            <span className="small">{p.minutes} min</span>
          </li>
        ))}
      </ul>
      <p className="small post-all">
        <a href="/blog">all posts →</a>
      </p>
    </Card>
  )
}
