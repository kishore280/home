import type { TextPage as Page } from '../data'
import { BackHome } from './BackHome'
import { Card } from './Card'

// A page of short lists from src/data.ts: /now and /colophon.
export function TextPage({ page }: { page: Page }) {
  return (
    <main className="narrow-page text-page" id="main">
      <Card>
        <h1>{page.heading}</h1>
        <p>
          {page.intro}
          {page.updated ? (
            <>
              {' '}
              <span className="small">
                Updated <time dateTime={page.updated}>{page.updated}</time>.
              </span>
            </>
          ) : null}
        </p>
        {page.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            <ul>
              {s.items.map((i) => (
                <li key={i.text}>{i.href ? <a href={i.href}>{i.text}</a> : i.text}</li>
              ))}
            </ul>
          </section>
        ))}
      </Card>
      <BackHome />
    </main>
  )
}
