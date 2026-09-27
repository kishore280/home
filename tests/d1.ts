import { execSync } from 'node:child_process'

// A wrangler command on the local D1. The test server has the same database file open, so SQLite
// can answer SQLITE_BUSY ("the database file is locked"); its docs say to try again, so we do.
export function wrangler(args: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return execSync(`npx wrangler d1 execute home --local ${args}`, { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      const out = `${(error as { stdout?: string }).stdout}${(error as { stderr?: string }).stderr}`
      if (attempt === 5 || !out.includes('SQLITE_BUSY')) throw error
      execSync('sleep 0.5')
    }
  }
}
