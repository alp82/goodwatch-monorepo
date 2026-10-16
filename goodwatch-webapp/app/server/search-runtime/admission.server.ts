import { AsyncLocalStorage } from "node:async_hooks"
import { counter } from "../metrics/registry.server.ts"
import { searchInFlightLimit } from "./limits.server.ts"

export const SEARCH_BUSY_RETRY_SECONDS = 2
export const SEARCH_BUSY_MESSAGE =
	"Search is busy right now. Try again in a moment."

const busy = counter(
	"goodwatch_search_busy_total",
	"Searches answered busy.",
	[],
)

export function createSearchAdmission(options: { limit?: () => number } = {}) {
	const limit = options.limit ?? (() => searchInFlightLimit())
	let count = 0
	const heldWork = new AsyncLocalStorage<(work: Promise<unknown>) => void>()
	return {
		/** Observe this search's own work that outlives its response, without mixing concurrent searches. */
		track<T>(observe: (work: Promise<unknown>) => void, run: () => T): T {
			return heldWork.run(observe, run)
		},
		enter(): (() => void) | null {
			if (count >= limit()) return null
			count++
			let released = false
			return () => {
				if (released) return
				released = true
				count--
			}
		},
		hold(work: Promise<unknown>): void {
			count++
			const release = () => {
				count--
			}
			void work.then(release, release)
			heldWork.getStore()?.(work)
		},
		inFlight(): number {
			return count
		},
	}
}

export const searchAdmission = createSearchAdmission()

export function searchBusyResponse(): Response {
	busy.inc([])
	return new Response(JSON.stringify({ error: SEARCH_BUSY_MESSAGE }), {
		status: 503,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "private, no-store",
			"Retry-After": String(SEARCH_BUSY_RETRY_SECONDS),
			"X-Robots-Tag": "noindex",
			"Referrer-Policy": "no-referrer",
		},
	})
}
