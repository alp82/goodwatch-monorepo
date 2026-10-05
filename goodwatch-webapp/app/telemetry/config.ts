// Settings for analytics and error tracking in the browser. Change a value here; the loading code reads them and
// needs no edit.

/**
 * The share of anonymous visitors whose session PostHog may record, from 0 (none) to 1 (all).
 * `null` leaves the decision to the PostHog project's own settings, as before this setting existed.
 * A number is a cap on top of the project settings: a visitor outside the share isn't recorded, and a visitor inside
 * it is recorded when the project settings say so. Members always follow the project settings.
 */
export const POSTHOG_ANONYMOUS_SESSION_RECORDING_SHARE: number | null = null

/**
 * The share of page loads and navigations that send a performance trace to Sentry, from 0 to 1. Every trace is one
 * POST through the app's tunnel, so at 1 each page view costs an upload, a proxy hop and Sentry quota. Web vitals
 * reach PostHog for every page view, independent of this share. Errors aren't sampled by this setting.
 */
export const SENTRY_TRACES_SAMPLE_RATE = 0.05

/**
 * The kinds of loaded resources that a Sentry trace leaves out, as the browser's initiator types. A span per image,
 * script and stylesheet was about 90% of a trace's 50 to 100 KB. An empty list brings the resource waterfall back.
 */
export const SENTRY_IGNORED_RESOURCE_SPANS: string[] = [
	"resource.img",
	"resource.script",
	"resource.link",
	"resource.css",
	"resource.other",
	"resource.video",
	"resource.audio",
	"resource.iframe",
	"resource.beacon",
]

/** The share of members' sessions that Sentry records as a replay from the start, from 0 to 1. */
export const SENTRY_REPLAY_SESSION_SAMPLE_RATE = 0.1

/**
 * The same share for anonymous visitors. At 0, an anonymous session sends a replay only after an error (see
 * SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE). A replay from the start uploads about 90 KB and more with every activity.
 * The share is fixed when Sentry starts: a visitor who signs in later keeps it until the next page load.
 */
export const SENTRY_ANONYMOUS_REPLAY_SESSION_SAMPLE_RATE = 0

/** The share of sessions with an error whose last minute Sentry sends as a replay, from 0 to 1. */
export const SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE = 1

/**
 * When the tools load, in milliseconds. See load-trigger.ts for the rule.
 * - `quietMs`: how long the page must be quiet after the load event (no long task, no finished request, no first or
 *   largest paint) before the tools load. Lighthouse ends its measurement about 2.2 seconds after the last of these,
 *   so a lower value puts the tools' main-thread work back into its Total Blocking Time. A visitor who taps, types or
 *   scrolls doesn't wait.
 * - `maxWaitMs`: the longest wait after the load event, for a page that never gets quiet.
 */
export const TELEMETRY_LOAD = { quietMs: 3_500, maxWaitMs: 10_000 } as const
