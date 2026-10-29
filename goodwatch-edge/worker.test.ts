import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { edgeIdentity, eligible, handle } from './worker.ts'
import { cacheIdentityOf } from '../goodwatch-webapp/app/server/cache-identity.server.ts'
import { serializeLocalizationCookie } from '../goodwatch-webapp/app/utils/media-language.ts'
import { languageFixtures, authFixtures } from './identity-fixtures.ts'

process.env.SUPABASE_URL = 'https://testref.supabase.co'
const req = (headers: HeadersInit = {}, path = '/movie/550-fight-club', method = 'GET') =>
	new Request(`https://goodwatch.app${path}`, {
		method, headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', ...headers },
	})
const enabled = { ENABLE_CACHE: 'true' }

test('crawler dependency stays aligned with the app lockfile', () => {
	const app = JSON.parse(readFileSync(new URL('../goodwatch-webapp/package-lock.json', import.meta.url), 'utf8'))
	const edge = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf8'))
	assert.equal(edge.packages['node_modules/isbot'].version, app.packages['node_modules/isbot'].version)
})

test('edge and app agree on the app locale fixtures before header injection', () => {
	for (const [acceptLanguage, country, language] of languageFixtures) {
		const request = req({ 'accept-language': acceptLanguage, 'GW-Cache-Identity': 'anon;JP;ja' })
		const actual = edgeIdentity(request)
		assert.deepEqual(actual, cacheIdentityOf({ method: 'GET', acceptLanguage }))
		assert.equal(actual.key, `anon;${country};${language}`)
	}
})

test('auth cookies, empty values and chunks always bypass', () => {
	for (const cookie of authFixtures) {
		assert.deepEqual(edgeIdentity(req({ cookie })), cacheIdentityOf({ method: 'GET', cookie }))
		assert.equal(edgeIdentity(req({ cookie })).key, null)
		assert.equal(eligible(req({ cookie }), enabled), false)
	}
	assert.equal(eligible(req({ cookie: 'sb-other-auth-token=x' }), enabled), false)
})

test('saved locale, browser language and malformed cookie match the app', () => {
	for (const language of ['zh-Hant', 'pt-PT', 'browser'] as const) {
		const cookie = serializeLocalizationCookie({ schemaVersion: 1, version: 'v1', country: 'DE', language }).split(';')[0]
		const request = req({ cookie, 'accept-language': 'fr-CA' })
		assert.deepEqual(edgeIdentity(request), cacheIdentityOf({ method: 'GET', cookie, acceptLanguage: 'fr-CA' }))
		assert.equal(edgeIdentity(request).key, `anon;DE;${language === 'browser' ? 'fr' : language}`)
		assert.equal(eligible(request, enabled), true)
	}
	for (const cookie of ['gw_loc=%', 'gw_loc={}', 'gw_loc=x; gw_loc=y']) {
		assert.deepEqual(edgeIdentity(req({ cookie })), cacheIdentityOf({ method: 'GET', cookie }))
	}
})

test('bypasses private protocols, data, queries, bots and unreviewed cookies', () => {
	assert.equal(eligible(req(), enabled), true)
	assert.equal(eligible(req(), {}), false)
	for (const path of ['/', '/api/related', '/mcp', '/oauth/authorize', '/.well-known/oauth-authorization-server', '/sign-in', '/u/alice', '/movie/550?_data=root', '/movie/550?country=DE', '/movie/550?utm_source=x'])
		assert.equal(eligible(req({}, path), enabled), false, path)
	for (const headers of [{ authorization: 'Bearer x' }, { cookie: 'future_session=x' }, { range: 'bytes=0-10' }, { upgrade: 'websocket' }, { accept: 'text/event-stream' }, { 'user-agent': 'Googlebot' }, { 'if-none-match': '"x"' }])
		assert.equal(eligible(req(headers), enabled), false, JSON.stringify(headers))
	for (const method of ['POST', 'HEAD', 'OPTIONS']) assert.equal(eligible(req({}, undefined, method), enabled), false)
})

