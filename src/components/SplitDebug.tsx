import { useEffect, useMemo, useState } from 'react'
import { useCopy } from '../lib/copy'
import { qrPng } from '../lib/qr-png'
import { Qr } from './SplitPay'

// A test page for one payment link (/experiments/split?u=<the link, URL-encoded>): the same text sent
// to the UPI app in every way a web page can, with a log of what the page saw. It exists because
// Google Pay refuses links from a page that it accepts from its own QR scanner (README, "Split").
// Not linked from anywhere; the link is typed or pasted by kish.
const GPAY = 'com.google.android.apps.nbu.paisa.user'

export function SplitDebug({ text }: { text: string }) {
  const [log, setLog] = useState<string[]>(() => [`0.0s opened. ${navigator.userAgent}`, `referrer: ${document.referrer || '(none)'}`])
  const [copied, copy] = useCopy()
  const valid = text.startsWith('upi://pay?')
  const png = useMemo(() => (valid ? qrPng(text) : ''), [text, valid])
  const rest = text.slice('upi://'.length)
  const query = text.slice('upi://pay'.length)

  const note = (line: string) => setLog((all) => [...all, `${(performance.now() / 1000).toFixed(1)}s ${line}`])
  useEffect(() => {
    const seen = (e: Event) => note(`${e.type}${e.type === 'visibilitychange' ? ` → ${document.visibilityState}` : ''}`)
    document.addEventListener('visibilitychange', seen)
    window.addEventListener('pagehide', seen)
    window.addEventListener('blur', seen)
    window.addEventListener('focus', seen)
    return () => {
      document.removeEventListener('visibilitychange', seen)
      window.removeEventListener('pagehide', seen)
      window.removeEventListener('blur', seen)
      window.removeEventListener('focus', seen)
    }
  }, [])

  if (!valid) return <p className="split-problem" role="alert">The link must start with upi://pay?</p>

  const tap = (name: string) => {
    note(`TAP ${name}`)
    setTimeout(() => note(`${name}: 3 s later, page is ${document.visibilityState}`), 3000)
  }
  const ways = [
    ['1. plain link (upi://)', text],
    ['2. intent, any app', `intent://${rest}#Intent;scheme=upi;end`],
    ['3. intent, Google Pay only', `intent://${rest}#Intent;scheme=upi;package=${GPAY};end`],
    ['4. tez:// (Google Pay)', `tez://upi/pay${query}`],
    ['5. gpay://', `gpay://upi/pay${query}`],
  ] as const
  const report = log.join('\n')

  return (
    <>
      <p className="small">Same payment, sent in different ways. Tap one, then copy the log and send it.</p>
      <code className="split-lab-line">{text}</code>
      <ul className="split-lab">
        {ways.map(([name, href]) => (
          <li key={name}>
            <a href={href} onClick={() => tap(name)}>
              {name}
            </a>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => { tap('6. location.href'); location.href = text }}>
            6. location.href = link
          </button>
        </li>
      </ul>
      <h2>7. the QR picture</h2>
      <p className="small">Scan it from another phone. Or press and hold it, save it, then in Google Pay choose scan, and pick it from the gallery.</p>
      <Qr text={text} />
      {png ? (
        <p>
          <a href={png} download="pay-qr.png" onClick={() => tap('7. save QR')}>
            save the QR as a picture
          </a>
        </p>
      ) : null}
      <h2>log</h2>
      <pre className="split-lab-line" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report}</pre>
      <button type="button" onClick={() => void copy(report)}>
        {copied === report ? 'copied' : 'copy the log'}
      </button>
    </>
  )
}
