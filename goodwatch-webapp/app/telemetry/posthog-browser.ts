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
import {
	type PageView,
	applyPageViewOverrides,
	navigationPageviewProperties,
	pageViewTitle,
} from "./page-views"
import { anonymousRecordingBlocked } from "./recording-share"
import { createScrollDepth } from "./scroll-depth"

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

// How long a new page waits for the scroll back to the top to end, in a browser without the `scrollend` event or
// on a page that was at the top already (no scroll, so no event).
const SCROLL_SETTLE_MS = 1500

/** Gives PostHog a scroll record that starts again with every page view. See scroll-depth.ts for why. */
function keepScrollDepthPerPage(): void {
	const depth = createScrollDepth()
	const measured = () => {
		const root = document.documentElement
		return {
			scrollY: window.scrollY || root.scrollTop || 0,
			scrollHeight: root.scrollHeight,
			clientHeight: root.clientHeight,
		}
	}
	let settleTimer: ReturnType<typeof setTimeout> | undefined
	const settle = () => {
		clearTimeout(settleTimer)
		depth.settle(measured())
	}
	// The same events PostHog listens to. `capture` also reports scrolling inside an element of the page.
	const options = { capture: true, passive: true }
	window.addEventListener("scroll", () => depth.update(measured()), options)
	window.addEventListener("scrollend", settle, options)
	window.addEventListener("resize", () => depth.update(measured()), {
		passive: true,
	})
	const manager = posthog.scrollManager
	manager.getContext = () => depth.get()
	manager.resetContext = () => {
		const previous = depth.reset()
		clearTimeout(settleTimer)
		settleTimer = setTimeout(settle, SCROLL_SETTLE_MS)
		return previous
	}
}

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
		before_send: (event) =>
			tagRoute(redactSearchTelemetry(applyPageViewOverrides(event))),
		capture_performance: WEB_VITALS_CAPTURE,
		// The page sends its own page views: the landing page view below, with the values of the page load, and one per
		// navigation inside the app (`capturePageView`). PostHog's `history_change` mode can't report a navigation made
		// before it loaded, and it would send its own landing page view. Page leave events stay on.
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

	keepScrollDepthPerPage()

	posthog.capture(
		"$pageview",
		{
			...pageViewTitle(landingTitle),
			...landingPageviewProperties(landing, window.location.href),
		},
		{ timestamp: new Date(landing.time), send_instantly: true },
	)
}

/**
 * A page view for a navigation inside the app. PostHog attaches the time on the previous page and its scroll depth
 * (`$prev_pageview_*`) to this event, and starts counting both again for the new page.
 */
export function capturePageView(view: PageView): void {
	posthog.capture("$pageview", navigationPageviewProperties(view), {
		timestamp: new Date(view.time),
	})
}

/** A member is recorded by the project settings, whatever the anonymous share says. */
export function allowRecordingForMember(): void {
	if (!recordingBlocked) return
	recordingBlocked = false
	posthog.startSessionRecording()
}
