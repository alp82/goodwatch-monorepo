import {
	BROWSE_EDGE_HEADER,
	BROWSE_EDGE_PATH,
	BROWSE_EDGE_QUERY,
	BROWSE_EDGE_VARIANT,
} from "../utils/browse-edge.ts"
import { cacheIdentity, pageLifetime, type CacheDecision } from "./cache-identity.server.ts"

export function browseGeneration(commit: string | undefined, assetBase: string) {
	if (!commit || !/^[0-9a-f]{40}$/.test(commit)) return null
	if (assetBase && assetBase !== "https://static.goodwatch.app") return null
	return commit + (assetBase ? ".static" : ".origin")
}

/** Only a subrequest through our zone, carrying the matching internal URL and header, gets the canonical route. */
export function canonicalBrowseTarget(
	url: string | undefined,
	marker: string | string[] | undefined,
	throughZone: boolean,
) {
	return (
		throughZone &&
		typeof marker === "string" &&
		BROWSE_EDGE_VARIANT.test(marker) &&
		url === BROWSE_EDGE_PATH + BROWSE_EDGE_QUERY + marker
	)
}

export function applyBrowseEdgePolicy(
	request: Request,
	headers: Headers,
	decision: CacheDecision,
	routePolicy: string | null,
	routeVary: string | null,
	generation: string | null,
) {
	const variant = request.headers.get(BROWSE_EDGE_HEADER)
	if (!variant) return
	// The client-side policy stays private. Cloudflare alone may store this internal URL.
	headers.set("Cloudflare-CDN-Cache-Control", "no-store")
	headers.set(BROWSE_EDGE_HEADER, "private")
	const identity = cacheIdentity(request)
	if (
		decision !== "keyed" ||
		request.method !== "GET" ||
		new URL(request.url).pathname !== BROWSE_EDGE_PATH ||
		request.headers.has("Authorization") ||
		request.headers.has("Proxy-Authorization") ||
		!["", "gw_browser=1"].includes(request.headers.get("Cookie") ?? "") ||
		!generation ||
		variant !== [generation, identity.country, identity.language].join(".") ||
		headers.has("Set-Cookie") ||
		(routeVary ?? "")
			.split(",")
			.some((field) => !/^(?:accept-encoding|accept-language)?$/i.test(field.trim()))
	)
		return
	const { fresh, stale } = pageLifetime(routePolicy)
	if (!fresh) return
	headers.set("Vary", "Accept-Encoding")
	headers.set(BROWSE_EDGE_HEADER, variant)
	headers.set(
		"Cloudflare-CDN-Cache-Control",
		`public, max-age=${Math.min(fresh, 60)}, stale-while-revalidate=${Math.min(stale, 120)}`,
	)
}
