---
title: How to show what you're listening to on your site
description: Pano Scrobbler on your Android phone sends each song to ListenBrainz, or to your own tiny server, and your site shows it live. Works with YouTube Music, Spotify or any player.
date: '2026-09-29'
tags: [music, pano scrobbler, listenbrainz, cloudflare]
---

The "right now" card on [my home page](/) shows the song I'm playing, or the last one and when.
I listen on YouTube Music, which has no public API. So my phone tells the site itself.

**You need:** an Android phone and a website. It works with any player that shows a media
notification: YouTube Music, Spotify, Apple Music, even a podcast app. No Spotify API, no login to
your music account.

**You get:** "listening to Mirrors — Justin Timberlake" while a song plays, and "last played … 12
min. ago" after.

**Why not the Spotify API?** It works only for Spotify, and it needs a login flow and a refresh
token on your server. The phone already knows what plays, in every app.

## How it works

```text
music app (phone)
  → Pano Scrobbler reads its media notification
  → sends "playing now", then the song when it counts as listened
  → ListenBrainz.org, or your own small server
  → your page asks for the newest song
```

[Pano Scrobbler](https://github.com/kawaiiDango/pano-scrobbler) is a free, open-source scrobbler.
Next to Last.fm, it sends to [ListenBrainz](https://listenbrainz.org), and to any server that
speaks the ListenBrainz API. That last part is the trick.

Pick one way:

- **A. No server** (about 10 minutes): send to ListenBrainz.org, and your page reads its public API.
  Works on any site, even a plain HTML page.
- **B. Your own server**: send to a tiny ListenBrainz-like server (a free Cloudflare Worker below).
  Nobody else keeps your listens. This is what my site does.

## A. No server: ListenBrainz.org

1. Make an account on [listenbrainz.org](https://listenbrainz.org). Copy your user token from
   [your settings](https://listenbrainz.org/settings/).
2. Install Pano Scrobbler (Play Store, F-Droid or GitHub) and allow notification access.
3. In Pano Scrobbler, add **ListenBrainz** and paste the token.
4. In its settings, allow only your music app, so videos and podcasts stay off your site.
5. Play a song. It shows on your ListenBrainz page in a few seconds.
6. Put this on your page. The API needs no token to read, and it allows requests from any site:

```html
<p id="music"></p>
<script type="module">
  const api = 'https://api.listenbrainz.org/1/user/YOUR_NAME'
  const line = document.getElementById('music')
  const get = async (path) => (await (await fetch(api + path)).json()).payload.listens[0]

  async function show() {
    const now = await get('/playing-now')
    if (now) {
      line.textContent = `listening to ${now.track_metadata.track_name} — ${now.track_metadata.artist_name}`
      return
    }
    const last = await get('/listens?count=1')
    if (last) line.textContent = `last played ${last.track_metadata.track_name} — ${last.track_metadata.artist_name}`
  }
  show()
  setInterval(show, 30_000)
</script>
```

Every 30 seconds is enough. The API sends its limits in `X-RateLimit-*` headers if you want to
check them.

## B. Your own server

A scrobbler needs only two calls from a ListenBrainz server:

- `GET /1/validate-token`: Pano checks the token once, when you add the service.
- `POST /1/submit-listens`: every song. The song is in `payload[0].track_metadata`, and
  `listen_type` says when:
  - `playing_now`: the song starts.
  - `single`: the song counts as listened (half of it, or 4 minutes).

This Cloudflare Worker is the whole server. Workers and KV are free for this.

```js
// A tiny ListenBrainz-compatible server. Pano Scrobbler sends songs here;
// your page reads GET /now. Needs a KV namespace (MUSIC) and a secret (SCROBBLE_TOKEN).
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    // Your page reads this, from any site.
    if (pathname === '/now') {
      const [playing, last] = await Promise.all([env.MUSIC.get('playing', 'json'), env.MUSIC.get('last', 'json')])
      const now = playing && playing.until > Date.now() ? playing : null
      return Response.json({ playing: now, last }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    // Pano sends "Authorization: Token <your token>".
    const token = request.headers.get('Authorization')?.replace(/^Token\s+/i, '')
    if (!env.SCROBBLE_TOKEN || token !== env.SCROBBLE_TOKEN) {
      return Response.json({ code: 401, error: 'Invalid token.' }, { status: 401 })
    }

    // Pano checks the token once, when you add the service.
    if (pathname === '/1/validate-token') {
      return Response.json({ code: 200, message: 'Token valid.', valid: true, user_name: 'me' })
    }

    if (pathname === '/1/submit-listens' && request.method === 'POST') {
      const { listen_type, payload } = await request.json()
      const listen = payload?.[0]
      const song = listen?.track_metadata
      if (!song) return Response.json({ code: 400, error: 'No song.' }, { status: 400 })
      const { track_name: track, artist_name: artist } = song
      if (listen_type === 'playing_now') {
        // A paused song sends nothing, so "playing" ends when the song would.
        const length = song.additional_info?.duration_ms ?? 10 * 60_000
        await env.MUSIC.put('playing', JSON.stringify({ track, artist, until: Date.now() + length }))
      } else {
        // "single": the song counts as listened (half of it, or 4 minutes).
        await env.MUSIC.put('last', JSON.stringify({ track, artist, at: (listen.listened_at ?? Date.now() / 1000) * 1000 }))
      }
      return Response.json({ status: 'ok' })
    }

    return new Response('Not found', { status: 404 })
  },
}
```

"Playing now" and "last played" are two keys, as in ListenBrainz. Pano sends the listen while the
song still plays, so one key would say "stopped" too early.

1. Make the Worker: `npm create cloudflare@latest`, then put the code above in its main file.
2. Add a KV namespace called `MUSIC` and bind it to the Worker (the dashboard, or
   `npx wrangler kv namespace create MUSIC`).
3. Make a token: any long random text, from a password manager. Add it as a **secret** named
   `SCROBBLE_TOKEN` (never in the code or Git), then deploy.
4. In Pano Scrobbler, add a **ListenBrainz-like instance**. API URL: your Worker's address
   with a `/` at the end (`https://music.you.workers.dev/`). Token: the same token.
5. On your page, read `/now` like in way A: show `playing` if it is there, else `last`.

## Tips

- **Android Auto** plays through the phone, so it works in the car too.
- **A leaked token** can only post songs to your card. To change it, set a new one in both places.
- **My version** ([worker/scrobble.ts](https://github.com/kishore280/home/blob/main/worker/scrobble.ts))
  also checks every field, compares the token in constant time, and keeps the two rows in D1.
