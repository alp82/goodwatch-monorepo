import assert from 'node:assert/strict'
import test from 'node:test'
import { createBrowseCanary } from './browse-canary.ts'
import { BROWSE_EDGE_PATH as path, BROWSE_EDGE_HEADER as header, BROWSE_EDGE_STATE as state } from '../goodwatch-webapp/app/utils/browse-edge.ts'

const generation = 'e'.repeat(40) + '.static'
const url = 'https://goodwatch.app' + path
const enabled = { ENABLE_CACHE: 'true' }
const req = (extra: HeadersInit = {}, suffix = '') => new Request(url + suffix, {
	headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', ...extra },
})
const probe = (text = generation) => new Response(text, { headers: { 'content-type': 'text/plain' } })
const doc = (variant: string, extra = {}) => new Response('Sad shows', { headers: {
	[header]: variant, 'cf-cache-status': 'HIT', 'content-type': 'text/html', 'cache-control': 'private, max-age=0', ...extra,
} })

test('only canonical anonymous HTML reaches a CDN lookup; other requests keep their cookies, stripped of internal fields', async () => {
	const run = createBrowseCanary(async (r, options) => {
		const request = r as Request
		assert.equal(request.headers.get(header), null)
		assert.equal(request.headers.get('gw-cache-identity'), null)
		assert.deepEqual(options, { cache: 'no-store' })
		return new Response('bypass')
	})
	for (const [headers, suffix, reason] of [
		[{ cookie: 'gw.session_token=x' }, '', 'cookie'],
		[{ cookie: 'sb-other-auth-token.0=' }, '', 'cookie'],
		[{ cookie: 'gw_loc=%7B%7D' }, '', 'cookie'],
		[{ cookie: '__cf_bm=x; _cfuvid=y; x=private' }, '', 'cookie'],
		[{ authorization: 'Bearer x' }, '', 'authorization'],
		[{ accept: 'application/json' }, '', 'accept'],
		[{ 'user-agent': 'Googlebot' }, '', 'bot'],
		[{ 'if-match': '*' }, '', 'protocol'],
		[{}, '?_data=root', 'query'], [{}, '?', 'query'], [{}, '/genre', 'route'], [{}, 'ness', 'route'],
	] as const) {
		const result = await run(req({ ...headers, [header]: 'spoofed', 'gw-cache-identity': 'anon;IT;it' }, suffix), enabled)
		assert.equal(result.headers.get('gw-edge'), 'bypass-' + reason)
	}
})

test('generation and effective locale partition the native key; only reviewed input reaches origin', async () => {
	let time = 1000, mode = generation
	const targets: string[] = []
	const run = createBrowseCanary(async (r, options) => {
		const request = r as Request
		targets.push(request.url)
		if (new URL(request.url).pathname === state) return probe(mode)
		assert.deepEqual(options, { cf: { cacheEverything: true, cacheTtlByStatus: { '100-199': -1, '201-303': -1, '305-599': -1 } } })
		const variant = request.headers.get(header)!
		assert.equal(request.url, url + '?__gw_sad=' + variant)
		assert.equal(request.headers.get('gw-cache-identity'), null)
		assert.equal(request.headers.get('x-unreviewed-context'), null)
		assert.equal(request.headers.get('cookie'), 'gw_browser=1')
		return doc(variant)
	}, () => time)
	for (const [language, key] of [['en-US', 'US.en'], ['de-DE', 'DE.de']]) {
		const result = await run(req({ 'accept-language': language, 'x-unreviewed-context': 'no', cookie: '_ga=x; gw_browser=1', [header]: 'fake' }), enabled)
		assert.equal(result.headers.get(header), null)
		assert.equal(result.headers.get('gw-edge'), 'hit')
		assert.equal(result.headers.get('gw-edge-state'), key === 'US.en' ? 'origin' : 'memory')
		assert.equal(result.headers.get('cache-control'), 'private, max-age=0')
		assert.match(targets.at(-1)!, new RegExp(key + '$'))
	}
	time += 10_001
	mode = generation.replace('static', 'origin')
	await run(req({ cookie: 'gw_browser=1' }), enabled)
	assert.match(targets.at(-1)!, /\.origin\.US\.en$/)
	assert.equal(targets.filter(s => s.endsWith(state)).length, 2)
})

test('a missing representation, old webapp, unexpected vary, or a cookie on a fill gets the original URL', async () => {
	for (const kind of ['no state', 'old app', 'bad vary', 'set-cookie', 'wrong locale']) {
		let fallback = 0
		const run = createBrowseCanary(async r => {
			const request = r as Request
			if (new URL(request.url).pathname === state) return probe(kind === 'no state' ? 'invalid' : generation)
			if (request.url === url) { fallback++; return new Response('normal') }
			if (kind === 'old app') return new Response('internal page')
			return doc(kind === 'wrong locale' ? generation + '.DE.de' : request.headers.get(header)!, kind === 'bad vary' ? { vary: 'X-Device' } : kind === 'set-cookie' ? { 'set-cookie': 'x=1' } : {})
		})
		assert.equal(await (await run(req(), enabled)).text(), 'normal')
		assert.equal(fallback, 1)
	}
})

test('private canonical responses and overload are returned once; stale and revalidation stay distinct', async () => {
	for (const [response, expected] of [
		[doc('private', { 'cf-cache-status': 'BYPASS' }), 'bypass-origin-policy'], [new Response('Busy', { status: 503 }), 'bypass-origin-policy'],
		[doc(generation + '.US.en', { 'cf-cache-status': 'UPDATING' }), 'stale'],
		[doc(generation + '.US.en', { 'cf-cache-status': 'REVALIDATED' }), 'revalidated'],
	] as const) {
		let calls = 0
		const run = createBrowseCanary(async r => ++calls === 1 ? probe() : response)
		const result = await run(req(), enabled)
		assert.equal(calls, 2)
		assert.equal(result.headers.get('gw-edge'), expected)
		assert.equal(result.status, response.status)
	}
})

test('five requests on an uninitialized isolate make one control read, including when it fails', async () => {
	for (const fail of [false, true]) {
		let release!: () => void
		const block = new Promise<void>(resolve => { release = resolve })
		let probes = 0, normal = 0
		const run = createBrowseCanary(async r => {
			const request = r as Request
			if (new URL(request.url).pathname === state) {
				probes++
				await block
				if (fail) throw new Error('representation unavailable')
				return probe()
			}
			if (request.url === url) { normal++; return new Response('normal') }
			return doc(request.headers.get(header)!)
		})
		const leader = run(req(), enabled)
		const rest = await Promise.all(Array.from({ length: 4 }, () => run(req(), enabled)))
		assert.ok(rest.every(result => result.headers.get('gw-edge') === 'bypass-state-pending'))
		release()
		const result = await leader
		assert.equal(result.headers.get('gw-edge'), fail ? 'bypass-state' : 'hit')
		assert.equal(probes, 1)
		assert.equal(normal, fail ? 5 : 4)
	}
})
