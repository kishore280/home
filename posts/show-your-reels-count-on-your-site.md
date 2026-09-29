---
title: How to show your Instagram Reels count on your site
description: A small Android app counts the Reels you swipe through and tells your site while you scroll. What it sends, a free server to receive it, and how to show "brain rotting · 36 reels today".
date: '2026-09-29'
tags: [android, instagram, cloudflare]
---

My home page has a row that says "brain rotting · 36 reels today" while I scroll, and "last rot ·
3 min. ago" after. It keeps me honest. Mostly.

**You need:** an Android phone with Instagram, and a website that can take a small POST request
(a free Cloudflare Worker below does it).

**You get:** today's Reels count, whether you are scrolling right now, and each binge ("12 reels in
4 min").

**What it cannot do:** Instagram has no API for this, and Digital Wellbeing gives only minutes, not
Reels. So the count comes from the phone. iPhones can't: iOS never lets one app see another.
Green bubbles win this one.

## How it works

```text
Instagram Reels (phone)
  → Brainrot counts each reel you land on
  → "scrolling" when Reels opens, the count every 30 s, "stopped" when you leave
  → POST to your site, with your token
  → your page shows today's count
```

[Brainrot](https://github.com/ayush78490/brainRot) is an open-source Android app by ayush78490.
It uses an accessibility service to see which list scrolled and where it stopped. It never reads
captions, names or messages. [My fork](https://github.com/kishore280/brainRot) adds the part that
tells your site, a quiet notification and signed releases.

## 1. Install the app

1. Download the newest APK from the fork's
   [Releases](https://github.com/kishore280/brainRot/releases) page and open it. Android asks to
   allow installs from your browser once.
2. Open Brainrot and turn on its accessibility service when it asks. Android shows a strong warning
   for every accessibility app; the source is public if you want to read it first.
3. Swipe a few Reels. The Today screen counts them.

## 2. Receive the reports

Each report is one POST with `Authorization: Bearer <your token>` and a small JSON body:

```json
{
  "app": "instagram",
  "scrolling": true,
  "reels": 12,
  "today": 40,
  "minutes": 6,
  "perReel": 9,
  "started": 1790674261000,
  "ended": null
}
```

`reels` is this sitting; `today`, `minutes` and `perReel` are today so far. `started` and `ended`
are times in milliseconds. When you stop, `scrolling` is `false` and `ended` has the time.

This Cloudflare Worker receives them and gives your page the latest one:

```js
// Receives the Brainrot app's reports; your page reads GET /scroll.
// Needs a KV namespace (SCROLL) and a secret (SCROLL_TOKEN).
const FRESH = 3 * 60_000 // no heartbeat for 3 minutes: the phone went quiet

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    const cors = { 'Access-Control-Allow-Origin': '*' }

    if (pathname === '/scroll' && request.method === 'GET') {
      const last = await env.SCROLL.get('last', 'json')
      if (!last) return Response.json(null, { headers: cors })
      // A lost "stopped" (no signal, battery) must not leave you scrolling forever.
      const scrolling = last.scrolling && Date.now() - last.at < FRESH
      return Response.json({ ...last, scrolling }, { headers: cors })
    }

    if (pathname === '/scroll' && request.method === 'POST') {
      if (!env.SCROLL_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.SCROLL_TOKEN}`) {
        return new Response('Invalid token.', { status: 401 })
      }
      const r = await request.json()
      if (typeof r.scrolling !== 'boolean' || !Number.isInteger(r.reels) || !Number.isInteger(r.started)) {
        return new Response('Send scrolling, reels and started.', { status: 400 })
      }
      const next = { scrolling: r.scrolling, reels: r.reels, today: r.today ?? r.reels, started: r.started, at: Date.now() }
      // KV's free plan allows 1,000 writes a day and a heartbeat comes every 30 s:
      // write only when something changed, or every 90 s to stay fresh.
      const last = await env.SCROLL.get('last', 'json')
      const same = last && last.scrolling === next.scrolling && last.today === next.today && last.started === next.started
      if (!same || next.at - last.at > 90_000) await env.SCROLL.put('last', JSON.stringify(next))
      return Response.json({ status: 'ok' })
    }

    return new Response('Not found', { status: 404 })
  },
}
```

Two things matter more than they look:

- **The phone can go quiet** without saying "stopped": no signal, a dead battery, the app killed.
  So "scrolling" is true only while the last heartbeat is under 3 minutes old.
- **Heartbeats add up.** Every 30 seconds is 120 an hour. The Worker writes only when the count
  changed or the last write is 90 seconds old. My own version keeps the live row and each finished
  binge in D1 (100,000 free writes a day): [worker/scroll.ts](https://github.com/kishore280/home/blob/main/worker/scroll.ts).

To set it up:

1. Make a Worker with `npm create cloudflare@latest` and put the code above in its main file.
2. Add a KV namespace and bind it as `SCROLL`.
3. Make a long random token and add it as the **secret** `SCROLL_TOKEN`. Never put it in the code
   or Git.

## 3. Connect the phone

On Brainrot's Today screen, set **Your site**: the address (`https://reels.you.workers.dev/scroll`)
and the same token. Save. Leave the token empty and nothing leaves the phone.

Open Reels. Within 30 seconds, `GET /scroll` says `"scrolling": true`.

## 4. Show it

```html
<p id="reels"></p>
<script type="module">
  const line = document.getElementById('reels')
  async function show() {
    const s = await (await fetch('https://reels.you.workers.dev/scroll')).json()
    if (!s) return
    const ago = Math.round((Date.now() - s.at) / 60_000)
    line.textContent = s.scrolling ? `brain rotting · ${s.today} reels today` : `last rot · ${s.today} reels today · ${ago} min. ago`
  }
  show()
  setInterval(show, 30_000)
</script>
```

`today` is from the phone's own day, so it goes back to 0 at your midnight. The next morning, it
still says yesterday's number until you scroll. Check the date of `at` before you show it.

## Privacy

Only numbers and times leave the phone: no captions, no accounts, no screenshots. The count is
public on your site, which is the point, so show it only if you are fine with that. Friends will
ask.
