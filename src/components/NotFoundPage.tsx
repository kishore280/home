import { notFound } from '../data'
import { BackHome } from './BackHome'
import { Card } from './Card'

// Shown with status 404 for addresses that do not exist (wrangler.jsonc: not_found_handling).
export function NotFoundPage() {
  return (
    <main className="narrow-page" id="main">
      <Card>
        <h1>{notFound.heading}</h1>
        <p>{notFound.text}</p>
      </Card>
      <BackHome />
    </main>
  )
}
