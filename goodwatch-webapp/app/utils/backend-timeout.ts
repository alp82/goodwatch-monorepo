export const TMDB_TIMEOUT_DEFAULT_MS = 5000

export class BackendTimeoutError extends Error {
	declare cause?: unknown
	readonly service: string
	readonly timeoutMs: number

	constructor(service: string, timeoutMs: number, message = `${service} did not respond within ${timeoutMs} ms`) {
		super(message)
		this.name = "BackendTimeoutError"
		this.service = service
		this.timeoutMs = timeoutMs
	}
}

export function timeoutSetting(envName: string, defaultMs: number): number {
	const value = Number(process.env[envName])
	return Number.isSafeInteger(value) && value > 0 ? value : defaultMs
}

export async function withBackendTimeout<T>(
	service: string,
	timeoutMs: number,
	run: (signal: AbortSignal) => Promise<T>,
	options?: { signal?: AbortSignal; error?: () => BackendTimeoutError },
): Promise<T> {
	const controller = new AbortController()
	const forwardAbort = () => controller.abort(options?.signal?.reason)
	let rejectAbort: (reason: unknown) => void = () => {}
	const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
	const onAbort = () => rejectAbort(controller.signal.reason)
	controller.signal.addEventListener("abort", onAbort, { once: true })
	const timer = setTimeout(() => {
		controller.abort(options?.error?.() ?? new BackendTimeoutError(service, timeoutMs))
	}, timeoutMs)
	options?.signal?.addEventListener("abort", forwardAbort, { once: true })
	if (options?.signal?.aborted) forwardAbort()
	try {
		// Attach the race before invoking run so abort-triggered rejections cannot win.
		const running = Promise.resolve().then(() => {
			controller.signal.throwIfAborted()
			return run(controller.signal)
		})
		return await Promise.race([aborted, running])
	} finally {
		clearTimeout(timer)
		options?.signal?.removeEventListener("abort", forwardAbort)
		controller.signal.removeEventListener("abort", onAbort)
	}
}

export function fetchWithBackendTimeout(
	service: string,
	timeoutMs: number,
	input: Parameters<typeof fetch>[0],
	init?: RequestInit,
): Promise<Response> {
	const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
	return withBackendTimeout(service, timeoutMs, (signal) => fetch(input, {
		...init,
		signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal,
	}), { signal: callerSignal })
}

export function fetchJsonWithBackendTimeout<T = any>(
	service: string,
	timeoutMs: number,
	input: Parameters<typeof fetch>[0],
	init?: RequestInit,
): Promise<T> {
	return withBackendTimeout(service, timeoutMs, async (signal) => {
		const response = await fetch(input, { ...init, signal })
		return await response.json() as T
	}, { signal: init?.signal ?? (input instanceof Request ? input.signal : undefined) })
}
