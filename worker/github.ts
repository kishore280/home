// GET /api/github?user=<name>
// Returns the user's latest public push. No key needed; responses are cached for 5 minutes.

type PushEvent = {
  type: string
  created_at: string
  repo: { name: string }
  payload: { commits?: { message: string }[] }
}

export async function github(request: Request): Promise<Response> {
  const user = new URL(request.url).searchParams.get('user') ?? ''
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) return new Response(null, { status: 400 })

  const res = await fetch(`https://api.github.com/users/${user}/events/public?per_page=30`, {
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
