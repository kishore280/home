import useSWR from 'swr'
import { fetcher, type Status as StatusData } from '../lib/api'
import { Card } from './Card'

// status.cafe allows cross-origin reads, so the browser fetches it directly.
export function Status({ user }: { user: string }) {
  const { data } = useSWR(`https://status.cafe/users/${user}/status.json`, fetcher<StatusData>, {
    refreshInterval: 300_000,
  })
  if (!data?.content) return null

  return (
    <Card title="status">
      <div className="status">
        <span className="status-face" aria-hidden="true">
          {data.face}
        </span>
        <div>
          <p>{data.content}</p>
          <a className="small" href={`https://status.cafe/users/${user}`} target="_blank" rel="noreferrer">
            {data.timeAgo} · status.cafe
          </a>
        </div>
      </div>
    </Card>
  )
}
