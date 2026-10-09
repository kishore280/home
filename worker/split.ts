// /api/split — splits for /experiments/split: kish lists the items ("bus 100, food 300") and a UPI
// ID, shares the link, and whoever opens it pays their share in a UPI app.
//   GET     ?s=<id>   public: one split (title, name, UPI ID, items). The id is 8 letters and digits.
//   GET               kish's list, newest first (at most 50)                 Bearer SCROBBLE_TOKEN
//   POST              { title?, name, vpa, items: [{ label, paise }] } → 201 { id }   Bearer
//   PUT     ?s=<id>   replaces one (same body as POST); the link stays the same       Bearer
//   DELETE  ?s=<id>   removes one                                             Bearer
// Only kish makes and deletes splits: the same token as /api/log (the Worker secret SCROBBLE_TOKEN).
// What a valid split is lives in src/lib/split.ts, which the page uses too. Money is in paise.
// The Worker only keeps a UPI ID and a name that kish chose to share; it never takes or holds money
// (a page cannot even know if a payment went through: UPI tells a web page nothing).
// Rows: a public GET reads 1 (the primary key); the list reads at most 50 (the index, then the
// rows); a POST writes 1 (and reads 1 on an id clash, which is very rare); a DELETE writes 1.
// Table: migrations/0010_splits.sql, and 0011_split_aid.sql (the optional `aid` of a Google Pay QR:
// with it the pay link is built like that QR, which Google Pay accepts; without it, Google Pay refuses).
import { AID, MAX_ITEMS, MAX_PAISE, VPA, clean, type Split, type SplitItem } from '../src/lib/split'
import { bearer, fail, json, jsonBody, tokenMatches, type Env } from './db'

const MAX_BODY = 4096
const LIST_LIMIT = 50
const ID = /^[A-Za-z0-9]{8}$/
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

type Row = { id: string; title: string; name: string; vpa: string; aid: string | null; items: string; created: number }

// The same "say what is missing" reply as /api/log, instead of a 500.
const orNotSetUp = (reply: Promise<Response>) =>
  reply.catch((error) =>
    String(error).includes('no such table') ? fail('Splits are not set up yet: run migrations/0010_splits.sql in the D1 Console.', 503) : Promise.reject(error),
  )

export async function split(request: Request, env: Env): Promise<Response> {
  const id = new URL(request.url).searchParams.get('s')
  if (request.method === 'GET' && id) return orNotSetUp(one(env, id))
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return fail('Use GET, POST, PUT or DELETE.', 405)
  // Everything else is kish's.
  if (!env.SCROBBLE_TOKEN) return fail('Splits are not set up yet: add the SCROBBLE_TOKEN secret in the Cloudflare dashboard.', 503)
  if (!(await tokenMatches(bearer(request), env.SCROBBLE_TOKEN))) return fail('Invalid token.', 401)
  if (request.method === 'GET') return orNotSetUp(list(env))
  if (request.method === 'DELETE') return orNotSetUp(remove(env, id))
  if (request.method === 'PUT') return orNotSetUp(update(request, env, id))
  return orNotSetUp(create(request, env))
}

// A row from the table as the page wants it. `items` was written by this file, but a bad row
// should not break the page for everyone, so it is read with care.
function toSplit(row: Row): Split {
  let items: SplitItem[] = []
  try {
    const parsed: unknown = JSON.parse(row.items)
    if (Array.isArray(parsed)) items = parsed.flatMap((p) => (Array.isArray(p) && typeof p[0] === 'string' && Number.isSafeInteger(p[1]) ? [{ label: p[0], paise: p[1] as number }] : []))
  } catch {
    // An unreadable row shows no items.
  }
  return { id: row.id, title: row.title, name: row.name, vpa: row.vpa, ...(row.aid ? { aid: row.aid } : {}), items, created: row.created }
}

async function one(env: Env, id: string) {
  if (!ID.test(id)) return fail('No such split.', 404)
  const row = await env.DB.prepare('SELECT id, title, name, vpa, aid, items, created FROM splits WHERE id = ?1').bind(id).first<Row>()
  return row ? json(toSplit(row)) : fail('No such split.', 404)
}

