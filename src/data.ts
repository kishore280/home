// All site content lives here. Only real data: an empty value hides its part of the page.

export const site = {
  name: 'kishore',
  // The short name on the page and in page titles ("now · kish").
  nickname: 'kish',
  // Who the site is about, for search engines (JSON-LD Person) and IndieWeb tools (h-card).
  fullName: 'Kishore M',
  jobTitle: 'Software engineer',
  city: 'Chennai',
  country: 'IN',
  knowsAbout: ['AI agents', 'RAG', 'LLM applications', 'TypeScript', 'React', 'Cloudflare Workers'],
  // The public address of the site, no trailing slash. Used for canonical, sitemap and share cards.
  url: 'https://kichoow.com',
  // The browser tab and share cards: "kish". Search engines get the full name, job and city from the
  // description and the JSON-LD Person (seo.ts).
  title: 'kish',
  description:
    'Kishore M, a software engineer in Chennai who builds AI agents and RAG apps. Open to AI and agent developer roles, happy to relocate. Also: chai and beach runs.',
  // One sentence under "hi, i'm …".
  intro: 'hands-on with AI agents development.',
  // A few lines about you. Each string is one paragraph.
  about: [] as string[],
  // IANA time zone for the live clock.
  timeZone: 'Asia/Kolkata',
  email: '',
  // Public GitHub user for the live "building" row.
  github: 'kishore280',
  // Your status.cafe user name for the status card.
  statusCafe: '',
  // A public shared Google Photos album: its newest photos show in the photos card (worker/photos.ts).
  photosAlbum: 'https://photos.app.goo.gl/KDhFbCbEwc7fBAR17',
}

