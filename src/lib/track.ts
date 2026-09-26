// Umami custom events (the script is in index.html). Does nothing when an ad blocker stops it.
export const track = (event: string, data?: Record<string, string>) => window.umami?.track(event, data)

// Once per page view, for events that fire often (hovers), so the counts stay useful.
const seen = new Set<string>()
export function trackOnce(event: string) {
  if (seen.has(event)) return
  seen.add(event)
  track(event)
}

// A hover counts only when the mouse really moves over the element. 'pointerenter' also fires
// when something under a still mouse changes (a menu closes), which is not a hover.
export const trackHover = (event: string) => (e: { pointerType: string }) => {
  if (e.pointerType === 'mouse') trackOnce(event)
}
