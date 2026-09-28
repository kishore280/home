import { toast } from '../lib/toast'
import { trackHover } from '../lib/track'
import { friends, myButtons, myStamps } from '../data'
import { Card } from './Card'

// Other sites get the animated GIF (npm run og makes it), the classic format every site and forum
// takes; this page shows the sharper SVG, which moves by itself. The old button PNGs stay for the
// sites that already use them.
const embed = (file: string, alt: string, width: number, height: number) =>
  `<a href="${location.origin}"><img src="${location.origin}/${file}.gif" width="${width}" height="${height}" alt="${alt}"></a>`

async function copyEmbed(file: string, alt: string, width: number, height: number) {
  try {
    await navigator.clipboard.writeText(embed(file, alt, width, height))
    toast('Code copied. Paste it on your site ♡')
  } catch {
    toast('Copy failed. Right-click it and copy the image address.', { error: true })
  }
}

// One button, blinkie or stamp: a click copies its code. The label is in the event name, so the
// Umami activity feed shows which one.
function Badge({ file, alt, width, height, kind, className }: { file: string; alt: string; width: number; height: number; kind: string; className: string }) {
  return (
    <button
      type="button"
      className={className}
      data-caption={alt}
      data-umami-event={`${kind} copy: ${alt}`}
      data-umami-event-button={file}
      onClick={() => copyEmbed(file, alt, width, height)}
      onPointerMove={trackHover(`${kind} hover: ${alt}`)}
    >
      <img src={`/${file}.svg`} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
    </button>
  )
}

export function Buttons() {
  return (
    <Card title="buttons">
      <div className="buttons">
        {myButtons.map((b) => (
          <Badge key={b.file} {...b} width={88} height={31} kind="Button" className="b88 badge" />
        ))}
        {friends.map((f) => (
          <a key={f.href} className="b88 badge" data-caption={f.name} href={f.href} target="_blank" rel="noreferrer" data-umami-event={`Friend button: ${f.name}`}>
            <img src={f.img} width={88} height={31} alt={f.name} loading="lazy" />
          </a>
        ))}
      </div>
      <p className="small">Click a button to copy its code, and put it on your site. Linking the image from here is fine.</p>
    </Card>
  )
}

// Blinkies and stamps: the same, in their own sizes.
export function Stamps() {
  if (!myStamps.length) return null
  return (
    <Card title="blinkies & stamps">
      {/* Blinkies in one group and stamps in another, so the two sizes never mix in a row. */}
      {[myStamps.filter((s) => s.height < 31), myStamps.filter((s) => s.height >= 31)].map((group) =>
        group.length ? (
          <div key={group[0].file} className="buttons stamps">
            {group.map((s) => (
              <Badge key={s.file} {...s} kind="Stamp" className="badge" />
            ))}
          </div>
        ) : null,
      )}
      <p className="small">Click one to copy its code, too.</p>
    </Card>
  )
}