export const links: { label: string; href: string }[] = [
  { label: 'GitHub', href: 'https://github.com/kishore280' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kishooreee/' },
]

// Newest first, e.g. { date: '2026-10-01', text: 'Added a photos page.' }. Empty hides the card.
export const updates: { date: string; text: string }[] = []

// My 88×31 buttons: public/<file>.svg on this page, public/<file>.png in the embed code.
// `alt` is also the label that shows when you hover over the button.
export const myButtons: { file: string; alt: string }[] = [
  { file: 'button-kish', alt: 'hi, i’m kish' },
  { file: 'button', alt: 'kish is from the beach side' },
  { file: 'button-running', alt: 'kish loves running on the beach' },
  { file: 'button-badminton', alt: 'kish loves badminton' },
  { file: 'button-parotta', alt: 'kish loves parotta' },
  { file: 'button-himalayan', alt: 'kish rides a Himalayan' },
  { file: 'button-chai', alt: 'kish lives on tea' },
  { file: 'button-coding', alt: 'kish codes all day' },
]

// Blinkies (150×20) and stamps (99×56), small-web "ads" like the buttons. Their sources are in
// scripts/og/stamps/; npm run og turns the text into shapes (opentype.js) and writes
// public/<file>.svg and public/<file>.gif.
export const myStamps: { file: string; alt: string; width: number; height: number }[] = [
  { file: 'blinkie-my-agent', alt: 'my agent did it', width: 150, height: 20 },
  { file: 'blinkie-tokens', alt: 'out of tokens', width: 150, height: 20 },
  { file: 'blinkie-back', alt: 'MY BACK HURTS!!!!', width: 150, height: 20 },
  { file: 'blinkie-floor', alt: 'FUCK THIS, I AM SITTING ON THE FLOOR', width: 150, height: 20 },
  { file: 'blinkie-attention', alt: 'i feel violated by corporate invasion on my attention span', width: 150, height: 20 },
  { file: 'blinkie-gore', alt: 'I <3 GORE', width: 150, height: 20 },
  { file: 'blinkie-bite-me', alt: 'Bite me. :)', width: 150, height: 20 },
  { file: 'stamp-badminton', alt: 'badminton ate my knees', width: 99, height: 56 },
]

// The /offline page (⌘K → Offline only): `offline` shows only while the visitor is offline;
// `online` tells them how.
export const offlineNote = {
  title: 'offline only · kish',
  description: 'A note from kish that opens only when you are offline.',
  online: ['There is a note from kish here, but it opens only offline.', 'Turn on airplane mode ✈️, get a chai, and come back.'],
  offline: [
    'Wifi poyiduchu. Good 🍵',
    'No notifications, no tabs, no “one more link”. Just you, a glass of chai and the sound of the sea.',
    'This is kish’s favourite part of the day: chai in the evening, a walk on the beach, phone in the pocket.',
    'Stay a while. When you go back online, this note hides again.',
  ],
}

// Pages of short lists (TextPage.tsx): /now and /colophon, "slash pages" as the IndieWeb names them
// (slashpages.net). A link is optional; a relative one stays on this site.
export type TextPage = {
  title: string
  description: string
  heading: string
  intro: string
  updated?: string
  sections: { title: string; items: { text: string; href?: string }[] }[]
}

// /now: what kish is doing these days (the idea is Derek Sivers', nownownow.com). Update the date
// with the text.
export const nowPage: TextPage = {
  title: 'now · kish',
  description: 'What kish is doing now: trying AI and agents in small learning repos, and this site.',
  heading: 'now',
  intro: 'What I’m up to these days.',
  updated: '2026-09-28',
  sections: [
    {
      title: 'trying AI and agents',
      items: [
        { text: 'learning by building small repos, pinned on my GitHub', href: 'https://github.com/kishore280' },
        { text: 'research-agent', href: 'https://github.com/kishore280/research-agent' },
        { text: 'Grounded-RAG', href: 'https://github.com/kishore280/Grounded-RAG' },
        { text: 'Livegraph: a self-growing graph', href: 'https://github.com/kishore280/Livegraph' },
        { text: 'vazhi', href: 'https://github.com/kishore280/vazhi' },
      ],
    },
    {
      title: 'building',
      items: [{ text: 'this site: a cat that watches you, moving 88×31 buttons', href: '/colophon' }],
    },
    {
      title: 'life',
      items: [{ text: 'chai, parotta, beach runs, badminton and the Himalayan, counted live on the home page', href: '/' }],
    },
  ],
}

// /blog: the list of posts (the posts themselves are posts/*.md; how to write one: AGENTS.md).
export const blogPage = {
  title: 'writing · kish',
  description: 'Posts by Kishore M on building AI agents, RAG apps and this site with coding agents.',
  heading: 'writing',
}

// /colophon: how this site is made. Keep it true when the stack changes, and update the date with it
// (the sitemap uses it).
export const colophonPage: TextPage = {
  title: 'colophon · kish',
  description: 'How kichoow.com is made: React, Cloudflare Workers, hand-drawn SVG and free tiers.',
  heading: 'colophon',
  intro: 'How this site is made.',
  updated: '2026-10-02',
  sections: [
    {
      title: 'code',
      items: [
        { text: 'React 19, TypeScript 7 and Vite, pre-rendered to plain HTML', href: 'https://react.dev' },
        { text: 'built with coding agents (Claude Code), with the rules in AGENTS.md', href: 'https://github.com/kishore280/home' },
        { text: '⌘K menu: cmdk; photo viewer: Yet Another React Lightbox; my days: react-activity-calendar' },
        { text: 'the blog: Markdown files, turned into pages by MDX at build time, with an RSS feed', href: '/blog' },
        { text: 'terminal recordings: asciinema, real sessions played back as text (an idea from sofka.rs)', href: 'https://asciinema.org' },
        { text: 'kichoow.com/p: a paste bin on Workers KV, pastes expire (an idea from paste.rs)', href: 'https://paste.rs' },
      ],
    },
    {
      title: 'hosting',
      items: [
        { text: 'Cloudflare Workers with static assets, and a D1 database for counts, logs and songs', href: 'https://developers.cloudflare.com/workers/' },
        { text: 'works offline: a Workbox service worker, and a secret page that opens only offline', href: '/offline' },
        { text: 'costs ₹0: every service is on its free tier' },
      ],
    },
    {
      title: 'drawn by hand',
      items: [
        { text: 'the cat and the 88×31 buttons are hand-written SVG, animated with CSS (springs with linear())' },
        { text: 'buttons for your site: animated GIFs, listed in /.well-known/button.json', href: '/.well-known/button.json' },
        { text: 'fonts: Nunito and Pixelify Sans' },
      ],
    },
    {
      title: 'live data',
      items: [
        { text: 'now playing: my phone sends each song to a tiny ListenBrainz-style API', href: 'https://listenbrainz.org' },
        { text: 'chai, parotta, beach and badminton: logged from a small offline-ready app on my phone' },
        { text: 'my days: day totals from the D1 database, cached at the edge for a minute' },
        { text: 'photos and videos: straight from a shared Google Photos album, cached for an hour' },
        { text: 'GitHub: the repo I pushed to last, from the GitHub API' },
        { text: 'brain rot: Reels counted by my fork of Brainrot; the app and its brains are by ayush78490', href: 'https://github.com/ayush78490/brainRot' },
      ],
    },
    {
      title: 'kept honest',
      items: [
        { text: 'Playwright and axe-core tests on phone and desktop, a JavaScript budget, no layout shift' },
        { text: 'analytics without cookies: Umami and Cloudflare Web Analytics', href: 'https://umami.is' },
      ],
    },
  ],
}

// The 404 page, for addresses that do not exist.
// The private /log page, where kish logs chai, parotta and beach days (kept out of search).
export const logPage = {
  title: 'log · kish',
  description: 'Where kish logs chai, parotta and beach days.',
  heading: 'log',
}

export const notFound = {
  title: 'not found · kish',
  description: 'This page is not here.',
  heading: '404: lost at sea',
  text: 'This page is not here. Maybe the tide took it.',
}

// 88×31 buttons of friends and webrings: { name, href, img }.
export const friends: { name: string; href: string; img: string }[] = []
