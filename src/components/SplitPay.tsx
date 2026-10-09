import { useState } from 'react'
import useSWR from 'swr'
import { encode } from 'uqr'
import { fetcher } from '../lib/api'
import { useCopy } from '../lib/copy'
import { qrPng } from '../lib/qr-png'
import { IOS_APPS, MAX_PAISE, STYLES, money, noteFor, parseRupees, upiLink, upiQuery, type Split, type Style } from '../lib/split'

// The pay side of /experiments/split: whoever opens a split's link sees who they pay, types their
// share of each item, and taps Pay. The UPI app opens with the amount filled in (the "upi://pay"
// link every UPI app understands; src/lib/split.ts). A web page cannot tell if the payment went
// through (UPI tells it nothing), so this page never says "paid".
type Platform = 'ios' | 'android' | 'desktop'

function platformOf(): Platform {
  const ua = navigator.userAgent
  // An iPad in "desktop" mode says it is a Mac, but a Mac has no touch screen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return /Android/.test(ua) ? 'android' : 'desktop'
}

// Browsers inside other apps (Instagram, Facebook, an Android WebView) often refuse to hand a link
// to another app. A link opened from WhatsApp opens in the real browser, so it is not on this list.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|MicroMessenger|; wv\)/

// The QR code of a payment, for a computer: scan it with any UPI app. Drawn from the code's squares
// (uqr), black on white with a quiet border, whatever the page's theme.
export function Qr({ text }: { text: string }) {
  const { data, size } = encode(text, { ecc: 'M', border: 2 })
  const path = data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join('')
  return (
    <svg className="split-qr" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label="QR code for this payment">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

// `lab` (the link ends with &lab=1) shows the test mode: the same payment in several link styles.
export function SplitPay({ id, lab }: { id: string; lab: boolean }) {
  const { data, error } = useSWR(`/api/split?s=${id}`, fetcher<Split>, { revalidateOnFocus: false })
  const [shares, setShares] = useState<Record<number, string>>({})
  const [platform] = useState(platformOf)
  const [inApp] = useState(() => IN_APP.test(navigator.userAgent))
  const [copied, copy] = useCopy()
  // A reference for the 'tr' style, new on each visit (a reused one can be refused).
  const [tr] = useState(() => `SPL${Math.random().toString(36).slice(2, 10).toUpperCase()}`)

  // Each share is a number up to its item's amount. Empty means "not this one".
  const items = data?.items ?? []
  const parts = items.map((item, i) => {
    const text = (shares[i] ?? '').trim()
    if (!text) return { paise: 0, bad: false }
    const paise = parseRupees(text)
    return { paise: paise ?? 0, bad: paise === null || paise > item.paise }
  })
  const paise = parts.reduce((sum, p) => sum + (p.bad ? 0 : p.paise), 0)
  const ready = Boolean(data) && !parts.some((p) => p.bad) && paise > 0 && paise <= MAX_PAISE
  const payment = data && ready ? { vpa: data.vpa, name: data.name, aid: data.aid, paise, note: noteFor(data.title, items.filter((_, i) => parts[i].paise > 0).map((item) => item.label)) } : null
  const link = payment && upiLink(payment)

  if (error) return <p role="alert">Could not load this split. Check your signal and open the link again.</p>
  if (data === null) return <p role="alert">This split is gone. Ask for a new link.</p>
  if (!data) return <p className="small">Loading…</p>

  const setShare = (i: number, text: string) => setShares((all) => ({ ...all, [i]: text }))

  return (
    <>
      <div className="split-payee">
        <span className="small">paying to</span>
        <b>{data.name}</b>
        {/* The UPI ID is plain to see, with a copy button: it is also how to pay by hand in any UPI app. */}
        <span className="split-id">
          <code>{data.vpa}</code>
          <button type="button" onClick={() => void copy(data.vpa)}>
            {copied === data.vpa ? 'copied' : 'copy UPI ID'}
          </button>
        </span>
      </div>

      <ul className="split-items">
        {data.items.map((item, i) => (
          <li key={`${i}-${item.label}`}>
            <input
              type="checkbox"
              aria-label={`Pay all of ${item.label}`}
              checked={parts[i].paise === item.paise && !parts[i].bad}
              // Half-ticked when only a part of the item is typed in; a tap then pays all of it.
              ref={(box) => {
                if (box) box.indeterminate = parts[i].paise > 0 && parts[i].paise < item.paise && !parts[i].bad
              }}
              onChange={(e) => setShare(i, e.target.checked ? String(item.paise / 100) : '')}
            />
            <span>
              {item.label}
              <small>total {money(item.paise)}</small>
            </span>
            <input
              className="split-share"
              aria-label={`Your share of ${item.label} in rupees`}
              aria-invalid={parts[i].bad}
              value={shares[i] ?? ''}
              onChange={(e) => setShare(i, e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              placeholder="your ₹"
            />
            {parts[i].bad ? <small className="split-bad">up to {money(item.paise)}, like 100 or 99.50</small> : null}
          </li>
        ))}
      </ul>

      <p className="split-total">
        <span>you pay</span> <b>{money(paise)}</b>
      </p>

      {inApp && platform !== 'desktop' ? (
        <p className="split-hint">This browser may not open your UPI app. Open this page in Chrome or Safari (the ⋮ or share menu), or pay by hand below.</p>
      ) : null}

      {!link ? (
        <button type="button" className="split-go" disabled>
          Pay
        </button>
      ) : platform === 'ios' ? (
        // An iPhone has no app chooser: one button per app, and the generic link for the rest.
        <div className="split-apps">
          {IOS_APPS.map((app) => (
            <a key={app.name} className="split-go" href={`${app.scheme}?${upiQuery(payment)}`} data-umami-event={`Split pay: ${app.name}`}>
              {app.name}
            </a>
          ))}
          <a className="split-other" href={link} data-umami-event="Split pay: other">
            other UPI app
          </a>
        </div>
      ) : platform === 'android' ? (
        <a className="split-go" href={link} data-umami-event="Split pay">
          Pay {money(paise)} with a UPI app
        </a>
      ) : null}

      {platform !== 'desktop' && link ? (
        // Google Pay refuses a payment that starts from a link in a web page, but accepts the same
        // payment read from a QR code (README, "Split"). So: one tap saves the QR as a picture (it is
        // not shown), and the payer scans it from the gallery in their UPI app.
        <div className="split-save">
          <button
            type="button"
            className="split-other"
            data-umami-event="Split pay: save QR"
            onClick={() => {
              const a = document.createElement('a')
              a.href = qrPng(link)
              a.download = `pay-${(paise / 100).toFixed(2)}.png`
              a.click()
            }}
          >
            Save QR picture
          </button>
          <p className="small">If the app refuses the button above: save this picture, open your UPI app, tap scan, and pick the picture from the gallery.</p>
        </div>
      ) : null}

      {platform === 'desktop' && link ? (
        <div className="split-desk">
          <Qr text={link} />
          <p className="small">On a computer: scan this with any UPI app on your phone, or open this page on your phone.</p>
        </div>
      ) : null}

      {lab && link && payment ? (
        <section className="split-lab" aria-label="Link styles to test">
          <h2>link styles (testing)</h2>
          <p className="small">Tap one, pay a small amount, and see which styles your bank accepts. A style that fails is a useful answer too.</p>
          <ul>
            {(Object.keys(STYLES) as Style[]).map((style) => {
              const styled = upiLink(payment, style, tr)
              return (
                <li key={style}>
                  <span className="split-lab-line">
                    <a href={styled} data-umami-event={`Split lab: ${style}`}>
                      {STYLES[style]}
                    </a>
                    <button type="button" aria-label={copied === styled ? 'Copied' : `Copy the link: ${STYLES[style]}`} onClick={() => void copy(styled)}>
                      {copied === styled ? 'copied' : 'copy'}
                    </button>
                  </span>
                  <code>{styled.slice('upi://pay?'.length)}</code>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <details className="split-hand">
        <summary>pay by hand</summary>
        {/* A link with an amount may be refused by a bank or app that cannot verify where it came from;
            typing the amount in the app works like a payment made by hand. */}
        <p className="small">
          If the payment does not work, open your UPI app with {data.name}’s UPI ID filled in, then type {ready ? money(paise) : 'your share'} there:
        </p>
        <a href={upiLink({ vpa: data.vpa, name: data.name, paise: 0, note: '' }, 'open')} data-umami-event="Split pay: no amount">
          open my UPI app (no amount)
        </a>
        <p className="small">
          Or send {ready ? money(paise) : 'your share'} to <code>{data.vpa}</code> in any UPI app (the copy button is above).
        </p>
      </details>

      <p className="small">Check that this UPI ID belongs to the person who sent you the link. This page cannot tell if you paid.</p>
    </>
  )
}
