// GET /api/github
// The public repo of site.github that was pushed to last. It uses the repo list sorted by push
// time (pushed_at changes on each push), not the Events API, which GitHub says "is not built to
// serve real-time use cases… event latency can be anywhere from 30s to 6h".
// https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user
// No key needed; responses are cached for 5 minutes. The user is fixed here, not taken from the
// request, so the route is not an open GitHub proxy.
import { site } from '../src/data'

type Repo = { name: string; html_url: string; pushed_at: string | null }

export async function github(): Promise<Response> {
  if (!site.github) return new Response(null, { status: 204 })

  const res = await fetch(`https://api.github.com/users/${site.github}/repos?sort=pushed&per_page=1`, {
    headers: { 'user-agent': 'home-site', accept: 'application/vnd.github+json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  })
  if (!res.ok) return new Response(null, { status: 204 })

  const [repo] = (await res.json()) as Repo[]
  if (!repo?.pushed_at) return new Response(null, { status: 204 })

  return Response.json(
    { repo: repo.name, url: repo.html_url, at: repo.pushed_at },
    { headers: { 'cache-control': 'public, max-age=300' } },
  )
}
