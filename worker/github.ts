// GET /api/github
// Returns the latest public push of site.github. No key needed; responses are cached for 5 minutes.
// The user is fixed here, not taken from the request, so the route is not an open GitHub proxy.
import { site } from '../src/data'

type PushEvent = {
  type: string
  created_at: string
  repo: { name: string }
  payload: { commits?: { message: string }[] }
}

export async function github(): Promise<Response> {
  if (!site.github) return new Response(null, { status: 204 })

  const res = await fetch(`https://api.github.com/users/${site.github}/events/public?per_page=30`, {
    headers: { 'user-agent': 'home-site', accept: 'application/vnd.github+json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  })
  if (!res.ok) return new Response(null, { status: 204 })

  const events = (await res.json()) as PushEvent[]
  const push = events.find((e) => e.type === 'PushEvent')
  if (!push) return new Response(null, { status: 204 })

  const commits = push.payload.commits ?? []
  const message = commits.at(-1)?.message.split('\n')[0] ?? null

  return Response.json(
    {
      repo: push.repo.name.split('/')[1],
      url: `https://github.com/${push.repo.name}`,
      message,
      at: push.created_at,
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  )
}
