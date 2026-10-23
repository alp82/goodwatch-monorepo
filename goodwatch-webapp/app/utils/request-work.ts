type Phase = "session" | "context" | "data"
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
	request: Request,
	phase: Phase,
	work: () => Promise<T>,
): Promise<T> {
	const value = timing(request)
	const start = performance.now()
	try {
		return await work()
	} finally {
		value.durations[phase] =
			(value.durations[phase] ?? 0) + performance.now() - start
	}
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
		const result = await load(args)
		if (result === undefined) return result
		const response =
			result instanceof Response
				? result
				: new Response(JSON.stringify(result), {
						headers: { "Content-Type": "application/json; charset=utf-8" },
					})
		response.headers.append(
			"Server-Timing",
			requestServerTiming(args.request) ?? "",
		)
		return response as R
	}
}
