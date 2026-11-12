import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Server-Timing for YepWatch API answers: where a request's server time went (room read, deck, a member's seen
 * titles, the write), readable in any browser trace next to the network time. Durations only, never values.
 */
type Marks = Map<string, number>
const current = new AsyncLocalStorage<Marks>()

/** Runs one request, then puts its marks and total on the answer's Server-Timing header. */
export async function withServerTiming(run: () => Promise<Response>): Promise<Response> {
	const marks: Marks = new Map()
	const started = performance.now()
	const response = await current.run(marks, run)
	const parts = [...marks].map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`)
	parts.push(`total;dur=${(performance.now() - started).toFixed(1)}`)
	try {
		response.headers.set("server-timing", parts.join(", "))
	} catch {
		// A response with immutable headers keeps its own.
	}
	return response
}

/** `work`'s time until it settles, added to `name` on the current request (nothing outside a request). */
export function timed<T>(name: string, work: Promise<T>): Promise<T> {
	const marks = current.getStore()
	if (!marks) return work
	const started = performance.now()
	const done = () => marks.set(name, (marks.get(name) ?? 0) + performance.now() - started)
	work.then(done, done)
	return work
}
