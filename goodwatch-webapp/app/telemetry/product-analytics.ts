import { withPostHog } from "./telemetry"
import {
	INTERNAL_USER_IDS,
	discoveryProperties,
	productProperties,
	type EventProperties,
	type ProductEvent,
} from "./product-events"

let userId: string | null = null
export function setAnalyticsUser(id: string | null) {
	userId = id
}
export function analyticsUserProperties() {
	return {
		user_id: userId,
		is_guest: !userId,
		is_internal: userId ? INTERNAL_USER_IDS.has(userId) : false,
	}
}
export function captureProductEvent(
	event: ProductEvent,
	properties: EventProperties = {},
	identity: string | null = userId,
) {
	if (
		typeof window === "undefined" ||
		!window.location ||
		/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
	)
		return
	const timestamp = new Date()
	const props = {
		...discoveryProperties(new URLSearchParams(window.location.search)),
		source: window.location.pathname.split("/")[1] || "home",
		...productProperties(properties),
		user_id: identity,
		is_guest: !identity,
		is_internal: identity ? INTERNAL_USER_IDS.has(identity) : false,
		origin: properties.origin ?? "manual",
		schema_version: 1,
		environment:
			window.location.hostname === "goodwatch.app" ? "production" : "preview",
	}
	withPostHog((posthog) => posthog.capture(event, props, { timestamp }))
}
/** Use on every mutation request to connect confirmed server outcomes to the browser session. */
export function productAnalyticsHeaders(): Record<string, string> {
	// Cookie/session context is available even before the deferred SDK has loaded; no SDK import here.
	return {
		...(sessionId ? { "X-POSTHOG-SESSION-ID": sessionId } : {}),
		"X-GOODWATCH-ANALYTICS": JSON.stringify({
			...discoveryProperties(new URLSearchParams(window.location.search)),
			...interactionContext,
		}),
	}
}
let sessionId: string | undefined
export function setAnalyticsSession(id: string | undefined) {
	sessionId = id
}

export function productAnalyticsFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
) {
	if (typeof window === "undefined" || !window.location)
		return fetch(input, init)
	const headers = new Headers(
		input instanceof Request ? input.headers : undefined,
	)
	new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
	const url = new URL(
		input instanceof Request ? input.url : String(input),
		window.location.href,
	)
	if (url.origin === window.location.origin)
		for (const [key, value] of Object.entries(productAnalyticsHeaders()))
			headers.set(key, value)
	return fetch(input, { ...init, headers })
}

let interactionContext: EventProperties = {}
let listening = false
/** Delegation covers links rendered later and keyboard activation without importing an SDK into cards. */
export function installProductInteractions() {
	if (listening || typeof document === "undefined") return
	listening = true
	document.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return
			interactionContext = {
				result_position:
					Number(
						event.target.closest<HTMLElement>("[data-result-position]")?.dataset
							.resultPosition,
					) || undefined,
			}
			const element = event.target.closest<HTMLElement>(
				"[data-product-event],a[href]",
			)
			if (!element) return
			const data = element.dataset
			if (data.productEvent === "streaming service clicked") {
				captureProductEvent("streaming service clicked", {
					tmdb_id: Number(data.tmdbId),
					media_type: data.mediaType,
					provider_id: Number(data.providerId),
					country: data.country,
					offer_type: data.offerType,
				})
				return
			}
			if (!(element instanceof HTMLAnchorElement)) return
			const url = new URL(element.href, window.location.href)
			const match = url.pathname.match(/^\/(movie|show)\/(\d+)/)
			if (url.origin === window.location.origin && match)
				captureProductEvent("title opened", {
					media_type: match[1],
					tmdb_id: Number(match[2]),
					result_position:
						Number(
							element.closest<HTMLElement>("[data-result-position]")?.dataset
								.resultPosition,
						) || undefined,
				})
		},
		{ capture: true },
	)
}
let previousFilters = ""
export function trackDiscoveryNavigation(href: string) {
	const url = new URL(href)
	if (!url.pathname.startsWith("/discover")) {
		previousFilters = ""
		return
	}
	const properties = discoveryProperties(url.searchParams)
	const signature = JSON.stringify(properties)
	if (previousFilters && signature !== previousFilters)
		captureProductEvent("discovery filters changed", properties)
	previousFilters = signature
}
