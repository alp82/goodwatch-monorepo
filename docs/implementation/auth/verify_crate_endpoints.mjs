// Run inside each actual page/search container. Passwords remain in its environment.
// CRATE_VERIFY_HOSTS optionally selects only the node just enabled; CRATE_VERIFY_MODE=credentials
// checks supplied identity before HBA. Default checks enforcement (missing/wrong credentials refused).
import { randomBytes } from 'node:crypto'
const env = process.env
const hosts = (env.CRATE_VERIFY_HOSTS || env.CRATE_HOSTS || '').split(',').filter(Boolean)
if (!hosts.length || !env.CRATE_USER || !env.CRATE_PASS) {
  console.error('Missing CRATE_HOSTS, CRATE_USER or CRATE_PASS')
  process.exit(2)
}
let passed = true
for (const host of hosts) {
  let url
  try { url = new URL(host.includes('://') ? host.trim() : `http://${host.trim()}`) }
  catch { console.error('Invalid coordinator URL'); process.exit(2) }
  if (url.protocol !== 'http:' || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    console.error('Invalid coordinator: use an HTTP host without credentials or a path.')
    process.exit(2)
  }
  url.port ||= env.CRATE_PORT || '4200'
  url.pathname = '/_sql'
  const wrong = `wrong-${randomBytes(16).toString('hex')}`
  const cases = env.CRATE_VERIFY_MODE === 'credentials'
    ? [['supplied', env.CRATE_USER, env.CRATE_PASS, env.CRATE_USER]]
    : [['missing', null, null, 'HTTP 401'], ['crate wrong', 'crate', wrong, 'HTTP 401'],
       ['client wrong', env.CRATE_USER, wrong, 'HTTP 401'], ['supplied', env.CRATE_USER, env.CRATE_PASS, env.CRATE_USER]]
  for (const [label, user, password, expected] of cases) {
    let actual
    try {
      const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` } : {}) },
        body: JSON.stringify({ stmt: 'SELECT current_user' }) })
      actual = response.ok ? (await response.json()).rows?.[0]?.[0] : `HTTP ${response.status}`
    } catch { actual = 'unreachable or invalid response' }
    const ok = actual === expected
    passed &&= ok
    console.log(JSON.stringify({ host: url.host, case: label, ok, actual }))
  }
}
process.exitCode = passed ? 0 : 1
