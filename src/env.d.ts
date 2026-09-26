declare const __BUILD_DATE__: string

// Umami Cloud (index.html). Missing when an ad blocker stops the script.
interface Window {
  umami?: { track: (event: string, data?: Record<string, string>) => void }
}
