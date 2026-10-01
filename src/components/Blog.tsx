import type { MDXContent } from 'mdx/types'
import { useRef, useState, type ComponentProps } from 'react'
import { blogPage } from '../data'
import { posts } from '../lib/post-list'
import { postDate, postPath, type Post } from '../lib/posts'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'
import { Terminal } from './Terminal'

// A code block in a post (MDX's `pre`), with a button that copies its text. Like sofka.rs, the
// button says what it copies, and when the clipboard fails (an old browser, or permission refused)
// the code is selected for the reader to copy by hand. The status line reads the result out.
function CodeBlock(props: ComponentProps<'pre'> & { 'data-lang'?: string }) {
  const pre = useRef<HTMLPreElement>(null)
  const [state, setState] = useState<'copy' | 'copied' | 'failed'>('copy')
  const lang = props['data-lang']
  const copy = async () => {
    const code = pre.current
    if (!code) return
    try {
      await navigator.clipboard.writeText(code.innerText)
      setState('copied')
    } catch {
      getSelection()?.selectAllChildren(code)
      setState('failed')
    }
    setTimeout(() => setState('copy'), 2500)
  }
  const keys = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C'
  return (
    <div className="code">
      <pre ref={pre} {...props} />
      <button type="button" className="copy" onClick={copy} aria-label={state === 'copy' ? `copy the ${!lang || lang === 'text' ? 'text' : `${lang} code`}` : undefined} data-umami-event="Code copy">
        {state === 'copied' ? 'copied' : state === 'failed' ? `press ${keys}` : 'copy'}
      </button>
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied' : state === 'failed' ? `Copy failed. The code is selected: press ${keys}.` : ''}
      </span>
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
          {/* MDX's components map: posts/*.mdx can use <Terminal> without importing it. */}
          <Body components={{ pre: CodeBlock, Terminal }} />
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
