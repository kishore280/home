export type Activity = { repo: string; url: string; message: string | null; at: string }

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export function Building({ activity }: { activity: Activity }) {
  return (
    <div className="row">
      <div className="row-key">
        <span className="dot" aria-hidden="true" />
        building
      </div>
      <div className="row-value">
        <a href={activity.url} target="_blank" rel="noopener noreferrer" className="plain">
          {activity.repo}
        </a>
        {activity.message && <span className="muted"> — “{activity.message}”</span>}
      </div>
      <div className="row-meta">{ago(activity.at)}</div>
    </div>
  )
}
