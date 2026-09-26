// GET /api/now-playing
// Set LASTFM_API_KEY and LASTFM_USER in the Worker settings to turn it on.
// Without them it returns 204 and the music row stays hidden.
import type { Env } from './db'

type LastFmTrack = {
  name: string
  artist: { '#text': string }
  '@attr'?: { nowplaying?: string }
}

export async function nowPlaying(env: Env): Promise<Response> {
  if (!env.LASTFM_API_KEY || !env.LASTFM_USER) return new Response(null, { status: 204 })

  const url = new URL('https://ws.audioscrobbler.com/2.0/')
  url.search = new URLSearchParams({
    method: 'user.getrecenttracks',
    user: env.LASTFM_USER,
    api_key: env.LASTFM_API_KEY,
    format: 'json',
    limit: '1',
  }).toString()

  const res = await fetch(url, { cf: { cacheTtl: 30 } })
  if (!res.ok) return new Response(null, { status: 204 })

  const data = (await res.json()) as { recenttracks?: { track?: LastFmTrack[] } }
  const track = data.recenttracks?.track?.[0]
  if (!track) return new Response(null, { status: 204 })

  return Response.json(
    {
      title: track.name,
      artist: track.artist['#text'],
      playing: track['@attr']?.nowplaying === 'true',
    },
    { headers: { 'cache-control': 'public, max-age=30' } },
  )
}