test('origin receives computed identity and trusted client IP, without a forced TTL', async () => {
	await handle(req({ 'GW-Cache-Identity': 'anon;JP;ja', 'accept-language': 'de-DE', 'CF-Connecting-IP': '192.0.2.1', 'X-Forwarded-For': 'forged' }), enabled,
		async (request, options) => {
			const r = request as Request
			assert.equal(r.headers.get('GW-Cache-Identity'), 'anon;DE;de')
			assert.equal(r.headers.get('X-Forwarded-For'), '192.0.2.1')
			assert.equal(r.redirect, 'manual')
			assert.deepEqual(options, { cf: { cacheEverything: true, cacheTtlByStatus: { '100-199': -1, '201-599': -1 }, vary: { default: { action: 'bypass' }, headers: { 'gw-cache-identity': { action: 'passthrough' }, 'accept-encoding': { action: 'normalize' } } } } })
			return new Response('complete HTML', { headers: { 'set-cookie': 'session=x', 'cache-control': 'private, no-store' } })
		})
})

test('bypass strips spoofed identity and streams the unmodified origin response', async () => {
	const response = new Response('event: hello\n\n', { headers: { 'content-type': 'text/event-stream' } })
	const result = await handle(req({ 'GW-Cache-Identity': 'anon;JP;ja', cookie: 'gw.session_token=' }, '/mcp', 'POST'), enabled,
		async (request, options) => {
			assert.equal((request as Request).headers.get('GW-Cache-Identity'), null)
			assert.equal((request as Request).headers.get('cookie'), 'gw.session_token=')
			assert.deepEqual(options, { cache: 'no-store' })
			return response
		})
	assert.equal(result.body, response.body)
	assert.equal(result.headers.get('GW-Edge'), 'bypass-method')
	assert.equal(await result.text(), 'event: hello\n\n')
})


test('Cloudflare operational cookies preserve anonymous caching but never hide auth or unknown cookies', () => {
	const names = ['__cf_bm', 'cf_clearance', '__cflb', '__cfseq', 'cf_ob_info', 'cf_use_ob', '__cfruid', '_cfuvid', '__cfwaitingroom', 'cf_chl_rc_i', 'cf_chl_rc_ni', 'cf_chl_rc_m']
	const cookie = names.map(name => `${name}=opaque`).join('; ')
	assert.equal(eligible(req({ cookie }), enabled), true)
	for (const extra of [...authFixtures, 'future_session=x', '__cf_unknown=x', 'CF_Authorization=x']) {
		assert.equal(eligible(req({ cookie: `${cookie}; ${extra}` }), enabled), false, extra)
	}
})

test('GW-Edge reports CDN outcomes without buffering or changing response policy', async () => {
	for (const [status, expected] of [['HIT', 'hit'], ['STALE', 'hit'], ['UPDATING', 'hit'], ['REVALIDATED', 'hit'], ['MISS', 'miss'], ['EXPIRED', 'miss'], ['DYNAMIC', 'bypass-origin-policy'], ['BYPASS', 'bypass-origin-policy'], ['', 'bypass-origin-policy']]) {
		const response = new Response('HTML', { status: 200, headers: { 'CF-Cache-Status': status, 'cache-control': 'public, max-age=0', 'GW-Edge': 'untrusted', vary: 'GW-Cache-Identity' } })
		const result = await handle(req(), enabled, async () => response)
		assert.equal(result.headers.get('GW-Edge'), expected)
		assert.equal(result.body, response.body)
		assert.equal(result.status, 200)
		assert.equal(result.headers.get('cache-control'), 'public, max-age=0')
		assert.equal(result.headers.get('vary'), 'GW-Cache-Identity')
	}
})

test('GW-Edge exposes bounded bypass reasons even if upstream claims a hit', async () => {
	for (const [request, env, reason] of [
		[req(), {}, 'disabled'],
		[new Request('https://example.com/movie/550'), enabled, 'host'],
		[req({}, undefined, 'HEAD'), enabled, 'method'],
		[req({}, '/'), enabled, 'route'],
		[req({}, '/movie/550?_data=root'), enabled, 'query'],
		[req({ authorization: 'Bearer secret' }), enabled, 'authorization'],
		[req({ 'if-modified-since': 'yesterday' }), enabled, 'protocol'],
		[req({ 'user-agent': 'Googlebot' }), enabled, 'bot'],
		[req({ cookie: 'gw.session_token=' }), enabled, 'identity'],
		[req({ cookie: 'future_session=secret' }), enabled, 'cookie'],
		[req({ accept: 'application/json' }), enabled, 'accept'],
	] as const) {
		const result = await handle(request, env, async () => new Response(null, { headers: { 'CF-Cache-Status': 'HIT' } }))
		assert.equal(result.headers.get('GW-Edge'), `bypass-${reason}`)
	}
})
