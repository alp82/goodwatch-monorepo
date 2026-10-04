// Which stored response may a request get? One answer for every cache: the in-process page cache and a cache in front
// of the app.
// - The identity of a request is its audience (anonymous or member), its country, and its language. With the URL it is
//   the whole cache key. A request with the auth cookie is a member, whatever the cookie's value, and is never served
//   from or stored in a shared cache.
// - The key travels in the GW-Cache-Identity header (`anon;US;en`). A front cache computes it and sends it with the
//   request. The app then takes country and language from it, answers with shared-cacheable headers, and varies on
//   that header. Without it the app derives country and language from Accept-Language and answers `private`, because
//   it can't know that a cache on the way tells members from anonymous visitors.
// - Errors, redirects, member responses, and responses that set a cookie are never stored.
// The rule, the decision per cookie and parameter, and what each cache must do: docs/cache-identity.md.
import acceptLanguage from "accept-language-parser"
import {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
	hasAuthCookie,
} from "../utils/auth-cookie.ts"
export {
	authCookieName,
	createAuthCookieMatcher,
	hasAuthCookie,
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
} from "../utils/auth-cookie.ts"

// Catalog data is the same for every visitor, country, and language: the URL alone is the cache key, and members may share it.
export const PUBLIC_DATA_CACHE_CONTROL =
	"public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"

export const CACHE_IDENTITY_HEADER = "GW-Cache-Identity"
export const FALLBACK_COUNTRY = "US"
export const FALLBACK_LANGUAGE = "en"
export const KEYED_PAGE_CACHE_CONTROL = "private, max-age=0"
const identityPattern = /^anon;[A-Z]{2};[a-z]{2,3}$/

export interface RequestLocale {
	country: string
	language: string
	source: "identity-header" | "accept-language"
}

/**
 * The country and language of a request: from a valid identity header of an anonymous request, else from
 * Accept-Language, else US and en. The URL (`?country=`) and a member's saved country are the caller's business.
 */
export function requestLocale(request: Request): RequestLocale {
	const { country, language, keyFromCache } = cacheIdentity(request)
	return {
		country,
		language,
		source: keyFromCache ? "identity-header" : "accept-language",
	}
}

function readLocale(
	header: string | null | undefined,
	languageHeader: string | null | undefined,
	useIdentity: boolean,
): RequestLocale {
	if (useIdentity && header && identityPattern.test(header)) {
		const [, country, language] = header.split(";")
		return { country, language, source: "identity-header" }
	}
	const entries = acceptLanguage.parse(languageHeader ?? "")
	const preferred = entries[0]?.code ?? ""
	const region = entries.find((entry) =>
		/^[a-z]{2}$/i.test(entry.region ?? ""),
	)?.region
	return {
		country: region?.toUpperCase() ?? FALLBACK_COUNTRY,
		language: /^[a-z]{2,3}$/i.test(preferred)
			? preferred.toLowerCase()
			: FALLBACK_LANGUAGE,
		source: "accept-language",
	}
}

export function getLocaleFromRequest(request: Request) {
	const { country, language } = requestLocale(request)
	return { locale: { language, country } }
}

export interface CacheIdentity {
	audience: "anon" | "member"
	country: string
	language: string
	/** With the complete URL, the whole cache key. Null for members. */
	key: string | null
	/** Whether a valid key was supplied by a front cache. */
	keyFromCache: boolean
	/** The response must also pass applyCachePolicy before storage. */
	cacheable: boolean
}
const identities = new WeakMap<Request, CacheIdentity>()
export function cacheIdentity(request: Request): CacheIdentity {
	const remembered = identities.get(request)
	if (remembered) return remembered
	const identity = cacheIdentityOf({
		method: request.method,
		cookie: request.headers.get("Cookie"),
		acceptLanguage: request.headers.get("Accept-Language"),
		identityHeader: request.headers.get(CACHE_IDENTITY_HEADER),
	})
	identities.set(request, identity)
	return identity
}

/** The same identity rule without allocating a Fetch Request on the HTTP hit path. */
export function cacheIdentityOf({
	method,
	cookie,
	acceptLanguage,
	identityHeader,
}: {
	method: string
	cookie?: string | null
	acceptLanguage?: string | null
	identityHeader?: string | null
}): CacheIdentity {
	const member = hasAuthCookie(cookie)
	const { country, language, source } = readLocale(
		identityHeader,
		acceptLanguage,
		!member,
	)
	const identity: CacheIdentity = {
		audience: member ? "member" : "anon",
		country,
		language,
		key: member ? null : `anon;${country};${language}`,
		keyFromCache: !member && source === "identity-header",
		cacheable: !member && (method === "GET" || method === "HEAD"),
	}
	return identity
}

export type CacheDecision = "shared" | "keyed" | "private" | "unset"
/** Keyed responses can be stored by the in-process cache under URL + identity. */
export function applyCachePolicy(
	request: Request,
	status: number,
	headers: Headers,
): CacheDecision {
	const identity = cacheIdentity(request)
	const policy = headers.get("Cache-Control")
	if (
		status !== 200 ||
		!identity.cacheable ||
		identity.key === null ||
		headers.has("Set-Cookie") ||
		/(?:^|,)\s*(?:private|no-store|no-cache)\s*(?:=|,|$)/i.test(policy ?? "")
	) {
		headers.set("Cache-Control", PRIVATE_CACHE_CONTROL)
		headers.delete(CACHE_IDENTITY_HEADER)
		const vary = (headers.get("Vary") ?? "")
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value && !/^(Cookie|Accept-Language)$/i.test(value))
		if (vary.length) headers.set("Vary", vary.join(", "))
		else headers.delete("Vary")
		return "private"
	}
	if (policy === null) return "unset"
	headers.set(
		"Cache-Control",
		identity.keyFromCache
			? SHARED_PAGE_CACHE_CONTROL
			: KEYED_PAGE_CACHE_CONTROL,
	)
	headers.set(
		"Vary",
		identity.keyFromCache ? CACHE_IDENTITY_HEADER : "Accept-Language",
	)
	headers.set(CACHE_IDENTITY_HEADER, identity.key)
	return identity.keyFromCache ? "shared" : "keyed"
}
