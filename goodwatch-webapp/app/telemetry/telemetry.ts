// The page's one door to analytics and error tracking (PostHog, Sentry, the Google tag). The tools load after the page
// is interactive, so nothing here imports an SDK statically. Calls made before a tool loaded wait in a queue.
import type { PostHog } from "posthog-js"
import { TELEMETRY_LOAD } from "./config"
import { readEarlyTelemetry } from "./early"
import { loadGoogleTag } from "./google-tag"
import {
	type LoadReason,
	browserLoadTriggerEnv,
	whenPageIsInteractive,
} from "./load-trigger"
import { createReadyQueue } from "./ready-queue"

type PostHogModule = typeof import("./posthog-browser")
type SentryModule = typeof import("./sentry-browser")

interface State {
	started: boolean
	isMember: boolean
	landingTitle: string
	hydratedAt: number | null
	landingRouteId: string | null
	currentRouteId: string | null
	posthogModule: PostHogModule | null
	posthogReady: boolean
	sentry: SentryModule | null
	boundaryErrors: unknown[]
}

const state: State = {
	started: false,
	isMember: false,
	landingTitle: "",
	hydratedAt: null,
	landingRouteId: null,
	currentRouteId: null,
	posthogModule: null,
	posthogReady: false,
	sentry: null,
	boundaryErrors: [],
}

// Calls for PostHog, such as identifying a member, wait here until it has loaded.
const posthogCalls = createReadyQueue<PostHog>((error) =>
	console.error("PostHog call failed", error),
)

const MAX_QUEUED_BOUNDARY_ERRORS = 10

const isLocalhost = () =>
	window.location.hostname === "localhost" ||
	window.location.hostname === "127.0.0.1"

// A task boundary between the tools, so that their start-up work doesn't add up to one long task.
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function loadTools(reason: LoadReason) {
	const early = readEarlyTelemetry(window)
	;(window as unknown as { __gwTelemetryLoad?: string }).__gwTelemetryLoad =
		reason

	// PostHog first: the page view is what a short visit loses.
	try {
		const module = await import("./posthog-browser")
		state.posthogModule = module
		// Local development sends no analytics.
		if (!isLocalhost()) {
			module.startPostHog({
				landing: early.landing,
				landingTitle: state.landingTitle,
				isMember: state.isMember,
			})
			state.posthogReady = true
			posthogCalls.ready(module.posthog)
		}
	} catch (error) {
		console.error("PostHog failed to load", error)
	}

	await nextTask()
	try {
		const module = await import("./sentry-browser")
		module.startSentry({
			early,
			posthog: state.posthogModule?.posthog ?? null,
			landingRouteId: state.landingRouteId,
			currentRouteId: state.currentRouteId,
			hydratedAt: state.hydratedAt,
		})
		state.sentry = module
		const errors = state.boundaryErrors.splice(0, state.boundaryErrors.length)
		for (const error of errors) module.sentryBoundaryError(error)
	} catch (error) {
		console.error("Sentry failed to load", error)
	}

	await nextTask()
	loadGoogleTag()
}

/** Arms the loading trigger. Call it after hydration; later calls do nothing. */
export function startTelemetry(): void {
	if (state.started || typeof window === "undefined") return
	state.started = true
	state.landingTitle = document.title
	state.hydratedAt = Date.now()
	whenPageIsInteractive(
		(reason) => void loadTools(reason),
		browserLoadTriggerEnv(window),
		TELEMETRY_LOAD,
	)
}

/**
 * Runs `call` with PostHog: now when it has loaded, or when it loads. Calls run in the order they were made.
 * On localhost PostHog never starts and the call is dropped.
 */
export function withPostHog(call: (posthog: PostHog) => void): void {
	posthogCalls.run(call)
}

/** Tells the tools whether the visitor is signed in. */
export function setTelemetryMember(isMember: boolean): void {
	state.isMember = isMember
	if (isMember && state.posthogReady)
		state.posthogModule?.allowRecordingForMember()
}

/** Reports the route the visitor is on. The first call names the landing route. */
export function telemetryRouteChanged(routeId: string): void {
	const isLanding = state.landingRouteId === null
	if (isLanding) state.landingRouteId = routeId
	state.currentRouteId = routeId
	if (!isLanding) state.sentry?.sentryRouteChanged(routeId)
}

/** Reports an error that reached a route's error boundary. */
export function reportBoundaryError(error: unknown): void {
	if (typeof window === "undefined") return
	if (state.sentry) {
		state.sentry.sentryBoundaryError(error)
		return
	}
	if (
		state.boundaryErrors.length < MAX_QUEUED_BOUNDARY_ERRORS &&
		!state.boundaryErrors.includes(error)
	)
		state.boundaryErrors.push(error)
}
