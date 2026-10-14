// How many searches one visitor may start: a burst of 10 in 30 seconds and 60 in 10 minutes, counted per network
// address in Valkey, which the page instances and both search roles share (server/rate-limit.server.ts). The origin
// guard keeps other sites' pages out, but a script can send any header; this is the limit on scripts.
//
// - The address is the one the trusted ingress writes into SEARCH_TRUSTED_IP_HEADER (X-Real-Ip in production: abio's
//   proxy replaces whatever the visitor sent, and vector1's proxy keeps it for the search roles). IPv6 counts by its
//   /64, which one household or one phone gets. The counter's key holds a hash, never the address.
// - Without that header (not configured, or a request that didn't pass the proxy, like the smoke check's tunnel to
//   one container) nobody is limited: counting everyone as one visitor would stop search for the whole site.
// - Members count by their address like guests. Their account id isn't known before the session check, which is a
//   network call for each new cookie, and a cookie that isn't checked can be made up.
// - The heaviest real use in search history (to October 14, 2026) was 6 searches in 30 seconds and 37 in 10 minutes,
//   both by one member changing Discover's filters.
import { createHash } from "node:crypto"
import { isIP, isIPv4 } from "node:net"
import { counter } from "../metrics/registry.server.ts"
import { type RateWindow, rateLimiter } from "../rate-limit.server.ts"

export const SEARCH_RATE_WINDOWS: RateWindow[] = [
	{ limit: 10, seconds: 30 },
	{ limit: 60, seconds: 600 },
]
export const SEARCH_LIMITED_MESSAGE = "Too many searches right now. Try again in a moment."

const outcomes = counter(
	"goodwatch_search_rate_limit_total",
	"Searches checked against the per-visitor limit, by outcome and where the count was kept.",
	["outcome", "store"],
	6,
)

type Env = Record<string, string | undefined>

/** The visitor's address from the header the trusted ingress overwrites, or null without one. */
export function trustedClientAddress(request: Request, env: Env = process.env): string | null {
	const header = env.SEARCH_TRUSTED_IP_HEADER
	if (!header) return null
	const address = request.headers.get(header)?.trim()
	return address && isIP(address) ? address : null
}

/** The part of an address that counts as one visitor: an IPv4 address, or the /64 of an IPv6 address. */
export function visitorNetwork(address: string): string {
	const plain = address.split("%")[0].toLowerCase()
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(plain)?.[1]
	if (mapped || isIPv4(plain)) return mapped ?? plain
	// An IPv6 address with an IPv4 tail other than the mapped form is rare: it counts whole.
	if (plain.includes(".")) return plain
	const [head, tail] = plain.split("::")
	const front = head ? head.split(":") : []
	const back = tail ? tail.split(":") : []
	const groups =
		tail === undefined ? front : [...front, ...Array(8 - front.length - back.length).fill("0"), ...back]
	return `${groups.slice(0, 4).map((group) => Number.parseInt(group, 16).toString(16)).join(":")}::/64`
}

/** The 429 the search route answers a visitor over the limit with. */
export function searchLimitedResponse(retryAfterSeconds: number): Response {
	return new Response(JSON.stringify({ error: SEARCH_LIMITED_MESSAGE }), {
		status: 429,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "private, no-store",
			"Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	})
}

/** Counts the search against its visitor. Null when it may run, or the 429 to answer. */
export async function checkSearchRate(
	request: Request,
	options: { env?: Env; limiter?: Pick<typeof rateLimiter, "take"> } = {},
): Promise<Response | null> {
	const address = trustedClientAddress(request, options.env)
	if (!address) {
		outcomes.inc(["unkeyed", "none"])
		return null
	}
	const client = createHash("sha256").update(visitorNetwork(address)).digest("hex").slice(0, 32)
	const verdict = await (options.limiter ?? rateLimiter).take("search-rate", client, SEARCH_RATE_WINDOWS)
	outcomes.inc([verdict.allowed ? "allowed" : "limited", verdict.store])
	return verdict.allowed ? null : searchLimitedResponse(verdict.retryAfterSeconds)
}
