// The rules of a split (/experiments/split), shared by the Worker (worker/split.ts, which checks
// everything) and the page (src/components/Split*.tsx, which gives quick feedback). One copy, so
// the page and the Worker cannot disagree about what a valid split is.
//
// Money is kept in paise (whole numbers), so 0.1 + 0.2 never turns up as 0.30000000000000004.

export const MAX_ITEMS = 20
// UPI's limit for one payment to a person is ₹1,00,000.
export const MAX_PAISE = 100_000 * 100
// A UPI ID (VPA): a name, "@", and the bank or app handle. The same shape the NPCI spec uses.
export const VPA = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/

export type SplitItem = { label: string; paise: number }
export type Split = { id: string; title: string; name: string; vpa: string; items: SplitItem[]; created: number }

// Visible text only: control characters become spaces, runs of spaces become one, and at most `max`
// characters (counted as letters, so an emoji is not cut in half).
export const clean = (text: string, max: number) =>
  Array.from(text.replace(/\p{C}/gu, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, max)
    .join('')

// "99", "99.5" or "99.50" → paise. Nothing else: no signs, no commas, no third decimal, never zero.
export function parseRupees(text: string): number | null {
  const m = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text.trim())
  if (!m) return null
  const paise = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return paise > 0 && paise <= MAX_PAISE ? paise : null
}

// ₹1,00,000 and ₹99.50 (Indian digit grouping; paise only when there are some).
export const money = (paise: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paise / 100)}`

export const total = (items: SplitItem[]) => items.reduce((sum, item) => sum + item.paise, 0)

const enc = encodeURIComponent

export type Payment = { vpa: string; name: string; paise: number; note: string }

// Ways to write the same payment, to find out which one a UPI app and a bank accept (the test mode
// of the pay page, "&lab=1"). 'full' is the normal link. The others change one thing:
//   tr        adds a transaction reference (the spec asks for one when a link has an amount)
//   spec      the same, and mode=04 (an intent): what NPCI's linking spec lists as required
//   bare      leaves out the note
//   personal  the fields a person's own QR code carries (mc=0000 is "no merchant")
//   open      leaves out the amount: the app opens and the payer types it
export const STYLES = {
  full: 'as it is now',
  tr: 'with a reference (tr)',
  spec: 'like the spec (tr, mode=04)',
  bare: 'without the note',
  personal: 'like a personal QR code',
  open: 'without the amount',
} as const
export type Style = keyof typeof STYLES

// The payment link every UPI app understands (NPCI "UPI Linking Specification"): pa and pn are
// required, cu is only INR, am has two decimals. Every value is URL-encoded, because an unencoded
// "&" or "#" in a name would silently cut off the rest. A space is %20, not "+". The "@" of the UPI
// ID stays as it is, as in the spec's own examples.
export function upiQuery({ vpa, name, paise, note }: Payment, style: Style = 'full', tr = '') {
  const parts = [`pa=${enc(vpa).replace('%40', '@')}`, `pn=${enc(name)}`]
  if (style !== 'open') parts.push(`am=${(paise / 100).toFixed(2)}`)
  parts.push('cu=INR')
  if (style === 'personal') parts.push('mc=0000', 'mode=02', 'purpose=00')
  if (style !== 'bare' && style !== 'open') parts.push(`tn=${enc(note)}`)
  if (style === 'tr' || style === 'spec') parts.push(`tr=${enc(tr)}`)
  if (style === 'spec') parts.push('mode=04')
  return parts.join('&')
}

export const upiLink = (payment: Payment, style: Style = 'full', tr = '') => `upi://pay?${upiQuery(payment, style, tr)}`

// An iPhone has no app chooser for upi://, so each app gets its own link: the same query after the
// app's own scheme. These come from the payment gateways' docs (Juspay, PayU) and differ a little
// between them, so each is a thing to check on a real iPhone.
export const IOS_APPS = [
  { name: 'Google Pay', scheme: 'tez://upi/pay' },
  { name: 'PhonePe', scheme: 'phonepe://pay' },
  { name: 'Paytm', scheme: 'paytmmp://pay' },
  { name: 'BHIM', scheme: 'bhim://upi/pay' },
] as const

// What to put in the UPI app's note: "Goa: bus, food" (at most 50 characters, the usual limit).
export const noteFor = (title: string, labels: string[]) => clean(`${title ? `${title}: ` : ''}${labels.join(', ')}`, 50)
