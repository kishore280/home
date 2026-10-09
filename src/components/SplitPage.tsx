import { useIsClient } from '../lib/client'
import { BackHome } from './BackHome'
import { Card } from './Card'
import { SplitOwner } from './SplitOwner'
import { SplitPay } from './SplitPay'

// /experiments/split. With ?s=<id> it is the pay page for that split; without, it is kish's page for
// making splits. Both depend on the visitor's browser (the link, the saved token), so the
// pre-rendered page is only the card, and the rest appears once the page is on the client.
export function SplitPage() {
  const isClient = useIsClient()
  const id = isClient ? new URLSearchParams(location.search).get('s') : null
  return (
    <main className="narrow-page split-page" id="main">
      <Card>
        <h1>split</h1>
        {!isClient ? <p className="small">Loading…</p> : id ? <SplitPay id={id} /> : <SplitOwner />}
      </Card>
      <BackHome />
    </main>
  )
}
