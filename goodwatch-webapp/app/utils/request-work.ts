type StatsRead = "stats_details" | "stats_tropes" | "stats_credits" | "stats_people"
type PortraitRead = `portrait_${"fingerprint" | "sides" | "everyone"}`
type CacheRead = "stats" | PortraitRead
type Phase =
	| "session"
	| "context"
	| "data"
	| StatsRead
	| PortraitRead
	| `${CacheRead}_cache_${"hit" | "miss"}`
type Timing = { start: number; durations: Partial<Record<Phase, number>> }
const timings = new WeakMap<Request, Timing>()

function timing(request: Request) {
	let value = timings.get(request)
	if (!value) {
		value = { start: performance.now(), durations: {} }
		timings.set(request, value)
	}
	return value
}

/** Measure wall time, including waits. Overlapping phases are not additive. */
export async function timeRequestWork<T>(
	request: Request | undefined,
	phase: Phase,
	work: () => Promise<T>,
): Promise<T> {
	if (!request) return work()
	const value = timing(request)
	const start = performance.now()
	try {
		return await work()
	} finally {
		value.durations[phase] =
			(value.durations[phase] ?? 0) + performance.now() - start
	}
}

/** Record the cache lookup's duration and outcome without exposing keys or values. */
export async function timeRequestCache<T>(
	request: Request | undefined,
	name: CacheRead,
	read: () => Promise<T>,
): Promise<T> {
	if (!request) return read()
	const value = timing(request)
	const start = performance.now()
	const result = await read()
	const phase: Phase = `${name}_cache_${result ? "hit" : "miss"}`
	value.durations[phase] = (value.durations[phase] ?? 0) + performance.now() - start
	return result
}

export function requestServerTiming(request: Request): string | undefined {
	const value = timings.get(request)
	if (!value) return
	return [
		...Object.entries(value.durations),
		["total", performance.now() - value.start],
	]
		.map(([name, duration]) => `${name};dur=${Number(duration).toFixed(1)}`)
		.join(", ")
}

/** Install the promise before work starts so concurrent callers share failures too. */
export function requestWork<T>(work: (request: Request) => Promise<T>) {
	const results = new WeakMap<Request, Promise<T>>()
	return (request: Request): Promise<T> => {
		let result = results.get(request)
		if (!result) {
			result = Promise.resolve().then(() => work(request))
			results.set(request, result)
		}
		return result
	}
}

/** Remix gives its response hook a different Request. Attach timings at the loader boundary. */
export function withRequestTiming<A extends { request: Request }, R>(
	load: (args: A) => R | Promise<R>,
): (args: A) => Promise<R> {
	return async (args) => {
		timing(args.request)
		let result: R
		try {
			result = await load(args)
		} catch (error) {
			if (error instanceof Response) {
				const value = requestServerTiming(args.request)
				if (value) {
					try { error.headers.append("Server-Timing", value) } catch {}
				}
			}
			throw error
		}
		if (result === undefined) return result
		const response =
			result instanceof Response
				? result
				: new Response(JSON.stringify(result), {
						headers: { "Content-Type": "application/json; charset=utf-8" },
					})
		const value = requestServerTiming(args.request)
		// A Response from fetch() has immutable headers; timings are optional, the response isn't.
		if (value) {
			try {
				response.headers.append("Server-Timing", value)
			} catch {}
		}
		return response as R
	}
}
