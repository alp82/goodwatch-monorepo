import { init } from "@faststats/web"
import { errorTracking } from "@faststats/web/error"
import { webVitals } from "@faststats/web/web-vitals"

/** Loaded only after hydration and the telemetry quiet period. The SDK tracks SPA navigation itself. */
export function startFastStats(siteKey: string): void {
	init({
		siteKey,
		extensions: [errorTracking(), webVitals()],
	})
}
