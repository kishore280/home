declare const __BUILD_DATE__: string
declare const __POSTS__: import('./lib/posts').Post[]

// Umami Cloud (index.html). Missing when an ad blocker stops the script.
interface Window {
  umami?: { track: (event: string, data?: Record<string, string>) => Promise<unknown> }
}
