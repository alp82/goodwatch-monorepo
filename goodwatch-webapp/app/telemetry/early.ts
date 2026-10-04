// Analytics and error tracking load after the page is interactive (see load-trigger.ts). Two things can't wait that
// long, so a tiny inline script in the document head records them before any other script runs:
// - the landing: the URL, the referrer and the time of the page load. A visitor can follow a link inside the app
//   before the tools load, and the page view must still describe the page the browser loaded.
// - early errors: `error` and `unhandledrejection` events, which the error tracker receives when it loads.

/** The global the inline script writes to. */
export const EARLY_TELEMETRY_KEY = "__gwEarly"

/** The inline script keeps at most this many events. The same number is written out in the script. */
export const MAX_EARLY_ERRORS = 20

/** The page load as the browser made it. */
export interface LandingSnapshot {
	href: string
	referrer: string
	/** Milliseconds since the epoch. */
	time: number
}

/** An `error` or `unhandledrejection` event that fired before the error tracker loaded. */
export interface EarlyErrorEntry {
	event: {
		type: string
		error?: unknown
		message?: string
		filename?: string
		lineno?: number
		colno?: number
		reason?: unknown
	}
	time: number
}

export interface EarlyTelemetry {
	landing: LandingSnapshot
	errors: EarlyErrorEntry[]
	/** Stops queueing. The error tracker calls it once its own handlers are in place. */
	stop: () => void
}

/**
 * The inline script. It is a plain string, so the server HTML and the hydrated document hold the same text, and it
 * uses only syntax that every browser the site supports can parse.
 */
export const EARLY_TELEMETRY_SCRIPT = [
	"(function(w,d){var q=[],on=true;",
	"function h(e){if(on&&q.length<20)q.push({event:e,time:Date.now()})}",
	"w.addEventListener('error',h);w.addEventListener('unhandledrejection',h);",
	`w.${EARLY_TELEMETRY_KEY}={landing:{href:w.location.href,referrer:d.referrer,time:Date.now()},errors:q,`,
	"stop:function(){on=false;w.removeEventListener('error',h);w.removeEventListener('unhandledrejection',h)}}",
	"})(window,document)",
].join("")

interface EarlyWindow {
	location: { href: string }
	document?: { referrer?: string }
}

/**
 * Reads what the inline script recorded. A page without the script (a test, or a document an extension rewrote) gets
 * the current URL as its landing and an empty queue.
 */
export function readEarlyTelemetry(win: EarlyWindow): EarlyTelemetry {
	const recorded = (win as unknown as Record<string, unknown>)[
		EARLY_TELEMETRY_KEY
	] as EarlyTelemetry | undefined
	if (recorded?.landing && Array.isArray(recorded.errors)) return recorded
	return {
		landing: {
			href: win.location.href,
			referrer: win.document?.referrer ?? "",
			time: Date.now(),
		},
		errors: [],
		stop: () => {},
	}
}

/** What the error tracker needs to report one early error. */
export interface EarlyErrorReport {
	/** The thrown value, or the message when the browser withheld the value (a script from another origin). */
	exception: unknown
	/** How the error surfaced, in the error tracker's own terms. */
	mechanism: "onerror" | "onunhandledrejection"
	/** Seconds since the epoch, the unit the error tracker uses. */
	timestamp: number
	/** Where the browser says the error came from, when it gave no error object. */
	source?: { filename?: string; lineno?: number; colno?: number }
}

export function toEarlyErrorReport(entry: EarlyErrorEntry): EarlyErrorReport {
	const { event, time } = entry
	const timestamp = time / 1000
	if (event.type === "unhandledrejection")
		return {
			exception: event.reason ?? "Unhandled promise rejection",
			mechanism: "onunhandledrejection",
			timestamp,
		}
	if (event.error != null)
		return { exception: event.error, mechanism: "onerror", timestamp }
	return {
		exception: event.message || "Unknown error",
		mechanism: "onerror",
		timestamp,
		source: {
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
		},
	}
}

/**
 * Stops the inline queue and hands every queued error to `report`, oldest first. Call it right after the error
 * tracker installed its own handlers, in the same task, so that no error is lost or reported twice. A failing report
 * doesn't stop the rest.
 */
export function drainEarlyErrors(
	early: EarlyTelemetry,
	report: (error: EarlyErrorReport) => void,
): number {
	early.stop()
	const entries = early.errors.splice(0, early.errors.length)
	for (const entry of entries) {
		try {
			report(toEarlyErrorReport(entry))
		} catch {
			// Error reporting must never throw into the page.
		}
	}
	return entries.length
}

// PostHog reads these from the URL when it starts. The list is PostHog's own campaign and click-id list.
const CAMPAIGN_PARAMS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_content",
	"utm_term",
	"gad_source",
	"mc_cid",
	"gclid",
	"gclsrc",
	"dclid",
	"gbraid",
	"wbraid",
	"fbclid",
	"msclkid",
	"twclid",
	"li_fat_id",
	"igshid",
	"ttclid",
	"rdt_cid",
	"epik",
	"qclid",
	"sccid",
	"irclid",
	"_kx",
]

/**
 * The properties that make the landing page view describe the page the browser loaded. PostHog fills in the URL and
 * the campaign values from the address bar when it sends an event, so they are wrong when the visitor followed a link
 * inside the app before PostHog loaded. Returns an empty object when the address is still the landing URL.
 */
export function landingPageviewProperties(
	landing: LandingSnapshot,
	currentHref: string,
): Record<string, string> {
	if (landing.href === currentHref) return {}
	let url: URL
	try {
		url = new URL(landing.href)
	} catch {
		return {}
	}
	const properties: Record<string, string> = {
		$current_url: landing.href,
		$host: url.host,
		$pathname: url.pathname,
	}
	for (const name of CAMPAIGN_PARAMS) {
		const value = url.searchParams.get(name)
		if (value) properties[name] = value
	}
	return properties
}
