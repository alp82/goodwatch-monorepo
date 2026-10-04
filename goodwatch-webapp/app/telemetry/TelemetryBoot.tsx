import { useLocation, useMatches } from "@remix-run/react"
import { useEffect, useRef } from "react"
import { useUser } from "~/utils/auth"
import {
	setTelemetryMember,
	startTelemetry,
	telemetryRouteChanged,
	withPostHog,
} from "./telemetry"

/**
 * Starts analytics and error tracking for the document it is rendered in, and keeps them informed about the route and
 * the signed-in member. Its effects run after hydration, which is the first condition of the loading rule.
 */
export function TelemetryBoot() {
	const { user } = useUser()
	const location = useLocation()
	const matches = useMatches()
	const identified = useRef(false)

	useEffect(() => {
		const routeId = matches[matches.length - 1]?.id
		if (routeId) telemetryRouteChanged(routeId)
	}, [location])

	useEffect(() => {
		setTelemetryMember(Boolean(user))
		startTelemetry()
		// The call waits until PostHog has loaded, so a sign-in before that point is still identified.
		withPostHog((posthog) => {
			if (!user) {
				if (identified.current) {
					posthog.reset()
					identified.current = false
				}
				return
			}

			posthog.identify(user.email, user)

			posthog.capture("$set", {
				$set_once: { initial_login: new Date() },
			})

			posthog.capture("Pageview", {
				full_referrer: document.referrer,
			})

			identified.current = true
		})
	}, [user])

	return null
}
