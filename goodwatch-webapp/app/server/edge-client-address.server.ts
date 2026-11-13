// Puts the visitor's address back into X-Real-Ip and X-Forwarded-For when a request came through GoodWatch's own
// Cloudflare zone, before any part of the app reads them (docs/cloudflare-proxy-cutover.md).
//
// Why: abio's proxy overwrites both headers with the address that connected to it, and it doesn't trust Cloudflare for
// forwarded headers. Once goodwatch.app is proxied, that address is a Cloudflare edge, so every limit that counts by
// address (search, person pages, the auth endpoints, poster impressions, hot cards, feedback) would put thousands of
// visitors on a handful of edge addresses. Cloudflare sends the visitor's address in CF-Connecting-IP.
//
// A request counts as coming through GoodWatch's zone when both hold:
// - The connecting address, X-Real-Ip as abio's proxy wrote it, is in Cloudflare's published ranges. abio's proxy
//   must keep overwriting that header: don't add Cloudflare's ranges to its forwardedHeaders.trustedIPs (for a trusted
//   peer Traefik keeps an X-Real-Ip that arrived with the request). vector1's proxy trusts abio and keeps the header,
//   so the instance and search roles there see the same.
// - GW-Edge-Key carries one of the keys in EDGE_ORIGIN_KEYS. A request header transform rule in the zone sets it on
//   every proxied request, overwriting anything the visitor sent. The ranges alone aren't enough: someone else's
//   Worker reaches the origin from the same ranges, and can choose CF-Connecting-IP.
// Then X-Real-Ip and X-Forwarded-For become CF-Connecting-IP. In every other case CF-Connecting-IP and True-Client-IP
// are removed, so nobody can name their own address through them, and nothing else changes. GW-Edge-Key is always
// removed, from `headers` and the raw list, so the key never reaches the app, its logs or its caches.
//
// Without EDGE_ORIGIN_KEYS nothing is restored: behind Cloudflare, the limits would count edges. Set it before the
// flip. Keys are comma-separated (two during a rotation), at least 32 characters each.
//
// The ranges are Cloudflare's published lists (https://www.cloudflare.com/ips-v4 and /ips-v6), read on November 13,
// 2026. Cloudflare announces changes ahead; the cut-over doc says what else to update with them.
//
// Settings: EDGE_ORIGIN_KEYS (see above); EDGE_CLIENT_ADDRESS=off stops the address rewriting (the key header is
// still removed). The metric goodwatch_edge_client_address_total counts the outcomes.
import { createHash, timingSafeEqual } from "node:crypto"
import { subscribe } from "node:diagnostics_channel"
import type { IncomingHttpHeaders, IncomingMessage } from "node:http"
import { BlockList, isIPv4 } from "node:net"
import { counter } from "./metrics/registry.server.ts"
import { canonicalAddress } from "./search-bot-verification.server.ts"

export const CLOUDFLARE_RANGES = [
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
] as const

const cloudflare = new BlockList()
for (const range of CLOUDFLARE_RANGES) {
	const [network, prefix] = range.split("/")
	cloudflare.addSubnet(
		network,
		Number(prefix),
		isIPv4(network) ? "ipv4" : "ipv6",
	)
}

// Headers only Cloudflare may set. Removed from requests that didn't come through the zone.
const EDGE_HEADERS = ["cf-connecting-ip", "true-client-ip"] as const
export const EDGE_KEY_HEADER = "gw-edge-key"
const MIN_KEY_LENGTH = 32

const single = (value: string | string[] | undefined) =>
	typeof value === "string" ? canonicalAddress(value.trim()) : null

const digest = (value: string) => createHash("sha256").update(value).digest()

/** Whether an address belongs to Cloudflare's published ranges. */
export function isCloudflareAddress(raw: string): boolean {
	const address = canonicalAddress(raw.trim())
	if (!address) return false
	return cloudflare.check(address, isIPv4(address) ? "ipv4" : "ipv6")
}

/** The usable keys of an EDGE_ORIGIN_KEYS value, as digests. Shorter keys are ignored. */
export function edgeKeys(setting: string | undefined): Buffer[] {
	return (setting ?? "")
		.split(",")
		.map((key) => key.trim())
		.filter((key) => key.length >= MIN_KEY_LENGTH)
		.map(digest)
}

const keyMatches = (value: string | string[] | undefined, keys: Buffer[]) => {
	if (typeof value !== "string" || !keys.length) return false
	const given = digest(value)
	let match = false
	for (const key of keys) match = timingSafeEqual(given, key) || match
	return match
}

export type EdgeOutcome =
	| "cloudflare"
	| "unkeyed"
	| "invalid"
	| "direct"
	| "unknown"

