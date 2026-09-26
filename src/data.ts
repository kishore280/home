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

// 88×31 buttons of friends and webrings: { name, href, img }.
export const friends: { name: string; href: string; img: string }[] = []
