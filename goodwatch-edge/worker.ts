// Design prototype for #784. No routes are configured and caching defaults off.
import { isbot } from 'isbot'
import { cacheIdentityOf } from '../goodwatch-webapp/app/server/cache-identity.server.ts'

export interface Env { ENABLE_CACHE?: string }

/** Reuse the app's exact cookie and language rules, ignoring client identity headers. */
export function edgeIdentity(request: Request) {
	return cacheIdentityOf({
		method: request.method,
		cookie: request.headers.get('cookie'),
		acceptLanguage: request.headers.get('accept-language'),
		identityHeader: null,
	})
}

// Start with catalog documents only. No root, profiles, lists, auth, data or APIs.
const catalog = /^\/(?:movie\/[^/]+|show\/[^/]+|person\/[^/]+|discover(?:\/[^/]+)?|people|hot-on-socials|blog(?:\/[^/]+)?)\/?$/
function knownCookies(cookie: string) {
	return cookie.split(';').every(part => {
		const name = part.trim().split('=')[0]
		return !name || /^(?:gw_loc|gw_browser|_ga(?:_.*)?|_gid|_gat(?:_.*)?|ph_[\w-]+|__cf_bm|cf_clearance|__cflb|__cfseq|cf_ob_info|cf_use_ob|__cfruid|_cfuvid|__cfwaitingroom|cf_chl_rc_(?:i|ni|m))$/.test(name)
	})
}

/** Return a bounded reason, never cookie values, paths or credentials. */
function bypassReason(request: Request, env: Env): string | null {
	const url = new URL(request.url)
	if (env.ENABLE_CACHE !== 'true') return 'disabled'
	if (url.hostname !== 'goodwatch.app') return 'host'
	if (request.method !== 'GET') return 'method'
	if (!catalog.test(url.pathname)) return 'route'
	if (url.search) return 'query'
	if (request.headers.has('authorization')) return 'authorization'
	if (['range', 'upgrade', 'if-none-match', 'if-modified-since'].some(name => request.headers.has(name))) return 'protocol'
	if (isbot(request.headers.get('user-agent'))) return 'bot'
	if (!edgeIdentity(request).cacheable) return 'identity'
	if (!knownCookies(request.headers.get('cookie') ?? '')) return 'cookie'
	if (!(request.headers.get('accept') ?? '').includes('text/html')) return 'accept'
	return null
}

export function eligible(request: Request, env: Env) {
	return bypassReason(request, env) === null
}

function observed(response: Response, reason: string | null) {
	const status = response.headers.get('CF-Cache-Status')?.toUpperCase()
	const outcome = reason ? `bypass-${reason}` :
		['HIT', 'STALE', 'UPDATING', 'REVALIDATED'].includes(status ?? '') ? 'hit' :
		['MISS', 'EXPIRED'].includes(status ?? '') ? 'miss' : 'bypass-origin-policy'
	// Reuse the body stream without consuming it. Copy immutable fetch headers.
	const result = new Response(response.body, response)
	result.headers.set('GW-Edge', outcome)
	return result
}

export async function handle(request: Request, env: Env, originFetch: typeof fetch = fetch) {
	const headers = new Headers(request.headers)
	headers.delete('GW-Cache-Identity')
	// Only a zone route may invoke this code. Cloudflare supplies this header.
	const clientIp = headers.get('CF-Connecting-IP')
	if (clientIp) headers.set('X-Forwarded-For', clientIp)
	const reason = bypassReason(request, env)
	const useCache = reason === null
	if (useCache) headers.set('GW-Cache-Identity', edgeIdentity(request).key!)
	const forwarded = new Request(request, { headers, redirect: 'manual' })
	if (!useCache) return observed(await originFetch(forwarded, { cache: 'no-store' }), reason)
	// Native CDN fetch retains origin policy, Age and Tiered Cache semantics.
	// See the research note: edge SWR needs a CDN-specific origin policy first.
	// Do not set cacheTtl: it could override private/no-store and shorter lifetimes.
	return observed(await originFetch(forwarded, {
		cf: {
			cacheEverything: true,
			cacheTtlByStatus: { '100-199': -1, '201-599': -1 },
			vary: {
				default: { action: 'bypass' },
				headers: {
					'gw-cache-identity': { action: 'passthrough' },
					'accept-encoding': { action: 'normalize' },
				},
			},
		},
	} as RequestInit), null)
}

export default { fetch: (request: Request, env: Env) => handle(request, env) }
