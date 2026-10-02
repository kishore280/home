// /p — a small paste bin, like paste.rs: anyone sends text and gets a short link that expires.
//   POST    /p?ttl=1h   the body is the text (curl --data-binary @file https://kichoow.com/p);
//                       the answer is the link. ttl: 60s to 30d (s, m, h, d), 1d when left out.
//   GET     /p/abc123   the text, as plain text.
//   DELETE  /p/abc123   Bearer SCROBBLE_TOKEN: kish removes a paste.
//   GET     /p          how to use it.
// Storage: Workers KV. Each paste is one key, written once with expirationTtl, so KV deletes it by
// itself (KV docs: "Expiring keys"). The free plan allows 1,000 writes a day; past that a write
// fails and the answer says to try tomorrow, so it never costs money.
// Abuse: anyone can post, so a paste is UTF-8 text only (no files), at most 100 KB, 5 a minute per
// visitor (Workers Rate Limiting), and it is never a web page: plain text, nosniff and a sandbox
// CSP, so a link cannot become a fake login page on this domain. Pastes are kept out of search.
import { bearer, tokenMatches, type Env } from './db'

const MAX_BYTES = 100 * 1024
const ID = /^[A-Za-z0-9]{6}$/
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const UNIT = { s: 1, m: 60, h: 3600, d: 86_400 } as const
const DAY = 86_400

// Plain text, never a web page. Messages get a final newline for the terminal; a paste is sent
// back exactly as it came (raw).
const text = (body: string, status = 200, headers: HeadersInit = {}, raw = false) =>
  new Response(raw || body.endsWith('\n') ? body : `${body}\n`, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'no-store',
      ...headers,
    },
  })

const usage = (origin: string) => `kichoow.com/p: a paste bin. Pastes expire.

  curl --data-binary @file.txt ${origin}/p          # lives 1 day
  echo hello | curl --data-binary @- '${origin}/p?ttl=1h'

ttl: 60s to 30d (s, m, h or d). Text only, at most 100 KB, 5 pastes a minute.
`

// 6 random letters and digits; bytes over 247 are skipped so each one is equally likely.
function newId() {
  let id = ''
  while (id.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(8))) if (b < 248 && id.length < 6) id += ALPHABET[b % 62]
  }
  return id
}

// "90", "90s", "15m", "1h", "7d" → seconds, kept between 60 s and 30 days.
function ttlOf(value: string | null): number | null {
  if (value === null) return DAY
  const m = /^(\d{1,7})([smhd]?)$/.exec(value)
  if (!m) return null
  const seconds = Number(m[1]) * UNIT[(m[2] || 's') as keyof typeof UNIT]
  return seconds >= 60 && seconds <= 30 * DAY ? seconds : null
}

export async function paste(request: Request, env: Env, pathname: string): Promise<Response> {
  const url = new URL(request.url)
  if (pathname === '/p' || pathname === '/p/') {
    if (request.method === 'GET') return text(usage(url.origin))
    if (request.method === 'POST') return create(request, env, url)
    return text('Use GET or POST.', 405, { allow: 'GET, POST' })
  }
  const id = pathname.slice('/p/'.length)
  if (!ID.test(id)) return text('No such paste.', 404)
  if (request.method === 'GET') return read(env, id)
  if (request.method === 'DELETE') {
    if (!(await tokenMatches(bearer(request), env.SCROBBLE_TOKEN))) return text('Invalid token.', 401)
    await env.PASTES.delete(id)
    return text('Deleted.')
  }
  return text('Use GET or DELETE.', 405, { allow: 'GET, DELETE' })
}

async function create(request: Request, env: Env, url: URL) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!(await env.PASTE_LIMIT.limit({ key: ip })).success) return text('Too many pastes. Wait a minute.', 429, { 'retry-after': '60' })
  const ttl = ttlOf(url.searchParams.get('ttl'))
  if (ttl === null) return text('ttl must be 60s to 30d, for example 30m, 1h or 7d.', 400)
  // Check the size before reading the body, so a huge upload is never read into memory.
  const length = Number(request.headers.get('content-length'))
  if (!request.headers.has('content-length') || !Number.isSafeInteger(length)) return text('Send the text with a Content-Length (curl --data-binary does).', 411)
  if (length > MAX_BYTES) return text('Too big: 100 KB at most.', 413)
  if (length === 0) return text('Empty paste.', 400)
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) return text('Too big: 100 KB at most.', 413)
  let body: string
  try {
    body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
  } catch {
    return text('Text only (UTF-8): no files.', 415)
  }
  if (body.includes('\0')) return text('Text only (UTF-8): no files.', 415)

  // 62^6 ids: a clash is very unlikely, but never overwrite a live paste.
  let id = newId()
  for (let i = 0; i < 3 && (await env.PASTES.get(id)) !== null; i++) id = newId()
  const expires = new Date(Date.now() + ttl * 1000).toISOString()
  try {
    await env.PASTES.put(id, body, { expirationTtl: ttl, metadata: { expires } })
  } catch {
    // The free plan's 1,000 writes a day are used up (they reset at 00:00 UTC).
    return text('The paste bin is full for today. Try again tomorrow.', 503)
  }
  const link = `${url.origin}/p/${id}`
  return text(link, 201, { location: link, 'x-expires': expires })
}

async function read(env: Env, id: string) {
  const { value, metadata } = await env.PASTES.getWithMetadata<{ expires: string }>(id)
  if (value === null) return text('No such paste (or it expired).', 404)
  return text(
    value,
    200,
    {
      // Short, so a deleted paste does not stay in caches for long.
      'cache-control': 'public, max-age=60',
      ...(metadata ? { 'x-expires': metadata.expires } : {}),
    },
    true,
  )
}
