// GET /api/photos
// The newest photos of kish's public shared Google Photos album (site.photosAlbum), for the photos
// card. Google has no API for this since March 2025 (the Library API can no longer read albums an
// app did not make), so it reads the public album page with google-photos-album-image-url-fetch.
// The answer is kept 1 hour in the data centre's cache (Workers Cache API), so Google is asked at
// most once an hour per location. The album is fixed here, not taken from the request, so the route
// is not an open proxy. Images load from Google (lh3.googleusercontent.com), which serves them
// without GPS data: checked with exifr on every size, the original included.
import { getSharedAlbumHtml, parsePhase1, parsePhase2, parsePhase3 } from 'google-photos-album-image-url-fetch/dist/impl'
import { site } from '../src/data'
import { bearer, fail, tokenMatches, type Env } from './db'

const SHOWN = 6

// The library's own steps (what its fetchImageUrls does), keeping the album data, because it drops
// the one field that says an item is a video: "76647426" (the length, the stream sizes and a video
// link), found only on videos (checked on a real album with photos and a video). The image link of a
// video is its still frame; the same link with =m37 / =m22 / =m18 is the 1080p / 720p / 360p stream
// (googlevideo.com), and =dv the original file as a download.
const VIDEO = '76647426'
function findVideos(data: unknown): string[] {
  const items = (data as { data?: [unknown, unknown[]] })?.data?.[1]
  return (Array.isArray(items) ? items : []).flatMap((e) =>
    Array.isArray(e) && typeof e[0] === 'string' && e[9] && typeof e[9] === 'object' && VIDEO in e[9] ? [e[0]] : [],
  )
}
const TAG = 'photos'
const IMAGE_HOST = 'https://lh3.googleusercontent.com/'

// Clears the saved photos in every Cloudflare data centre at once: purge by Cache-Tag, free on every
// plan since April 2025 and done in under 150 ms, and it clears what a Worker saved with cache.put.
// https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
// Needs the PURGE_TOKEN secret (an API token with only Zone > Cache Purge) and ZONE_ID; without them,
// "refresh photos" renews only the data centre that runs it.
async function purgeEverywhere(env: Env): Promise<boolean> {
  if (!env.PURGE_TOKEN || !env.ZONE_ID) return false
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.PURGE_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ tags: [TAG] }),
  }).catch(() => null)
  return res?.ok ?? false
}

export async function photos(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ error: 'Use GET.' }, { status: 405 })
  if (!site.photosAlbum) return new Response(null, { status: 204 })
  // The version in the key starts a new cache when the answer's shape changes (v2: no album address; v3: videos).
  const key = new Request(new URL('/api/photos?v=3', request.url))
  // With the phone's token (the /log page's "refresh photos"), Google is asked now and the new
  // answer replaces the saved one. Only in the data centre that runs it (cache.put is local).
  const token = bearer(request)
  const fresh = await tokenMatches(token, env.SCROBBLE_TOKEN)
  if (token && !fresh) return fail('Invalid token.', 401)
  const cached = fresh ? undefined : await caches.default.match(key)
  if (cached) return cached
  const everywhere = fresh && (await purgeEverywhere(env))

  // The library types its signal with the old abort-controller polyfill; a standard AbortSignal is the
  // same at run time (gaxios passes it to fetch).
  const timeout = AbortSignal.timeout(10_000) as unknown as Parameters<typeof getSharedAlbumHtml>[1]
  const data = await getSharedAlbumHtml(site.photosAlbum, timeout)
    .then((html) => parsePhase2(parsePhase1(html) ?? ''))
    .catch(() => null)
  const items = data ? parsePhase3(data) : null
  const videos = new Set(data ? findVideos(data) : [])
  const shown = (items ?? [])
    .filter((p) => p.url.startsWith(IMAGE_HOST))
    .sort((a, b) => b.albumAddDate - a.albumAddDate)
    .slice(0, SHOWN)
    .map((p) => ({
      id: p.uid,
      url: p.url,
      width: p.width,
      height: p.height,
      added: new Date(p.albumAddDate).toISOString(),
      ...(videos.has(p.uid) ? { video: true } : {}),
    }))
  // An empty answer (the album cannot be read, or has no photos) hides the card, and is kept only
  // 5 minutes, so the card comes back soon after Google answers again.
  const response = Response.json(
    // Only the photos: the album's own address stays out of the page.
    { photos: shown },
    { headers: { 'cache-control': `public, max-age=${shown.length ? 3600 : 300}`, 'cache-tag': TAG } },
  )
  ctx.waitUntil(caches.default.put(key, response.clone()))
  // For "refresh photos": where the new list is now (the body stays the same for everyone).
  if (fresh) response.headers.set('x-photos-refreshed', everywhere ? 'everywhere' : 'here')
  return response
}
