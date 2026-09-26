import { toast } from 'sonner'
import { friends, site } from '../data'
import { Card } from './Card'

// Other sites get the PNG (works everywhere); this page shows the sharper SVG.
const embed = () =>
  `<a href="${location.origin}"><img src="${location.origin}/button.png" width="88" height="31" alt="${site.name}"></a>`

async function copyEmbed() {
  try {
    await navigator.clipboard.writeText(embed())
    toast('Button code copied. Paste it on your site ♡')
  } catch {
    toast.error('Could not copy. Your browser blocked the clipboard.')
  }
}

export function Buttons() {
  return (
    <Card title="buttons">
      <div className="buttons">
        <button type="button" className="b88" onClick={copyEmbed} title="Copy the code for my button">
          <img src="/button.svg" width={88} height={31} alt={`${site.name}'s button`} />
        </button>
        {friends.map((f) => (
          <a key={f.href} className="b88" href={f.href} target="_blank" rel="noreferrer">
            <img src={f.img} width={88} height={31} alt={f.name} loading="lazy" />
          </a>
        ))}
      </div>
      <p className="small">Click my button to copy its code, and put it on your site.</p>
    </Card>
  )
}
