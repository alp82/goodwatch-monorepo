// PostHog for the browser. Only telemetry.ts imports this module, with a dynamic import, so the SDK stays out of the
// scripts a page needs to become interactive.
import posthog from "posthog-js"
import { redactSearchTelemetry } from "~/utils/search-telemetry"
import {
	WEB_VITALS_CAPTURE,
	browserRouteTagger,
} from "~/utils/web-vitals-telemetry"
import { POSTHOG_ANONYMOUS_SESSION_RECORDING_SHARE } from "./config"
import { type LandingSnapshot, landingPageviewProperties } from "./early"
import { anonymousRecordingBlocked } from "./recording-share"

export { posthog }

const SAMPLE_KEY = "gw_recording_sample"

// One draw per browser session, so a visitor is in or out of the share on every page.
function recordingSample(): number {
	try {
		const stored = Number.parseFloat(sessionStorage.getItem(SAMPLE_KEY) ?? "")
		if (stored >= 0 && stored < 1) return stored
		const drawn = Math.random()
		sessionStorage.setItem(SAMPLE_KEY, String(drawn))
		return drawn
	} catch {
		return Math.random()
	}
}

let recordingBlocked = false

export function startPostHog({
	landing,
	landingTitle,
	isMember,
}: {
	landing: LandingSnapshot
	/** The title of the page the browser loaded. */
	landingTitle: string
	isMember: boolean
}): void {
	recordingBlocked =
		!isMember &&
		anonymousRecordingBlocked(
			POSTHOG_ANONYMOUS_SESSION_RECORDING_SHARE,
			recordingSample,
		)

	// Web Vitals (LCP, INP, CLS, FCP) are PostHog's own `$web_vitals` events. The tagger adds the route pattern and
	// the time to first byte, so the report can group by route instead of by URL. The browser keeps the entries of the
	// page load for observers that start late, so loading after the page is interactive doesn't lose them.
	const tagRoute = browserRouteTagger(new URL(landing.href).pathname)
	posthog.init("phc_RM4XKAExwoQJUw6LoaNDUqCPLXuFLN6lPWybGsbJASq", {
		// api_host: 'https://eu.i.posthog.com',
		api_host: "https://a.goodwatch.app",
		before_send: (event) => tagRoute(redactSearchTelemetry(event)),
		capture_performance: WEB_VITALS_CAPTURE,
		// The landing page view is sent below, with the values of the page load. Page leave events stay on.
		capture_pageview: false,
		capture_pageleave: true,
		disable_session_recording: recordingBlocked,
		session_recording: {
			blockSelector: ".search-private",
			maskTextSelector: ".search-private",
		},
		persistence: "localStorage+cookie",
		person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
	})

	posthog.capture(
		"$pageview",
		{
			title: landingTitle,
			...landingPageviewProperties(landing, window.location.href),
		},
		{ timestamp: new Date(landing.time), send_instantly: true },
	)
}

/** A member is recorded by the project settings, whatever the anonymous share says. */
export function allowRecordingForMember(): void {
	if (!recordingBlocked) return
	recordingBlocked = false
	posthog.startSessionRecording()
}
