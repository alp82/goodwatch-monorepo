import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import * as Sentry from "@sentry/remix";
import posthog from "posthog-js";
import { StrictMode, startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

Sentry.init({
	dsn: "https://305f3d4bb8cd891b11d6ae7886692de2@o4507456417169408.ingest.de.sentry.io/4507456420184144",
	tunnel: "/api/e",
	tracesSampleRate: 1,
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1,

	integrations: [
		Sentry.browserTracingIntegration({
			useEffect,
			useLocation,
			useMatches,
		}),
		Sentry.replayIntegration(),
		posthog.sentryIntegration({
			organization: "goodwatch",
			projectId: "webapp",
			// severityAllowList: ['error', 'fatal']
		}),
	],
});

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<RemixBrowser />
		</StrictMode>,
	);
});
