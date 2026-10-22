/** Local-only release rehearsal. Creates/cleans only its unique Compose project. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes, createHash, X509Certificate } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { createServer, createConnection } from 'node:net'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { paths } from '@goodwatch/yepwatch-contracts/proposal'
import { proposalProjection } from '../src/proposal-projection.ts'
import { connect, until, sleep } from '../test/client.ts'

const exec = promisify(execFile), require = createRequire(import.meta.url)
const { chromium, expect } = require('../../yepwatch-app/node_modules/@playwright/test')
const release = resolve('release'), args = new Map()
for (let n = 2; n < process.argv.length; n += 2) args.set(process.argv[n], process.argv[n + 1])
assert(args.has('--catalog-env'), 'Explicit backend-owned private catalog env required')
assert(args.has('--api-image'), 'Explicit reviewed API image required; superseded r1/r2 must stay paused')
const resultName = args.get('--result')
assert(typeof resultName === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.json$/.test(resultName), 'Explicit new --result JSON filename under artifacts required')
const resultPath = resolve('artifacts', resultName), screenshotName = `${resultName.slice(0, -5)}-browser-done.png`
const screenshotPath = resolve('artifacts', screenshotName)
for (const path of [resultPath, screenshotPath]) {
  try { await access(path); throw new Error('Refusing to overwrite existing rehearsal evidence') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
const expectedIndex = args.get('--expected-index-sha256'), expectedApk = args.get('--expected-apk-sha256')
const apkName = args.get('--apk-filename')
assert(/^[a-f0-9]{64}$/.test(expectedIndex ?? ''), 'Explicit --expected-index-sha256 required')
assert(/^[a-f0-9]{64}$/.test(expectedApk ?? ''), 'Explicit --expected-apk-sha256 required')
assert(/^yepwatch-preview-r[1-9][0-9]*\.apk$/.test(apkName ?? ''), 'Explicit versioned --apk-filename required')
const rateCompatibility = args.get('--rate-compatibility') === '1'
assert(!args.has('--rate-compatibility') || rateCompatibility, 'Use --rate-compatibility 1 only for a separate disposable phase')
const controls = {
  YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS: '20', YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE: '20',
  YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE: '600', YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE: rateCompatibility ? '1' : '60',
}
const metadata = {
  YEPWATCH_SOURCE_COMMIT: args.get('--source-commit') ?? 'local-release-rehearsal',
  YEPWATCH_FRONT_IMAGE: args.get('--front-image') ?? 'yepwatch-front:release-r3-20261022',
  YEPWATCH_API_IMAGE: args.get('--api-image'),
  YEPWATCH_GATEWAY_IMAGE: args.get('--gateway-image') ?? 'yepwatch-gateway:release-r3-20261022',
}
const name = `yw-release-${process.pid}-${randomBytes(3).toString('hex')}`
const work = await mkdtemp('/tmp/yepwatch-release-rehearsal-'), secrets = join(work, 'secrets')
await mkdir(secrets, { mode: 0o700 })
const secret = async (name, value) => { const path = join(secrets, name); await writeFile(path, value, { mode: 0o400 }); return path }
const nonce = () => randomBytes(32).toString('base64url')
let started = false, browser, clients = [], proof
const status = text => console.info(text) // Fixed summaries only; never frames, room IDs, invites or commands.
const composeFiles = ['-f', join(release, 'compose.isolated.yaml'), '-f', join(work, 'rehearsal.yaml')]
async function compose(...command) { return exec('docker', ['compose', '-p', name, '--env-file', join(work, 'release.env'), ...composeFiles, ...command], { maxBuffer: 4_000_000, timeout: 180_000 }) }
const lookup = (_host, options, callback) => options?.all ? callback(null, [{ address: '127.0.0.1', family: 4 }]) : callback(null, '127.0.0.1', 4)
let ca
async function request(path, body, credential, extra = {}) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest({ hostname: 'yepwatch.com', port: 443, path, lookup, ca, method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(credential ? { 'X-YepWatch-Client': 'native', Authorization: `Bearer ${credential.token}`, 'X-YepWatch-Participant': credential.participantId } : {}), ...extra }, timeout: 30_000 }, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('end', () => { const raw = Buffer.concat(chunks); let data; try { data = JSON.parse(raw) } catch {} resolve({ status: res.statusCode, data, raw, headers: res.headers }) })
    }); req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Local rehearsal request timeout')))
    req.end(body === undefined ? undefined : JSON.stringify(body))
  })
}
async function ready() { for (let n = 0; n < 160; n++) { const r = await request(`${paths.rooms.slice(0, -6)}/health/ready`).catch(() => undefined); if (r?.status === 200 && r.data?.sourceCommit === metadata.YEPWATCH_SOURCE_COMMIT) return r.data; await sleep(500) } throw new Error('Isolated release never became ready') }
try {
  // A normal browser must use the real intended origin. Reserve only loopback443;
  // never stop an existing listener or modify system DNS/trust stores.
  const reservation = createServer()
  try {
    await new Promise((r, j) => { reservation.once('error', j); reservation.listen(443, '127.0.0.1', r) })
    await new Promise(r => reservation.close(r))
  } catch (error) {
    if (error.code !== 'EACCES') throw error
    // Docker can publish the low loopback port even when this unprivileged
    // checker cannot bind it. Refuse an existing listener; never stop one.
    await new Promise((r, j) => {
      const socket = createConnection({ host: '127.0.0.1', port: 443 })
      socket.once('connect', () => { socket.destroy(); j(new Error('Loopback443 already has a listener')) })
      socket.once('error', e => e.code === 'ECONNREFUSED' ? r() : j(e))
    })
  }
  const { parseEnv } = await import('node:util')
  const source = parseEnv(await readFile(args.get('--catalog-env'), 'utf8'))
  const catalog = {}
  for (const name of ['CRATE_HOSTS', 'CRATE_PORT', 'CRATE_USER', 'REDIS_HOST', 'REDIS_HOST2', 'REDIS_HOST3', 'REDIS_PORT', 'REDIS_COMMAND_TIMEOUT_MS']) if (source[name]) catalog[name] = source[name]
  assert(catalog.CRATE_HOSTS && catalog.REDIS_HOST && catalog.REDIS_PORT)
  for (const [key, filename] of [['CRATE_PASS_FILE', 'catalog-password'], ['REDIS_PASS_FILE', 'catalog-cache-password']]) {
    assert(source[key]); await secret(filename, await readFile(source[key])); catalog[key] = `/run/secrets/${filename.replaceAll('-', '_')}`
  }
  metadata.YEPWATCH_ROOM_KEY_FILE = await secret('room-key', nonce())
  metadata.YEPWATCH_ROOM_PASSWORD_FILE = await secret('room-password', '') // Default role on OUR disposable Crate only.
  metadata.YEPWATCH_GATEWAY_SECRET_FILE = await secret('gateway-service', nonce())
  const password = nonce(); metadata.YEPWATCH_FANOUT_PASSWORD_FILE = await secret('fanout-password', password)
  metadata.YEPWATCH_REVISION_URL_FILE = await secret('revision-url', `redis://:${password}@fanout:6379`)
  metadata.YEPWATCH_CATALOG_PASSWORD_FILE = join(secrets, 'catalog-password')
  metadata.YEPWATCH_CATALOG_CACHE_PASSWORD_FILE = join(secrets, 'catalog-cache-password')
  metadata.YEPWATCH_API_ENV_FILE = join(work, 'api.env')
  await writeFile(metadata.YEPWATCH_API_ENV_FILE, Object.entries({ ...catalog, ...controls,
    YEPWATCH_PROPOSAL_CRATEDB_ORIGIN: 'http://room-store:4200', YEPWATCH_PROPOSAL_CRATEDB_USERNAME: 'crate',
    YEPWATCH_PROPOSAL_KEY_ID: 'disposable-rehearsal', YEPWATCH_PROPOSAL_PUBLIC_ORIGIN: 'https://yepwatch.com',
  }).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 })
  // Compose maps the private files to these fixed names. No credentials in env_file.
  await writeFile(join(work, 'release.env'), Object.entries(metadata).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 })
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=yepwatch.com', '-addext', 'subjectAltName=DNS:yepwatch.com', '-keyout', join(secrets, 'tls.key'), '-out', join(secrets, 'tls.crt')])
  ca = await readFile(join(secrets, 'tls.crt')); const cert = new X509Certificate(ca)
  const spki = createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64')
  // Same routing file as owner proposal; only local test certificate replaces ACME.
  const routing = (await readFile(join(release, 'traefik-yepwatch.yaml'), 'utf8')).replace(/tls:\n\s+certResolver: letsencrypt/, 'tls: {}')
  await writeFile(join(work, 'routing.yaml'), routing + '\ntls:\n  certificates:\n    - certFile: /certs/tls.crt\n      keyFile: /certs/tls.key\n')
  const override = `services:
  crate:
    image: crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307
    environment: {CRATE_HEAP_SIZE: 512m}
    command: [-Cdiscovery.type=single-node, -Cnetwork.host=0.0.0.0]
    ports: ["127.0.0.1::4200"]
    mem_limit: 2g
    networks:
      catalog: {aliases: [room-store]}
  tls:
    image: traefik:v2.10.7@sha256:6341b98aec5ec8969b99e9730f4c5b22cca3103d42b6bbe4b7a3c910758fe565
    user: "1000:1000"
    read_only: true
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    command: [--entrypoints.http.address=:8081, --entrypoints.https.address=:8443, --providers.file.filename=/routing.yaml, --log.level=ERROR, --api=false]
    ports: ["127.0.0.1:443:8443"]
    volumes:
      - ${join(work, 'routing.yaml')}:/routing.yaml:ro
      - ${join(secrets, 'tls.crt')}:/certs/tls.crt:ro
      - ${join(secrets, 'tls.key')}:/certs/tls.key:ro
    networks: [edge]
`
  await writeFile(join(work, 'rehearsal.yaml'), override)
  await compose('config', '--quiet'); status('Compose configuration validated; starting own disposable room store and bus.')
  started = true; await compose('up', '-d', 'crate', 'fanout')
  const crate = (await compose('ps', '-q', 'crate')).stdout.trim()
  const portOutput = (await compose('port', 'crate', '4200')).stdout.trim(), crateUrl = `http://${portOutput}`
  let storeReady = false
  for (let n = 0; n < 120 && !storeReady; n++) { storeReady = await fetch(`${crateUrl}/_sql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stmt: 'SELECT 1' }) }).then(r => r.ok, () => false); if (!storeReady) await sleep(500) }
  assert(storeReady, 'Own disposable Crate did not start')
  await exec('docker', ['run', '--rm', '--network', `container:${crate}`,
    '--mount', `type=bind,src=${metadata.YEPWATCH_ROOM_KEY_FILE},dst=/run/secrets/room_key,readonly`,
    '-e', 'YEPWATCH_PROPOSAL_CRATEDB_ORIGIN=http://127.0.0.1:4200', '-e', 'YEPWATCH_PROPOSAL_CRATEDB_USERNAME=crate',
    '-e', 'YEPWATCH_PROPOSAL_KEY_ID=disposable-rehearsal', '-e', 'YEPWATCH_PROPOSAL_SECRET_FILE=/run/secrets/room_key',
    ...Object.entries(controls).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    metadata.YEPWATCH_API_IMAGE, 'node', 'build/yepwatch-release/operator.mjs', 'provision', '--apply', '--disposable-single-node'], { timeout: 30_000 })
  status('Explicit operator provision passed on own loopback store; starting release API/full catalog, gateway and front.')
  await compose('up', '-d', 'api', 'gateway', 'front', 'tls')
  const health = await ready(); assert(Object.values(health.checks).every(Boolean))
  status('Release readiness green with full catalog; testing HTTPS, WSS and real guest room.')
  const index = await request('/'); assert.equal(index.status, 200)
  assert.equal(createHash('sha256').update(index.raw).digest('hex'), expectedIndex)
  const inviteShell = await request('/r/disposable-route-check'); assert.equal(inviteShell.status, 200); assert(inviteShell.raw.equals(index.raw))
  assert.equal((await request('/.well-known/apple-app-site-association')).status, 404)
  const association = await request('/.well-known/assetlinks.json'); assert.equal(association.status, 200); assert.equal(association.data[0].target.package_name, 'com.yepwatch.preview')
  const apk = await request(`/downloads/${apkName}`); assert.equal(apk.status, 200)
  assert.equal(createHash('sha256').update(apk.raw).digest('hex'), expectedApk)
  assert.equal(apk.headers['content-type'], 'application/vnd.android.package-archive')
  assert.equal((await request('/downloads/missing.apk')).status, 404)
  assert.equal((await request(paths.realtimeAttach, {})).status, 404)
  if (rateCompatibility) {
    // Align this disposable test with the real SQL clock, never reset a quota
    // or alter a timestamp. Keep enough natural window left to observe reload.
    const clock = await fetch(`${crateUrl}/_sql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stmt: 'SELECT CURRENT_TIMESTAMP' }) }).then(r => r.json())
    const remaining = 60_000 - Number(clock.rows[0][0]) % 60_000
    if (remaining < 15_000) await sleep(remaining + 100)
  }
  const admission = nickname => ({ contractVersion: 3, nickname, commandId: nonce(), admissionSecret: nonce() })
  const created = await request(paths.rooms, admission('Release native host'), undefined, { 'X-YepWatch-Client': 'native' }); assert.equal(created.status, 200)
  const host = created.data, room = host.credential.roomId
  const read = async credential => { const r = await request(paths.snapshot(room), undefined, credential); assert.equal(r.status, 200); return r.data }
  async function command(credential, input) { const s = await read(credential), value = input(s); const r = await request(paths.commands(room), { commandId: nonce(), sequence: s.own.nextSequence, command: value }, credential); assert.equal(r.status, 200, `Ordinary ${value.type} command failed: ${r.data?.error?.code}`); return r.data.snapshot }
  await command(host.credential, s => ({ type: 'setup', expectedContextVersion: s.shared.contextVersion, screens: [{ id: 'screen', label: 'Release rehearsal screen', country: 'DE', serviceIds: [8], confirmed: true }], constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] }, screenId: 'screen' }))
  if (rateCompatibility) {
    browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP yepwatch.com 127.0.0.1', `--ignore-certificate-errors-spki-list=${spki}`] })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [], commands = [], frames = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (r.url().endsWith('/commands') && r.method() === 'POST') commands.push(r.postDataJSON()) })
    page.on('websocket', ws => ws.on('framereceived', event => { try { frames.push(JSON.parse(event.payload.toString())) } catch {} }))
    await page.goto('https://yepwatch.com'); await page.getByLabel('Your nickname').fill('Release bounded retry peer')
    await page.getByRole('button', { name: 'Join with an invitation', exact: true }).click(); await page.getByLabel('Room code or invitation').fill(host.invite.code)
    const denial = page.waitForResponse(r => r.url().endsWith('/commands') && r.status() === 429)
    await page.getByRole('button', { name: 'Join room', exact: true }).click()
    const denied = await denial, deniedBody = denied.request().postDataJSON(), error = await denied.json()
    assert.equal(deniedBody.command.type, 'ready'); assert.equal(error.error.retryable, true)
    const retryAfter = Number(denied.headers()['retry-after']); assert(retryAfter >= 1 && retryAfter <= 60)
    assert.equal(commands.length, 2); assert.equal(commands[0].command.type, 'assign_screen')
    const retry = page.getByRole('button', { name: 'Retry pending action', exact: true })
    await expect(retry).toBeDisabled(); await page.reload(); await expect(retry).toBeDisabled()
    status('Actual rate429/Retry-After observed; reload retained the pending envelope. Waiting natural SQL minute boundary, without replay.')
    await expect(retry).toBeEnabled({ timeout: 70_000 }); assert.equal(commands.length, 2, 'No automatic POST during reload/cooldown')
    const confirmed = page.waitForResponse(r => r.url().endsWith('/commands') && r.status() === 200)
    await retry.click(); const response = await confirmed
    assert.deepEqual(response.request().postDataJSON(), deniedBody); assert.equal(commands.length, 3)
    const own = (await response.json()).snapshot.own; assert.equal(own.nextSequence, deniedBody.sequence + 1); assert.equal(own.agreement.agreed, false)
    const current = await read(host.credential); assert.equal(current.shared.phase, 'setup'); assert.equal(current.shared.participants.length, 2)
    for (const frame of frames) if (frame.type === 'room.snapshot' || frame.type === 'room.updated') proposalProjection(frame.snapshot, room)
    assert.deepEqual(errors, []); await writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' })
    proof = { result: 'PASS', completedAt: new Date().toISOString(), scope: 'Separate own disposable rate phase; no live quotas reset or fixture responses',
      publicOriginUnderTest: 'https://yepwatch.com', tls: 'Local ephemeral cert/exact hostname/SPKI; no public deployment or system DNS/trust changes',
      controls, clientArtifacts: { indexSha256: expectedIndex, apkFilename: apkName, apkSha256: expectedApk },
      retryAfterSeconds: retryAfter, checks: ['Actual durable actor-rate429 with retryable and Retry-After', 'Pending exact envelope/cooldown survives actual browser reload',
        'Zero automatic command POSTs before manual Retry', 'Natural SQL window recovery without quota reset', 'Manual Retry posts same command ID/sequence/body and succeeds once',
        'Two independent guests remain in setup; no automatic agreement', 'Strict shared-only frames'], commandPostCount: commands.length, javaScriptErrors: 0,
      screenshot: `artifacts/${screenshotName}`, physicalPhoneOrPublicTlsClaimed: false, retainedProcessesChanged: false, credentialsInvitesAndRoomIdentifiersRedacted: true }
  } else {
  const joined = await request(paths.join(room), { ...admission('Release native peer'), inviteCode: host.invite.code, screenId: 'screen' }, undefined, { 'X-YepWatch-Client': 'native' }); assert.equal(joined.status, 200); const peer = joined.data
  async function socket(credential) { const r = await request(paths.realtimeTicket(room), {}, credential); assert.equal(r.status, 200); const client = await connect(`wss://yepwatch.com${paths.realtime}`, r.data.ticket, { lookup, ca }, room); clients.push(client); await until(() => client.frames.some(f => f.type === 'activity.session'), 10_000); return client }
  const observer = await socket(host.credential)
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP yepwatch.com 127.0.0.1', `--ignore-certificate-errors-spki-list=${spki}`] })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [], browserFrames = []
  page.on('pageerror', e => errors.push(e.message)); page.on('websocket', ws => ws.on('framereceived', event => { try { browserFrames.push(JSON.parse(event.payload.toString())) } catch {} }))
  await page.goto('https://yepwatch.com'); await page.getByLabel('Your nickname').fill('Release browser peer')
  await page.getByRole('button', { name: 'Join with an invitation', exact: true }).click(); await page.getByLabel('Room code or invitation').fill(host.invite.code)
  const ownReady = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'ready')
  await page.getByRole('button', { name: 'Join room', exact: true }).click(); assert.equal((await ownReady).status(), 200)
  await command(peer.credential, s => ({ type: 'ready', expectedContextVersion: s.shared.contextVersion, ready: true }))
  const choosing = await command(host.credential, s => ({ type: 'start', hostReady: true, expectedContextVersion: s.shared.contextVersion, expectedRosterVersion: s.shared.rosterVersion }))
  assert(choosing.shared.candidates.length > 0)
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled({ timeout: 15000 })
  const vote = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote')
  await page.getByRole('button', { name: 'Yep', exact: true }).click(); const voteResponse = await vote; assert.equal(voteResponse.status(), 200)
  const target = voteResponse.request().postDataJSON().command.candidateId
  for (const c of [host.credential, peer.credential]) await command(c, s => ({ type: 'vote', generation: s.shared.generation, candidateId: target, expectedVoteRevision: s.own.votes.find(v => v.candidateId === target)?.revision ?? 0, value: 'watch' }))
  await page.getByRole('button', { name: /^Inspect \d+ matches/ }).click()
  const proposed = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'propose')
  await page.getByRole('button', { name: /^Propose .+/ }).click()
  assert.equal((await proposed).status(), 200)
  await command(host.credential, s => ({ type: 'agree', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId: target, expectedOwnAgreementRevision: s.own.agreement.revision, agreed: true }))
  const done = await command(peer.credential, s => ({ type: 'agree', generation: s.shared.generation, expectedRosterVersion: s.shared.rosterVersion, expectedProposalVersion: s.shared.proposalVersion, candidateId: target, expectedOwnAgreementRevision: s.own.agreement.revision, agreed: true }))
  assert.equal(done.shared.phase, 'decided'); await until(() => observer.frames.some(f => f.type === 'room.updated' && f.snapshot.phase === 'decided'), 10_000)
  await expect(page.getByText('Everyone agrees. Enjoy your watch.', { exact: true })).toBeVisible({ timeout: 15000 })
  await writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' })
  for (const f of [...observer.frames, ...browserFrames]) if (f.type === 'room.snapshot' || f.type === 'room.updated') proposalProjection(f.snapshot, room)
  assert.deepEqual(errors, [])
  status('Real HTTPS browser/native-protocol three-person decision passed; checking gateway1012 and API/store recovery.')
  await compose('restart', 'gateway'); await until(() => observer.closed === 1012, 10_000)
  // API readiness can stay green during a gateway-only restart. Wait for the
  // actual gateway healthcheck before opening this one-shot fixture socket.
  const gatewayId = (await compose('ps', '-q', 'gateway')).stdout.trim()
  let gatewayReady = false
  for (let n = 0; n < 60 && !gatewayReady; n++) {
    gatewayReady = (await exec('docker', ['inspect', '--format', '{{.State.Health.Status}}', gatewayId])).stdout.trim() === 'healthy'
    if (!gatewayReady) await sleep(500)
  }
  assert(gatewayReady, 'Restarted gateway did not become healthy')
  await ready(); const restoredSocket = await socket(host.credential)
  assert(restoredSocket.frames.some(f => f.type === 'room.snapshot' && f.snapshot.decision?.candidateId === target))
  const restartAt = Date.now(); await compose('restart', 'api'); await ready()
  const recovered = await read(host.credential); assert.equal(recovered.shared.decision.candidateId, target); assert.equal(recovered.own.participantId, host.credential.participantId)
  const gatewayInspect = JSON.parse((await exec('docker', ['inspect', (await compose('ps', '-q', 'gateway')).stdout.trim()])).stdout)[0]
  const apiStats = (await exec('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}', (await compose('ps', '-q', 'api')).stdout.trim()])).stdout.trim()
  assert.deepEqual(gatewayInspect.NetworkSettings.Ports, { '4311/tcp': null })
  proof = { result: 'PASS', completedAt: new Date().toISOString(), scope: 'Own disposable Compose project, no retained stack or production room writes',
    publicOriginUnderTest: 'https://yepwatch.com', tls: 'Local ephemeral certificate, exact intended hostname; Node trusts only that certificate and browser allows only its SPKI; no system DNS/trust mutations or public deployment',
    topology: 'Traefik2.10.7 TLS -> actual release static/Caddy -> bundled API + gateway -> own fanout/room Crate; API-only existing catalog read egress',
    images: metadata, fullCatalog: 'Existing full snapshot/catalog dependencies; no sample Redis URL or fixtures', candidates: choosing.shared.candidates.length,
    clientArtifacts: { indexSha256: expectedIndex, apkFilename: apkName, apkSha256: expectedApk },
    checks: ['SPA invite fallback returns exact index', 'Preview Android association JSON; absent AASA404', 'Preview APK hash/Android MIME; missing download404', 'Internal hooks not public', 'Secure browser cookie and authenticated WSS snapshot',
      'Three independent guest identities; actual standalone web build and two native protocol clients', 'Automatic screen readiness without guest Ready button', 'Unanimous match, explicit proposal/agreement and fresh-check Done',
      'Strict shared-only frames', 'Gateway SIGTERM1012 and fresh-ticket recovery', 'API restart preserves actor and durable decision without installer'],
    browserSharedFrames: browserFrames.filter(f => f.type === 'room.snapshot' || f.type === 'room.updated').length, javaScriptErrors: 0, apiRestartRecoveryMs: Date.now() - restartAt, apiContainerMemoryAfterReload: apiStats,
    screenshot: `artifacts/${screenshotName}`,
    physicalPhoneOrPublicTlsClaimed: false, retainedProcessesChanged: false, credentialsInvitesAndRoomIdentifiersRedacted: true }
  }
  proof.controls = controls
  // Keep source image references; remove host-private metadata paths from public evidence.
  proof.images = Object.fromEntries(Object.entries(metadata).filter(([key]) => /_IMAGE$|SOURCE_COMMIT/.test(key)))
  await writeFile(resultPath, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' }); status('PASS local release container/HTTPS/WSS rehearsal; sanitized incremental artifact recorded.')
} catch (error) {
  if (started) { const logs = await compose('logs', '--no-color').catch(() => ({ stdout: '' })); await writeFile(join(work, 'diagnostics.log'), logs.stdout, { mode: 0o600 }) }
  console.error(`Local release rehearsal failed: ${error.message}. Private diagnostics retained at ${work}`); process.exitCode = 1
} finally {
  for (const client of clients) client.ws.close(); await browser?.close()
  if (started) await compose('down', '--volumes', '--remove-orphans').catch(() => {})
}
