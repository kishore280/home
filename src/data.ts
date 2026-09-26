// All site content lives here. Only real data: a section with no data is hidden.

export const site = {
  name: 'kishore280',
  bio: '',
  about: '',
  // IANA time zone and city for the live clock, e.g. 'Asia/Kolkata' and 'Chennai'.
  timeZone: '',
  city: '',
  email: '',
  // Public GitHub user for the live "building" row.
  github: 'kishore280',
}

export const links = [{ label: 'GitHub', href: 'https://github.com/kishore280' }]

// Add real photos here, e.g. { caption: 'Marina, 6am', src: '/photos/marina.jpg' }
export type Photo = { caption: string; src: string }

export const photos: Photo[] = []
