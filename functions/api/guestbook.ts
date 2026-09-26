// Cloudflare Pages Function: GET/POST /api/guestbook
import { fail, ipHash, json, type DbEnv } from './_db'

type Row = { id: number; name: string; text: string; created_at: string }

const WHITESPACE = /\s+/g

const toNote = (r: Row) => ({ id: r.id, name: r.name, text: r.text, at: r.created_at })
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(WHITESPACE, ' ').trim().slice(0, max) : ''

export const onRequestGet: PagesFunction<DbEnv> = async ({ env }) => {
  if (!env.DB) return new Response(null, { status: 204 })
  const { results } = await env.DB.prepare(
    'SELECT id, name, text, created_at FROM notes ORDER BY id DESC LIMIT 50',
  ).all<Row>()
  return json(results.map(toNote))
}

export const onRequestPost: PagesFunction<DbEnv> = async ({ env, request }) => {
  if (!env.DB) return fail('The guestbook is not set up yet.', 503)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return fail('Send the note as JSON.')

  // Bots fill the hidden "website" field; accept quietly and store nothing.
  if (clean(body.website, 100)) return json({ id: 0, name: 'you', text: '', at: new Date().toISOString() })

  const name = clean(body.name, 24) || 'anon'
  const text = clean(body.text, 140)
  if (!text) return fail('Write a note first.')

  const hash = await ipHash(request)
  const recent = await env.DB.prepare(
    "SELECT 1 FROM notes WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 seconds')",
  )
    .bind(hash)
    .first()
  if (recent) return fail('Slow down a little. Try again in 30 seconds.', 429)

  const row = await env.DB.prepare(
    'INSERT INTO notes (name, text, ip_hash) VALUES (?, ?, ?) RETURNING id, name, text, created_at',
  )
    .bind(name, text, hash)
    .first<Row>()
  return row ? json(toNote(row), 201) : fail('Could not save the note. Try again.', 500)
}
