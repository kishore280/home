// Cloudflare Worker: serves the built site from dist/ and answers /api/* routes.
import { counters } from './counters'
import { fail, type Env } from './db'
import { github } from './github'
import { log, undo } from './log'
import { nowPlaying } from './now-playing'
import { scrobble } from './scrobble'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    switch (pathname) {
      case '/api/now-playing':
        return nowPlaying(env)
      case '/api/github':
        return github()
      case '/api/counters':
        return counters(request, env)
      case '/api/log':
        return log(request, env)
      case '/api/log/undo':
        return undo(request, env)
    }
    if (pathname.startsWith('/api/scrobble/1/')) return scrobble(request, env, pathname.slice('/api/scrobble/1/'.length))
    if (pathname.startsWith('/api/')) return fail('Not found.', 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
