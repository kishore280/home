import { useId, type ReactNode } from 'react'

export function Card({ title, id, children }: { title?: string; id?: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section className="card" id={id} aria-labelledby={title ? headingId : undefined}>
      {title ? <h2 id={headingId}>{title}</h2> : null}
      {children}
    </section>
  )
}
