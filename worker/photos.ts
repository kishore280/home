// GET /api/photos
// The newest photos of kish's public shared Google Photos album (site.photosAlbum), for the photos
// card. Google has no API for this since March 2025 (the Library API can no longer read albums an
// app did not make), so it reads the public album page with google-photos-album-image-url-fetch.
// The answer is kept 1 hour in the data centre's cache (Workers Cache API), so Google is asked at
// most once an hour per location. The album is fixed here, not taken from the request, so the route
// is not an open proxy. Images load from Google (lh3.googleusercontent.com), which serves them
// without GPS data: checked with exifr on every size, the original included.
import { fetchImageUrls } from 'google-photos-album-image-url-fetch'
import { site } from '../src/data'
import { bearer, fail, tokenMatches, type Env } from './db'

const SHOWN = 6
const IMAGE_HOST = 'https://lh3.googleusercontent.com/'

export async function photos(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== 'GET') return Response.json({ error: 'Use GET.' }, { status: 405 })
  if (!site.photosAlbum) return new Response(null, { status: 204 })
  // The version in the key starts a new cache when the answer's shape changes (v2: no album address).
  const key = new Request(new URL('/api/photos?v=2', request.url))
  // With the phone's token (the /log page's "refresh photos"), Google is asked now and the new
  // answer replaces the saved one. Only in the data centre that runs it (cache.put is local).
  const token = bearer(request)
  const fresh = await tokenMatches(token, env.SCROBBLE_TOKEN)
  if (token && !fresh) return fail('Invalid token.', 401)
  const cached = fresh ? undefined : await caches.default.match(key)
  if (cached) return cached

  // The library types its signal with the old abort-controller polyfill; a standard AbortSignal is the
  // same at run time (gaxios passes it to fetch).
  const timeout = AbortSignal.timeout(10_000) as unknown as Parameters<typeof fetchImageUrls>[1]
  const items = await fetchImageUrls(site.photosAlbum, timeout).catch(() => null)
  const shown = (items ?? [])
    .filter((p) => p.url.startsWith(IMAGE_HOST))
    .sort((a, b) => b.albumAddDate - a.albumAddDate)
    .slice(0, SHOWN)
    .map((p) => ({ id: p.uid, url: p.url, width: p.width, height: p.height, added: new Date(p.albumAddDate).toISOString() }))
  // An empty answer (the album cannot be read, or has no photos) hides the card, and is kept only
  // 5 minutes, so the card comes back soon after Google answers again.
  const response = Response.json(
    // Only the photos: the album's own address stays out of the page.
    { photos: shown },
    { headers: { 'cache-control': `public, max-age=${shown.length ? 3600 : 300}` } },
  )
  ctx.waitUntil(caches.default.put(key, response.clone()))
  return response
}