async function list(env: Env) {
  const { results } = await env.DB.prepare('SELECT id, title, name, vpa, aid, items, created FROM splits ORDER BY created DESC LIMIT ?1').bind(LIST_LIMIT).all<Row>()
  return json(results.map(toSplit))
}

async function remove(env: Env, id: string | null) {
  if (!id || !ID.test(id)) return fail('Say which one: ?s=<id>.')
  const { meta } = await env.DB.prepare('DELETE FROM splits WHERE id = ?1').bind(id).run()
  return meta.changes ? json({ deleted: id }) : fail('No such split.', 404)
}

// 8 random letters and digits; bytes over 247 are skipped, so every character is equally likely.
function newId() {
  let id = ''
  while (id.length < 8) for (const b of crypto.getRandomValues(new Uint8Array(16))) if (b < 248 && id.length < 8) id += ALPHABET[b % 62]
  return id
}

// The body, checked field by field. A string is the error to send back.
function readSplit(body: unknown): { title: string; name: string; vpa: string; aid: string | null; items: SplitItem[] } | string {
  if (typeof body !== 'object' || body === null) return 'Body must be a JSON object.'
  const { title = '', name, vpa, aid = null, items } = body as Record<string, unknown>
  if (typeof title !== 'string') return 'title must be text.'
  if (typeof name !== 'string' || !clean(name, 40)) return 'name is required.'
  if (typeof vpa !== 'string' || !VPA.test(vpa.trim())) return 'vpa must look like name@bank.'
  if (aid !== null && (typeof aid !== 'string' || !AID.test(aid))) return 'aid must be letters and digits (the aid of a Google Pay QR).'
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) return `items: send 1 to ${MAX_ITEMS}.`
  const checked: SplitItem[] = []
  for (const item of items) {
    const { label, paise } = (item ?? {}) as Record<string, unknown>
    if (typeof label !== 'string' || !clean(label, 40)) return 'Every item needs a label.'
    if (!Number.isSafeInteger(paise) || (paise as number) < 1 || (paise as number) > MAX_PAISE) return 'Every amount must be 1 paise to ₹1,00,000.'
    checked.push({ label: clean(label, 40), paise: paise as number })
  }
  return { title: clean(title, 60), name: clean(name, 40), vpa: vpa.trim(), aid, items: checked }
}

async function create(request: Request, env: Env) {
  const read = await jsonBody(request, MAX_BODY)
  if (read instanceof Response) return read
  const data = readSplit(read.body)
  if (typeof data === 'string') return fail(data)
  const items = JSON.stringify(data.items.map((i) => [i.label, i.paise]))
  // 62^8 ids: a clash is very unlikely, but one more try is cheap and a live split is never overwritten.
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId()
    const { meta } = await env.DB.prepare('INSERT OR IGNORE INTO splits (id, title, name, vpa, aid, items, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(id, data.title, data.name, data.vpa, data.aid, items, Date.now())
      .run()
    if (meta.changes) return json({ id }, 201)
  }
  return fail('Could not make an id. Try again.', 503)
}

// A PUT writes 1 row (the created time stays, so the list order does not change).
async function update(request: Request, env: Env, id: string | null) {
  if (!id || !ID.test(id)) return fail('Say which one: ?s=<id>.')
  const read = await jsonBody(request, MAX_BODY)
  if (read instanceof Response) return read
  const data = readSplit(read.body)
  if (typeof data === 'string') return fail(data)
  const items = JSON.stringify(data.items.map((i) => [i.label, i.paise]))
  const { meta } = await env.DB.prepare('UPDATE splits SET title = ?2, name = ?3, vpa = ?4, aid = ?5, items = ?6 WHERE id = ?1')
    .bind(id, data.title, data.name, data.vpa, data.aid, items)
    .run()
  return meta.changes ? json({ id }) : fail('No such split.', 404)
}
