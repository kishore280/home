import type { Counters } from '../lib/api'
import { shortDate } from '../lib/time'
import { Card } from './Card'

export function Stats({ counters }: { counters: Counters | null }) {
  return (
    <Card title="stats">
      <dl className="stats">
        <dt>updated</dt>
        <dd>
          <time dateTime={__BUILD_DATE__}>{shortDate(__BUILD_DATE__)}</time>
        </dd>
        {counters ? (
          <>
            <dt>views</dt>
            <dd>{counters.views.toLocaleString()}</dd>
          </>
        ) : null}
      </dl>
    </Card>
  )
}
