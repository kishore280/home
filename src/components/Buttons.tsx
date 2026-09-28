import { toast } from '../lib/toast'
import { trackHover } from '../lib/track'
import { friends, myButtons } from '../data'
import { Card } from './Card'

// Other sites get the animated GIF (npm run og makes it), the classic 88×31 format every site and
// forum takes; this page shows the sharper SVG, which moves by itself. The old PNGs stay for the sites
// that already use them.
const embed = (file: string, alt: string) =>
  `<a href="${location.origin}"><img src="${location.origin}/${file}.gif" width="88" height="31" alt="${alt}"></a>`

async function copyEmbed(file: string, alt: string) {
  try {
    await navigator.clipboard.writeText(embed(file, alt))
    toast('Button code copied. Paste it on your site ♡')
  } catch {
    toast('Copy failed. Right-click the button and copy the image address.', { error: true })
  }
}

export function Buttons() {
  return (
    <Card title="buttons">
      <div className="buttons">
        {myButtons.map((b) => (
          <button
            key={b.file}
            type="button"
            className="b88"
            data-caption={b.alt}
            // The label is in the event name, so the Umami activity feed shows which button.
            data-umami-event={`Button copy: ${b.alt}`}
            data-umami-event-button={b.file}
            onClick={() => copyEmbed(b.file, b.alt)}
            onPointerMove={trackHover(`Button hover: ${b.alt}`)}
          >
            <img src={`/${b.file}.svg`} width={88} height={31} alt={b.alt} loading="lazy" decoding="async" />
          </button>
        ))}
        {friends.map((f) => (
          <a key={f.href} className="b88" data-caption={f.name} href={f.href} target="_blank" rel="noreferrer" data-umami-event={`Friend button: ${f.name}`}>
            <img src={f.img} width={88} height={31} alt={f.name} loading="lazy" />
          </a>
        ))}
      </div>
      <p className="small">Click a button to copy its code, and put it on your site.</p>
    </Card>
  )
}
