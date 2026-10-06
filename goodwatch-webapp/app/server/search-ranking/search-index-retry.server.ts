// How long the search index loader waits before it loads a new build over a loaded one.
//
// Every instance sees a new build at its next check, and the checks of instances that started together fall together.
// A random wait of up to 4 minutes spreads the reloads, so that the instances don't download and build at the same
// second. The first load of a process doesn't wait. RELOAD_JITTER_MAX_MS caps the wait (0 turns it off), for
// measurements.
const RELOAD_MAX_MS = 4 * 60_000

/** The wait before a reload, in milliseconds. `random` is in [0, 1). */
export function reloadDelayMs(random = Math.random()): number {
	const cap = Number(process.env.RELOAD_JITTER_MAX_MS)
	const max =
		process.env.RELOAD_JITTER_MAX_MS !== undefined &&
		Number.isFinite(cap) &&
		cap >= 0
			? Math.min(cap, RELOAD_MAX_MS)
			: RELOAD_MAX_MS
	return Math.floor(random * max)
}
