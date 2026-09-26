// Cloudflare Worker: serves the built site from dist/ and answers /api/* routes.
import { counters } from './counters'
import { fail, type Env } from './db'
import { github } from './github'
import { nowPlaying } from './now-playing'

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    switch (pathname) {
      case '/api/now-playing':
        return nowPlaying(env)
      case '/api/github':
        return github(request)
      case '/api/counters':
        return counters(request, env)
    }
    if (pathname.startsWith('/api/')) return fail('Not found.', 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
