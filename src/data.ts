// All site content lives here. Only real data: an empty value hides its part of the page.

export const site = {
  name: 'kishore',
  // The public address of the site, no trailing slash. Used for canonical, sitemap and share cards.
  url: 'https://kichoow.com',
  // Search results and share cards. Only real facts about kish.
  title: 'Kishore (kish)',
  description:
    'Kishore’s corner of the internet: code, badminton, beach runs, chai, parotta and a Himalayan, from beach-side South India.',
  // One sentence under "hi, i'm …".
  intro: '',
  // A few lines about you. Each string is one paragraph.
  about: [] as string[],
  // IANA time zone for the live clock.
  timeZone: 'Asia/Kolkata',
  email: '',
  // Public GitHub user for the live "building" row.
  github: 'kishore280',
  // Your status.cafe user name for the status card.
  statusCafe: '',
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

// The /offline page (⌘K → Offline only): `offline` shows only while the visitor is offline;
// `online` tells them how.
export const offlineNote = {
  title: 'offline only · kish',
  description: 'A note from kish that opens only when you are offline.',
  online: ['There is a note from kish here, but it opens only offline.', 'Turn on airplane mode ✈️, get a chai, and come back.'],
  // Shown under `online` while the page is saved for offline use, then when it is ready.
  saving: 'Saving this page on your device…',
  ready: '✓ Saved on this device. You can go offline now.',
  offline: [
    'Wifi poyiduchu. Good 🍵',
    'No notifications, no tabs, no “one more link”. Just you, a glass of chai and the sound of the sea.',
    'This is kish’s favourite part of the day: chai in the evening, a walk on the beach, phone in the pocket.',
    'Stay a while. When you go back online, this note hides again.',
  ],
}

// The 404 page, for addresses that do not exist.
export const notFound = {
  title: 'not found · kish',
  description: 'This page is not here.',
  heading: '404: lost at sea',
  text: 'This page is not here. Maybe the tide took it.',
}

// 88×31 buttons of friends and webrings: { name, href, img }.
export const friends: { name: string; href: string; img: string }[] = []
