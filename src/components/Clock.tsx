import { useEffect, useState } from 'react'
import { site } from '../data'

const format = (d: Date) =>
  d.toLocaleTimeString('en-GB', { timeZone: site.timeZone, hour12: false })

export function Clock() {
  const [now, setNow] = useState(() => format(new Date()))

  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date())), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="clock">
      <span className="clock-time">{now}</span> {site.timeZoneLabel}
      <br />
      {site.city}
    </div>
  )
}
