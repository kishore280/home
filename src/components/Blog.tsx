import type { MDXContent } from 'mdx/types'
import { blogPage } from '../data'
import { posts } from '../lib/post-list'
import { postDate, postPath, type Post } from '../lib/posts'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { chaiIcon } from './ChaiIcon'

// The blog: a plain reading page, no card around the text (the "B" look kish picked). Each post is
// an h-entry (microformats2), so IndieWeb readers find its title, date, author and text.
export function PostPage({ post, Body }: { post: Post; Body: MDXContent }) {
  return (
    <main className="blog-page" id="main">
      <article className="post h-entry">
        <p className="post-meta small">
          <a href="/blog">
            <span aria-hidden="true">←</span> {blogPage.heading}
          </a>{' '}
          · <time className="dt-published" dateTime={post.date}>{postDate(post.date, true)}</time> · {post.minutes} min read
        </p>
        <h1 className="p-name">{post.title}</h1>
        <div className="prose e-content">
          <Body />
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
          <p className="small">
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
    <main className="blog-page" id="main">
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
