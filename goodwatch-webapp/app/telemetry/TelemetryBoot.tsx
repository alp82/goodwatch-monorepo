import { personProperties } from "./person-properties"
import {
	installProductInteractions,
	setAnalyticsUser,
} from "./product-analytics"
import { useLocation, useMatches, useNavigationType } from "@remix-run/react"
import { useEffect, useRef } from "react"
import { useUser } from "~/utils/auth"
import {
	setTelemetryMember,
	startTelemetry,
	telemetryLocationChanged,
	telemetryRouteChanged,
	withPostHog,
} from "./telemetry"

const NAVIGATION_TYPES = {
	PUSH: "pushState",
	REPLACE: "replaceState",
	POP: "popstate",
} as const

/**
 * Starts analytics and error tracking for the document it is rendered in, and keeps them informed about the route and
 * the signed-in member. Its effects run after hydration, which is the first condition of the loading rule.
 */
export function TelemetryBoot({ faststatsSiteKey }: { faststatsSiteKey?: string }) {
	const { user } = useUser()
	const location = useLocation()
	const matches = useMatches()
	const navigationType = useNavigationType()
	const identified = useRef(false)

	// Runs after the new route is on the page, so the document title is the new route's. PostHog's scroll record
	// still holds the old page (the scroll reset reaches it with the next scroll event), so the page view carries the
	// previous page's scroll depth.
	useEffect(() => {
		const routeId = matches[matches.length - 1]?.id
		if (routeId) telemetryRouteChanged(routeId)
		telemetryLocationChanged({
			href: window.location.href,
			title: document.title,
			navigationType: NAVIGATION_TYPES[navigationType],
		})
	}, [location])

	useEffect(() => {
		setAnalyticsUser(user?.id ?? null)
		installProductInteractions()
		setTelemetryMember(Boolean(user))
		startTelemetry(faststatsSiteKey)
		// The call waits until PostHog has loaded, so a sign-in before that point is still identified.
		withPostHog((posthog) => {
			if (!user) {
				if (identified.current) {
					posthog.reset()
					identified.current = false
				}
				return
			}

			// Link the legacy email identity before switching to the immutable account ID.
			if (posthog.get_distinct_id() === user.email)
				posthog.alias(user.id, user.email)
			posthog.identify(user.id, personProperties(user))

			identified.current = true
		})
	}, [user, faststatsSiteKey])

	return null
}
