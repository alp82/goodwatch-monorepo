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
		return !name || /^(?:gw_loc|gw_browser|_ga(?:_.*)?|_gid|_gat(?:_.*)?|ph_[\w-]+)$/.test(name)
	})
}

export function eligible(request: Request, env: Env) {
	const url = new URL(request.url)
	return env.ENABLE_CACHE === 'true' && url.hostname === 'goodwatch.app' &&
		request.method === 'GET' && catalog.test(url.pathname) &&
		!url.search && // Phase 1 bypasses all queries, including _data and tracking IDs.
		!request.headers.has('authorization') && !request.headers.has('range') &&
		!request.headers.has('upgrade') && !request.headers.has('if-none-match') &&
		!request.headers.has('if-modified-since') &&
		!isbot(request.headers.get('user-agent')) &&
		knownCookies(request.headers.get('cookie') ?? '') &&
		edgeIdentity(request).cacheable &&
		(request.headers.get('accept') ?? '').includes('text/html')
}

export async function handle(request: Request, env: Env, originFetch: typeof fetch = fetch) {
	const headers = new Headers(request.headers)
	headers.delete('GW-Cache-Identity')
	// Only a zone route may invoke this code. Cloudflare supplies this header.
	const clientIp = headers.get('CF-Connecting-IP')
	if (clientIp) headers.set('X-Forwarded-For', clientIp)
	const useCache = eligible(request, env)
	if (useCache) headers.set('GW-Cache-Identity', edgeIdentity(request).key!)
	const forwarded = new Request(request, { headers, redirect: 'manual' })
	if (!useCache) return originFetch(forwarded, { cache: 'no-store' })
	// Native CDN fetch retains origin policy, Age and Tiered Cache semantics.
	// See the research note: edge SWR needs a CDN-specific origin policy first.
	// Do not set cacheTtl: it could override private/no-store and shorter lifetimes.
	return originFetch(forwarded, {
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
	} as RequestInit)
}

export default { fetch: (request: Request, env: Env) => handle(request, env) }
