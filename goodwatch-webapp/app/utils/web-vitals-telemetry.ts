// Field Web Vitals go to PostHog as its own `$web_vitals` events (LCP, INP, CLS and FCP). This module adds what those
// events lack for a per-route report:
// - `route_pattern`: the route that served the page, for example `/movie/:movieKey`, on every event that has a path.
// - `landing_route_pattern`: on `$web_vitals`, the route the browser loaded from the server. LCP, FCP and TTFB always
//   describe that page load. CLS and INP keep counting across in-app navigation and are sent when the page is hidden,
//   so their `route_pattern` is the last route the visitor was on.
// - `ttfb_ms`: time to first byte of the page load, from Navigation Timing. It rides on the event that carries FCP,
//   which exists once per page load, so a percentile over it counts every page load once.
// PostHog already attaches `$device_type` (Mobile, Tablet, Desktop) to every event.
import {
	type ManifestRoute,
	type RoutePatternMatcher,
	createRoutePatternMatcher,
} from "./route-pattern.ts"

/** The route label for a path that no route serves. */
export const UNMATCHED_ROUTE = "unmatched"

/** `posthog.init` option. Stated in code so that the capture doesn't depend on a project setting alone. */
export const WEB_VITALS_CAPTURE = { web_vitals: true } as const

/** The page load the browser made: its path and its time to first byte, when the browser reports one. */
export interface Landing {
	pathname: string
	ttfbMs: number | null
}

interface TelemetryEvent {
	event?: string
	properties?: Record<string, unknown>
}

/**
 * Returns a `before_send` step that adds the route properties. It answers the same reference when it has nothing to
 * add, and never throws: telemetry must not break on an odd event.
 */
export function createRouteTagger(
	patternOf: RoutePatternMatcher,
	landing: Landing | null,
) {
	const landingPattern = landing
		? (patternOf(landing.pathname) ?? UNMATCHED_ROUTE)
		: null
	// Most events in a row come from the same page.
	let lastPathname: string | undefined
	let lastPattern = UNMATCHED_ROUTE

	return <T>(input: T): T => {
		const event = input as TelemetryEvent | null
		const pathname = event?.properties?.$pathname
		if (!event || typeof pathname !== "string") return input
		if (pathname !== lastPathname) {
			lastPattern = patternOf(pathname) ?? UNMATCHED_ROUTE
			lastPathname = pathname
		}
		const added: Record<string, unknown> = { route_pattern: lastPattern }
		if (event.event === "$web_vitals" && landing && landingPattern) {
			added.landing_route_pattern = landingPattern
			const isLandingPage = pathname === landing.pathname
			const hasFcp = event.properties?.$web_vitals_FCP_value !== undefined
			if (isLandingPage && hasFcp && landing.ttfbMs !== null)
				added.ttfb_ms = landing.ttfbMs
		}
		return { ...event, properties: { ...event.properties, ...added } } as T
	}
}

/**
 * Reads the page load from the browser. `null` outside a browser. Pass the pathname of the page load when the caller
 * runs later than the load: the visitor can be on another page of the app by then.
 */
export function readLanding(landingPathname?: string): Landing | null {
	if (typeof window === "undefined") return null
	let ttfbMs: number | null = null
	try {
		const [navigation] = performance.getEntriesByType(
			"navigation",
		) as PerformanceNavigationTiming[]
		// A prerendered or restored page reports its start later than the request; such a load has no honest TTFB.
		const activationStart =
			(navigation as { activationStart?: number } | undefined)
				?.activationStart ?? 0
		if (navigation && navigation.responseStart > 0 && activationStart === 0)
			ttfbMs = Math.round(navigation.responseStart)
	} catch {
		// An old browser without Navigation Timing sends no TTFB.
	}
	return { pathname: landingPathname ?? window.location.pathname, ttfbMs }
}

/**
 * The `before_send` step for this browser: route patterns from the manifest Remix put on the page.
 * `landingPathname` is the pathname of the page load, for a caller that runs later than the load.
 */
export function browserRouteTagger(landingPathname?: string) {
	const manifest =
		typeof window === "undefined"
			? undefined
			: (
					window as unknown as {
						__remixManifest?: { routes?: Record<string, ManifestRoute> }
					}
				).__remixManifest?.routes
	if (!manifest) return <T>(event: T): T => event
	const tag = createRouteTagger(
		createRoutePatternMatcher(manifest),
		readLanding(landingPathname),
	)
	return <T>(event: T): T => {
		try {
			return tag(event)
		} catch {
			return event
		}
	}
}