/**
 * Rewrites the request's address headers in place and removes the key header. Returns what it found: `cloudflare`
 * (headers now name the visitor), `unkeyed` (a Cloudflare address without a valid key: another account's Worker, or a
 * key mismatch), `invalid` (through the zone, but no single valid CF-Connecting-IP), `direct` (not from Cloudflare) or
 * `unknown` (no single connecting address). Only `cloudflare` changes X-Real-Ip and X-Forwarded-For; every other
 * outcome removes CF-Connecting-IP and True-Client-IP.
 */
export function restoreClientAddress(
	headers: IncomingHttpHeaders,
	keys: Buffer[],
): EdgeOutcome {
	const peer = single(headers["x-real-ip"])
	const fromCloudflare =
		peer !== null && cloudflare.check(peer, isIPv4(peer) ? "ipv4" : "ipv6")
	const keyed = fromCloudflare && keyMatches(headers[EDGE_KEY_HEADER], keys)
	Reflect.deleteProperty(headers, EDGE_KEY_HEADER)
	const visitor = keyed ? single(headers["cf-connecting-ip"]) : null
	if (!visitor) {
		for (const name of EDGE_HEADERS) Reflect.deleteProperty(headers, name)
		if (!peer) return "unknown"
		if (!fromCloudflare) return "direct"
		return keyed ? "invalid" : "unkeyed"
	}
	headers["x-real-ip"] = visitor
	headers["x-forwarded-for"] = visitor
	headers["cf-connecting-ip"] = visitor
	Reflect.deleteProperty(headers, "true-client-ip")
	return "cloudflare"
}

/**
 * Removes headers from the request's other representations: the raw list and `headersDistinct`. Node builds
 * `headersDistinct` lazily from the raw list with the original count, so it's built (and cleaned) first, then the raw
 * list is shortened. Only requests that carry one of the names pay for this.
 */
export function dropOtherRepresentations(
	request: Pick<IncomingMessage, "rawHeaders" | "headersDistinct">,
	names: readonly string[],
): void {
	const raw = request.rawHeaders
	let found = false
	for (let i = 0; i < raw.length && !found; i += 2)
		found = names.includes(raw[i].toLowerCase())
	if (!found) return
	const distinct = request.headersDistinct
	for (const name of names) Reflect.deleteProperty(distinct, name)
	for (let i = raw.length - 2; i >= 0; i -= 2)
		if (names.includes(raw[i].toLowerCase())) raw.splice(i, 2)
}

const outcomes = counter(
	"goodwatch_edge_client_address_total",
	"Requests by how their client address was found: restored from Cloudflare (cloudflare), Cloudflare without the zone key (unkeyed), keyed without a valid visitor address (invalid), direct, or unknown.",
	["outcome"],
	6,
)

/**
 * What one request goes through, in place: the key header leaves every representation of the request, and unless
 * `restore` is false, the address headers are rewritten.
 */
export function sanitizeRequest(
	request: Pick<IncomingMessage, "headers" | "rawHeaders" | "headersDistinct">,
	keys: Buffer[],
	restore: boolean,
): EdgeOutcome | null {
	// `headers` is built from the raw list on first read, so read it before the raw list loses the key.
	const headers = request.headers
	if (!restore) {
		dropOtherRepresentations(request, [EDGE_KEY_HEADER])
		Reflect.deleteProperty(headers, EDGE_KEY_HEADER)
		return null
	}
	const outcome = restoreClientAddress(headers, keys)
	dropOtherRepresentations(
		request,
		outcome === "cloudflare"
			? [EDGE_KEY_HEADER, "true-client-ip"]
			: [EDGE_KEY_HEADER, ...EDGE_HEADERS],
	)
	return outcome
}

let started = false

/**
 * Before the server's request listeners run, once per process: removes the key header from every request, and
 * rewrites the address headers unless EDGE_CLIENT_ADDRESS is off.
 */
export function startEdgeClientAddress(): void {
	if (started) return
	started = true
	const restore = process.env.EDGE_CLIENT_ADDRESS !== "off"
	const keys = edgeKeys(process.env.EDGE_ORIGIN_KEYS)
	if (restore && !keys.length)
		console.warn(
			`EDGE_ORIGIN_KEYS has no key of at least ${MIN_KEY_LENGTH} characters: visitor addresses behind Cloudflare are not restored`,
		)
	// Node publishes this before it emits "request", so the shedder, page cache, browser gate and Remix all see the
	// rewritten headers.
	subscribe("http.server.request.start", (message) => {
		const outcome = sanitizeRequest(
			(message as { request: IncomingMessage }).request,
			keys,
			restore,
		)
		if (outcome) outcomes.inc([outcome])
	})
}
