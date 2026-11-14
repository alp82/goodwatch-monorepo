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

/** `work`'s (synchronous) time, added to `name` on the current request. */
export function timedSync<T>(name: string, work: () => T): T {
	const marks = current.getStore()
	if (!marks) return work()
	const started = performance.now()
	try {
		return work()
	} finally {
		marks.set(name, (marks.get(name) ?? 0) + performance.now() - started)
	}
}

/** A duration measured elsewhere (`ms`), added to `name` on the current request. */
export function mark(name: string, ms: number) {
	const marks = current.getStore()
	if (marks) marks.set(name, (marks.get(name) ?? 0) + ms)
}

/**
 * Runs background `work` (a deck build) under its own marks, never the request that happened to start it, and hands
 * them over with its total once it settles.
 */
export function measured<T>(work: () => Promise<T>, done: (marks: Record<string, number>, totalMs: number) => void): Promise<T> {
	const marks: Marks = new Map()
	const started = performance.now()
	const result = current.run(marks, work)
	const report = () => {
		try {
			done(Object.fromEntries([...marks].map(([name, ms]) => [name, Math.round(ms)])), Math.round(performance.now() - started))
		} catch {
			// Reporting never fails the work.
		}
	}
	result.then(report, report)
	return result
}
