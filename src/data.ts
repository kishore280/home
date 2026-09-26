// All site content lives here. Only real data: an empty value hides its part of the page.

export const site = {
  name: 'kishore',
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
]

// Newest first, e.g. { date: '2026-10-01', text: 'Added a photos page.' }. Empty hides the card.
export const updates: { date: string; text: string }[] = []

// My 88×31 buttons: public/<file>.svg on this page, public/<file>.png in the embed code.
export const myButtons: { file: string; alt: string }[] = [
  { file: 'button-kish', alt: 'kish' },
  { file: 'button', alt: 'kish is from the beach side' },
  { file: 'button-running', alt: 'kish runs on the beach' },
  { file: 'button-badminton', alt: 'kish plays badminton' },
  { file: 'button-parotta', alt: 'kish loves parotta' },
  { file: 'button-himalayan', alt: 'kish rides a Himalayan' },
  { file: 'button-chai', alt: 'kish runs on chai' },
]

// 88×31 buttons of friends and webrings: { name, href, img }.
export const friends: { name: string; href: string; img: string }[] = []
