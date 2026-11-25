import { isbot } from 'isbot'
import { edgeIdentity } from './worker.ts'
import {
	BROWSE_EDGE_GENERATION, BROWSE_EDGE_HEADER, BROWSE_EDGE_PROOF, BROWSE_EDGE_PATH, BROWSE_EDGE_QUERY, BROWSE_EDGE_STATE,
} from '../goodwatch-webapp/app/utils/browse-edge.ts'

const stateLifetime = 10_000

function bypass(request: Request) {
	const url = new URL(request.url)
	if (url.origin !== 'https://goodwatch.app' || url.pathname !== BROWSE_EDGE_PATH) return 'route'
	if (url.search || request.url.includes('?')) return 'query'
	if (request.method !== 'GET') return 'method'
	if (request.headers.has('authorization') || request.headers.has('proxy-authorization')) return 'authorization'
	if (['range', 'upgrade', 'if-none-match', 'if-match', 'if-range', 'if-modified-since', 'if-unmodified-since', 'cache-control', 'pragma'].some(h => request.headers.has(h))) return 'protocol'
	if (!request.headers.get('accept')?.includes('text/html')) return 'accept'
	if (!request.headers.get('user-agent') || isbot(request.headers.get('user-agent'))) return 'bot'
	// Saved preferences and any unreviewed cookie go through the normal page. Operational
	// and analytics cookies are never forwarded to a fill or used to select a representation.
	const cookies = (request.headers.get('cookie') ?? '').split(';').map(c => c.trim()).filter(Boolean)
	if (!cookies.every(cookie => /^(?:gw_browser=1$|(?:_ga(?:_\w+)?|_gid|ph_[\w-]+|__cf_bm|cf_clearance|_cfuvid)=)/.test(cookie))) return 'cookie'
	return null
}

function observed(response: Response, outcome: string, state: string) {
	const result = new Response(response.body, response)
	result.headers.set('GW-Edge', outcome)
	result.headers.set('GW-Edge-State', state)
	result.headers.delete(BROWSE_EDGE_HEADER)
	result.headers.delete(BROWSE_EDGE_PROOF)
	result.headers.delete('gw-edge-key')
	result.headers.delete('Cloudflare-CDN-Cache-Control')
	return result
}

export function createBrowseCanary(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
	let checkingUntil = 0
	let lastState: { generation: string | null, expires: number } | undefined
	return async (request: Request, env: { ENABLE_CACHE?: string; BROWSE_FILL_TOKEN?: string }) => {
		const headers = new Headers(request.headers)
		headers.delete(BROWSE_EDGE_HEADER)
		headers.delete(BROWSE_EDGE_PROOF)
		headers.delete('gw-edge-key')
		headers.delete('GW-Cache-Identity')
		const original = new Request(request, { headers, redirect: 'manual' })
		const forward = async (reason: string, state: string) =>
			observed(await fetcher(original, { cache: 'no-store' }), 'bypass-' + reason, state)
		const reason = env.ENABLE_CACHE === 'true' ? bypass(request) : 'disabled'
		if (reason) return forward(reason, 'unused')
		if (!/^[a-f0-9]{64}$/.test(env.BROWSE_FILL_TOKEN ?? '')) return forward('unconfigured', 'unused')

		const common = new Headers()
		const client = headers.get('cf-connecting-ip')
		if (client) {
			common.set('cf-connecting-ip', client)
			common.set('x-real-ip', client)
		}
		const checkedAt = now()
		let state = 'memory'
		if (!lastState || lastState.expires <= checkedAt) {
			// Worker I/O belongs to the initiating request. Concurrent visitors use their normal page
			// instead of borrowing its pending fetch or issuing another representation probe.
			if (checkedAt < checkingUntil) return forward('state-pending', 'pending')
			const deadline = checkedAt + stateLifetime
			checkingUntil = deadline
			state = 'origin'
			let generation: string | null = null
			try {
				const check = await fetcher(new Request(new URL(BROWSE_EDGE_STATE, request.url), { headers: common, redirect: 'manual' }), {
					cache: 'no-store', signal: AbortSignal.timeout(1500),
				})
				if (check.ok && check.headers.get('content-type')?.startsWith('text/plain')) {
					const value = await check.text()
					if (BROWSE_EDGE_GENERATION.test(value)) generation = value
				} else await check.body?.cancel()
			} catch { /* Continue to the normal origin page if its representation is unknown. */ }
			finally { if (checkingUntil === deadline) checkingUntil = 0 }
			lastState = { generation, expires: checkedAt + stateLifetime }
		}
		if (!lastState.generation) return forward('state', state)
		const identity = edgeIdentity(request)
		if (!identity.cacheable) return forward('identity', state)
		const variant = [lastState.generation, identity.country, identity.language].join('.')
		const target = new URL(BROWSE_EDGE_PATH + BROWSE_EDGE_QUERY + variant, request.url)
		common.set(BROWSE_EDGE_HEADER, variant)
		common.set(BROWSE_EDGE_PROOF, env.BROWSE_FILL_TOKEN!)
		common.set('accept', 'text/html')
		common.set('user-agent', headers.get('user-agent')!)
		for (const name of ['accept-language', 'accept-encoding']) {
			const value = headers.get(name)
			if (value) common.set(name, value)
		}
		if ((headers.get('cookie') ?? '').split(';').some(s => s.trim() === 'gw_browser=1')) common.set('cookie', 'gw_browser=1')

		let response: Response
		try {
			response = await fetcher(new Request(target, { headers: common, redirect: 'manual' }), {
			cf: {
				cacheEverything: true,
				// Successful documents require explicit approval from this version of the origin.
				// Other statuses never fill this internal URL. No positive edge TTL override.
				cacheTtlByStatus: { '100-199': -1, '201-303': -1, '305-599': -1 },
			},
		} as RequestInit)
		} catch {
			return forward('fetch', state)
		}
		const confirmed = response.headers.get(BROWSE_EDGE_HEADER)
		const status = response.headers.get('cf-cache-status')?.toUpperCase()
		if (response.status === 200 && confirmed === 'private' && !['HIT', 'UPDATING', 'STALE', 'REVALIDATED'].includes(status ?? '')) {
			return observed(response, 'bypass-origin-policy', state)
		}
		if (response.status !== 200 || confirmed !== variant || response.headers.has('set-cookie') ||
			!response.headers.get('content-type')?.startsWith('text/html') ||
			(response.headers.get('vary') ?? '').split(',').some(v => !/^(?:accept-encoding)?$/i.test(v.trim()))) {
			// A mixed deployment or an unexpected representation can never serve the internal URL
			// to a visitor. A shed/error response is already a complete error, avoid a second render.
			if (response.status >= 400) return observed(response, 'bypass-origin-policy', state)
			await response.body?.cancel()
			return forward('unconfirmed', state)
		}
		const result = observed(response, status === 'HIT' ? 'hit' : status === 'UPDATING' || status === 'STALE' ? 'stale' :
			status === 'REVALIDATED' ? 'revalidated' : status === 'EXPIRED' || status === 'MISS' ? 'miss' : 'bypass-origin-policy', state)
		result.headers.set('Cache-Control', 'private, max-age=0')
		result.headers.set('Vary', 'Cookie, Accept-Language, Accept-Encoding')
		return result
	}
}

const handle = createBrowseCanary()
export default { fetch: (request: Request, env: { ENABLE_CACHE?: string; BROWSE_FILL_TOKEN?: string }) => handle(request, env) }
