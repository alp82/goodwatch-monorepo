// How long the title snapshot loader waits after a failed check before the first load.
//
// A load asks Redis for every chunk at once (tens of megabytes). When the link is slow, the commands time out here
// after a second while the node keeps sending the replies, so a retry every 2 seconds stacked replies in the node's
// output buffer: 15 orphaned test servers held up to 1.5 GB there on October 4, 2026. Each failure in a row doubles the
// wait, from 2 seconds up to the normal check interval of a minute, and the wait varies by up to a quarter so that
// processes that started together don't retry together.
const FIRST_RETRY_MS = 2_000
const LONGEST_RETRY_MS = 60_000

/** The wait before the next check after `failures` failed checks in a row (1 or more). `random` is in [0, 1). */
export function retryDelayMs(failures: number, random = Math.random()): number {
	const doubled = FIRST_RETRY_MS * 2 ** Math.min(Math.max(failures, 1) - 1, 10)
	const base = Math.min(doubled, LONGEST_RETRY_MS)
	return Math.round(base * (0.75 + random * 0.25))
}
