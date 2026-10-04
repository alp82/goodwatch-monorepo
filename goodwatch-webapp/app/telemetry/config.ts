// Settings for analytics and error tracking in the browser. Change a value here; the loading code reads them and
// needs no edit.

/**
 * The share of anonymous visitors whose session PostHog may record, from 0 (none) to 1 (all).
 * `null` leaves the decision to the PostHog project's own settings, as before this setting existed.
 * A number is a cap on top of the project settings: a visitor outside the share isn't recorded, and a visitor inside
 * it is recorded when the project settings say so. Members always follow the project settings.
 */
export const POSTHOG_ANONYMOUS_SESSION_RECORDING_SHARE: number | null = null

/** The share of page loads and navigations that send a performance trace to Sentry, from 0 to 1. */
export const SENTRY_TRACES_SAMPLE_RATE = 1

/** The share of sessions that Sentry records as a replay from the start, from 0 to 1. */
export const SENTRY_REPLAY_SESSION_SAMPLE_RATE = 0.1

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
