// All site content lives here. Only real data: an empty value hides its part of the page.

export const site = {
  name: 'kishore',
  // One sentence under "hi, i'm …".
  intro: '',
  // A few lines about you. Each string is one paragraph.
  about: [] as string[],
  // IANA time zone and city for the live clock, e.g. 'Asia/Kolkata' and 'Chennai'.
  timeZone: '',
  city: '',
  email: '',
  // Public GitHub user for the live "building" row.
  github: 'kishore280',
  // Your status.cafe user name for the status card.
  statusCafe: '',
}

export const links: { label: string; href: string }[] = [
  { label: 'GitHub', href: 'https://github.com/kishore280' },
]

// Newest first.
export const updates: { date: string; text: string }[] = [
  { date: '2026-09-26', text: 'New soft lavender look, with a mascot and a guestbook.' },
  { date: '2026-09-25', text: 'Site started. React, on Cloudflare Pages.' },
]

// 88×31 buttons of friends and webrings: { name, href, img }.
export const friends: { name: string; href: string; img: string }[] = []
