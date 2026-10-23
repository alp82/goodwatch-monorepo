/**
 * Runs a fetch with a timeout that is cleared once `use` has read the response.
 * Remix's fetch polyfill throws an uncaught error when an abort fires after a response arrived but its body
 * wasn't read to the end, which crashes the process. So the timer never outlives the request, and callers read
 * every body, even ones they ignore.
 */
export async function fetchWithTimeout<T>(
	send: typeof fetch,
	url: string,
	init: RequestInit,
	ms: number,
	use: (response: Response) => Promise<T>,
): Promise<T> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), ms)
	try {
		const response = await send(url, { ...init, signal: controller.signal })
		return await use(response)
	} finally {
		clearTimeout(timer)
	}
}

/** Reads and drops a response body so the fetch can finish cleanly. */
export async function drain(response: Response) {
	try {
		if (typeof response.text === "function") await response.text()
	} catch {
		// The body is not needed.
	}
}
