import { toast } from '../lib/toast'
import { friends, myButtons } from '../data'
import { Card } from './Card'

// Other sites get the PNG (works everywhere); this page shows the sharper SVG.
const embed = (file: string, alt: string) =>
  `<a href="${location.origin}"><img src="${location.origin}/${file}.png" width="88" height="31" alt="${alt}"></a>`

async function copyEmbed(file: string, alt: string) {
  try {
    await navigator.clipboard.writeText(embed(file, alt))
    toast('Button code copied. Paste it on your site ♡')
  } catch {
    toast('Copy failed. Right-click the button and copy the image address.', true)
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
            data-umami-event="Button copy"
            data-umami-event-button={b.file}
            onClick={() => copyEmbed(b.file, b.alt)}
          >
            <img src={`/${b.file}.svg`} width={88} height={31} alt={b.alt} loading="lazy" decoding="async" />
          </button>
        ))}
        {friends.map((f) => (
          <a key={f.href} className="b88" data-caption={f.name} href={f.href} target="_blank" rel="noreferrer" data-umami-event="Friend button" data-umami-event-name={f.name}>
            <img src={f.img} width={88} height={31} alt={f.name} loading="lazy" />
          </a>
        ))}
      </div>
      <p className="small">Click a button to copy its code, and put it on your site.</p>
    </Card>
  )
}
