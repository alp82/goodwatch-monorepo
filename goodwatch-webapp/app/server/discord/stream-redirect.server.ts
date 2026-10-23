// /go/stream/<media>/<tmdbId>/<providerId>?country=DE: the short link a Discord service button uses when the offer's
// own link is longer than Discord's 512 characters. It reads the title's offers again (the card's cached guest read)
// and redirects only to a link those offers hold for that service, so it can never send anyone elsewhere.
import { createHash } from "node:crypto"
import { FALLBACK_COUNTRY } from "../cache-identity.server.ts"
import type { RateVerdict, RateWindow } from "../rate-limit.server.ts"
import type { readGuestTool } from "../mcp/guest.server.ts"
import { providerFamily } from "../mcp/watch-links.ts"
import { titlePath } from "../../utils/helpers.ts"
import { PROVIDER_ALIASES } from "./provider-aliases.ts"
import {
	cachedTitleRead,
	valkeyTitleStore,
	type CacheStore,
} from "./title-cache.server.ts"

const headers = {
	"Cache-Control": "no-store",
	"X-Robots-Tag": "noindex, nofollow",
	"Referrer-Policy": "no-referrer",
}

/** 60 presses a minute per visitor network: far above a person's use, low enough to stop a script reading the catalog. */
export const STREAM_RATE_WINDOWS: RateWindow[] = [{ limit: 60, seconds: 60 }]

export interface StreamRedirectDependencies {
	read: typeof readGuestTool
	store: () => Promise<CacheStore | null>
	take: (
		name: string,
		client: string,
		windows: RateWindow[],
	) => Promise<RateVerdict>
}

const defaults: StreamRedirectDependencies = {
	read: async (...args) =>
		(await import("../mcp/guest.server.ts")).readGuestTool(...args),
	store: valkeyTitleStore,
	take: async (...args) =>
		(await import("../rate-limit.server.ts")).rateLimiter.take(...args),
}

/**
 * The hashed network of the visitor, from the header the trusted ingress overwrites (the same key search uses), or null
 * without one: counting every unproxied request as one visitor would block the links for everyone.
 */
export async function streamClientKey(
	request: Request,
): Promise<string | null> {
	const { trustedClientAddress, visitorNetwork } = await import(
		"../search-runtime/rate-limit.server.ts"
	)
	const address = trustedClientAddress(request)
	return address
		? createHash("sha256")
				.update(visitorNetwork(address))
				.digest("hex")
				.slice(0, 32)
		: null
}

const httpUrl = (value: unknown) => {
	if (typeof value !== "string") return null
	try {
		return ["http:", "https:"].includes(new URL(value).protocol) ? value : null
	} catch {
		return null
	}
}

/** The same service: one ID, the catalog's duplicate IDs, or the card's verified channels and tiers. */
const root = (id: number) => PROVIDER_ALIASES.get(id)?.id ?? id
const sameService = (a: number, b: number) =>
	a === b || providerFamily(a).includes(b) || root(a) === root(b)

const notFound = () =>
	new Response("This streaming link is not available.", {
		status: 404,
		headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
	})

export async function streamRedirect(
	params: { media?: string; tmdbId?: string; providerId?: string },
	url: URL,
	overrides: Partial<StreamRedirectDependencies> = {},
	client: string | null = null,
): Promise<Response> {
	const deps = { ...defaults, ...overrides }
	const { media = "", tmdbId = "", providerId = "" } = params
	if (
		!["movie", "show"].includes(media) ||
		!/^[1-9]\d{0,9}$/.test(tmdbId) ||
		!/^[1-9]\d{0,6}$/.test(providerId)
	)
		return notFound()
	// Counted before the catalog read; a limiter that fails lets the press through.
	if (client) {
		const verdict = await deps
			.take("discord-stream", client, STREAM_RATE_WINDOWS)
			.catch(() => null)
		if (verdict && !verdict.allowed)
			return new Response(
				"Too many streaming links opened. Try again in a minute.",
				{
					status: 429,
					headers: {
						...headers,
						"Content-Type": "text/plain; charset=utf-8",
						"Retry-After": String(
							Math.max(1, Math.ceil(verdict.retryAfterSeconds)),
						),
					},
				},
			)
	}
	const asked = (url.searchParams.get("country") ?? "").toUpperCase()
	const country = /^[A-Z]{2}$/.test(asked) ? asked : FALLBACK_COUNTRY
	const id = `${media}:${tmdbId}`
	// Every service in the country, so a link from a server with chosen services is found too.
	const place = { country, services: [] as number[] }
	let result: Record<string, unknown>
	try {
		const store = await deps.store().catch(() => null)
		result = await cachedTitleRead(
			id,
			place,
			() =>
				deps.read(place, "https://goodwatch.app", "get_title", {
					title_id: id,
				}),
			store,
		)
	} catch {
		return new Response("Streaming links are unavailable. Try again soon.", {
			status: 503,
			headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
		})
	}
	const title = result.title as
		| {
				name?: string
				availability?: {
					offers?: { service_id?: number; url?: unknown; offer_type?: string }[]
				}
		  }
		| undefined
	if (!title) return notFound()
	const service = Number(providerId)
	const offers = (title.availability?.offers ?? []).filter((o) =>
		["flatrate", "free", "ads"].includes(o.offer_type ?? ""),
	)
	const target =
		offers
			.filter((o) => o.service_id === service)
			.map((o) => httpUrl(o.url))
			.find(Boolean) ??
		offers
			.filter(
				(o) => o.service_id !== undefined && sameService(o.service_id, service),
			)
			.map((o) => httpUrl(o.url))
			.find(Boolean)
	// The service no longer offers it here: the title page's where-to-watch section shows what does.
	const location =
		target ??
		`${titlePath(media, Number(tmdbId), String(title.name ?? "").slice(0, 120))}#streaming`
	return new Response(null, {
		status: 302,
		headers: { ...headers, Location: location },
	})
}
