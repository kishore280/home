// All site content lives here. Everything below is example data: replace it with your own.

export const site = {
  name: 'Kishore',
  bio: 'Builds things for the web.',
  about:
    'I like small tools, fast pages, and clean type. Most of my time goes into side projects, long walks, and a camera I carry everywhere. This page updates itself, so come back later.',
  city: 'Chennai',
  timeZone: 'Asia/Kolkata',
  timeZoneLabel: 'IST',
  email: 'hello@example.com',
}

export const links = [
  { label: 'GitHub', href: 'https://github.com' },
  { label: 'X', href: 'https://x.com' },
  { label: 'LinkedIn', href: 'https://linkedin.com' },
]

export type Track = { title: string; artist: string; seconds: number }

// Shown when /api/now-playing has no live data (no Last.fm key, or local dev).
export const exampleTracks: Track[] = [
  { title: 'Nights', artist: 'Frank Ocean', seconds: 307 },
  { title: 'Midnight City', artist: 'M83', seconds: 243 },
  { title: 'Kids', artist: 'MGMT', seconds: 302 },
  { title: 'Innerbloom', artist: 'RÜFÜS DU SOL', seconds: 577 },
]

export const building = { project: 'home', message: 'add now playing', ago: '2h ago' }
export const reading = { title: 'The Pragmatic Programmer', detail: 'p. 142', progress: '41%' }

// Placeholder photos drawn with CSS gradients. Replace `src` with real image URLs.
export type Photo = { caption: string; src?: string; from: string; to: string }

export const photos: Photo[] = [
  { caption: 'Marina, 6:10am', from: '#122a4e', to: '#f4a261' },
  { caption: 'Rain on the 21G', from: '#28343a', to: '#7896a0' },
  { caption: 'Pondicherry', from: '#e6c8a0', to: '#286e96' },
  { caption: 'Late shift', from: '#14121e', to: '#d25a3c' },
  { caption: 'Kodai mist', from: '#bec8be', to: '#465a50' },
]

export const guestbookSeed = [
  { name: 'ananya', text: 'love the music bars' },
  { name: 'ravi', text: 'clean. what font is this?' },
  { name: 'sam', text: 'hi from berlin' },
]
