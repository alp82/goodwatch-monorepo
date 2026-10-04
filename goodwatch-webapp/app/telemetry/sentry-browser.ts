// The Sentry SDK for the browser. Only telemetry.ts imports this module, with a dynamic import, so the SDK stays out
// of the scripts a page needs to become interactive.
import * as Sentry from "@sentry/remix"
import type { PostHog } from "posthog-js"
import { redactSearchTelemetry } from "~/utils/search-telemetry"
import {
	SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
	SENTRY_REPLAY_SESSION_SAMPLE_RATE,
	SENTRY_TRACES_SAMPLE_RATE,
} from "./config"
import { type EarlyTelemetry, drainEarlyErrors } from "./early"

const ROUTE_SOURCE = "route"

export interface SentryStart {
	early: EarlyTelemetry
	/** The PostHog module, when it loaded. Links Sentry errors to PostHog sessions. */
	posthog: PostHog | null
	/** The route id of the page the browser loaded, for example `routes/movie.$movieKey`. */
	landingRouteId: string | null
	/** The route id the visitor is on now. */
	currentRouteId: string | null
	/** When the page was hydrated, in milliseconds since the epoch. */
	hydratedAt: number | null
}

// The browser hands the buffered entries of the page load (LCP, time to first byte) to a late observer in a later
// task. The page load span waits this long for them before it ends.
const PAGE_LOAD_ENTRIES_WAIT_MS = 500

export function startSentry({
	early,
	posthog,
	landingRouteId,
	currentRouteId,
	hydratedAt,
}: SentryStart): void {
	const integrations = [
		// The page load span starts here, with the browser's own start time. The route hooks stay out: the root reports
		// route changes through `sentryRouteChanged`.
		Sentry.browserTracingIntegration({}),
		Sentry.replayIntegration({
			beforeAddRecordingEvent: redactSearchTelemetry,
			block: [".search-private"],
		}),
	]
	if (posthog)
		integrations.push(
			posthog.sentryIntegration({
				organization: "goodwatch",
				projectId: "webapp" as unknown as number,
			}) as unknown as (typeof integrations)[number],
		)

	Sentry.init({
		beforeSend: redactSearchTelemetry,
		beforeSendTransaction: redactSearchTelemetry,
		beforeBreadcrumb: redactSearchTelemetry,
		dsn: "https://305f3d4bb8cd891b11d6ae7886692de2@o4507456417169408.ingest.de.sentry.io/4507456420184144",
		tunnel: "/api/e",
		tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
		replaysSessionSampleRate: SENTRY_REPLAY_SESSION_SAMPLE_RATE,
		replaysOnErrorSampleRate: SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
		integrations,
	})

	// Sentry's own handlers are in place now. Hand over what the inline queue caught, in the same task.
	drainEarlyErrors(early, (report) => {
		Sentry.withScope((scope) => {
			scope.setTag("early_error", "true")
			if (report.source) scope.setExtra("source", report.source)
			scope.addEventProcessor((event) => {
				event.timestamp = report.timestamp
				return event
			})
			Sentry.captureException(report.exception, {
				mechanism: { type: report.mechanism, handled: false },
			})
		})
	})

	// Name the page load after its route and end it at the time of hydration, as the SDK's root wrapper did.
	if (currentRouteId)
		Sentry.getCurrentScope().setTransactionName(currentRouteId)
	const pageLoad = Sentry.getActiveSpan()
	if (!pageLoad) return
	if (landingRouteId) {
		const root = Sentry.getRootSpan(pageLoad)
		root.updateName(landingRouteId)
		root.setAttribute(Sentry.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE, ROUTE_SOURCE)
	}
	setTimeout(() => {
		// A navigation in the meantime has ended the span already.
		if (Sentry.spanToJSON(pageLoad).timestamp !== undefined) return
		pageLoad.end(hydratedAt === null ? undefined : hydratedAt / 1000)
	}, PAGE_LOAD_ENTRIES_WAIT_MS)
}

/** A navigation inside the app, after Sentry loaded. */
export function sentryRouteChanged(routeId: string): void {
	const client = Sentry.getClient()
	if (!client) return
	Sentry.getCurrentScope().setTransactionName(routeId)
	Sentry.getActiveSpan()?.end()
	Sentry.startBrowserTracingNavigationSpan(client, {
		name: routeId,
		op: "navigation",
		attributes: {
			[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "auto.navigation.remix",
			[Sentry.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: ROUTE_SOURCE,
		},
	})
}

/** An error that reached a route's error boundary. */
export function sentryBoundaryError(error: unknown): void {
	Sentry.captureRemixErrorBoundaryError(error)
}
