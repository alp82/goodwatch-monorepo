// Remix asks the server for a route's loader data with a request of its own (`?_data=<route>`): on a navigation, on a
// revalidation, and for a fetcher. When the browser can't complete that request (the network changed, the connection
// dropped), Remix shows the error page in place of the whole document. This wraps the browser's `fetch` for those
// requests only:
// - A request that fails on the network is sent once more after a short delay. An answer from the server, whatever its
//   status, is never retried, and neither is a request that the router cancelled.
// - When the retry fails too and the request was a revalidation of the page that is showing, the route keeps the data
//   it has. The visitor stays on the page. `keptLoaderData` tells a route that its data is not a new answer.
// - Any other failure goes to Remix as before: a navigation to another page has no data to fall back on.
// Requests that change something (form posts) pass through untouched: sending them twice isn't safe.

export const LOADER_RETRY_DELAY_MS = 400

/** What the wrapper needs from the browser. Tests pass a stand-in. */
export interface LoaderRetryEnv {
	fetch: typeof fetch
	origin: string
	wait: (ms: number) => Promise<void>
	/** The path and query string of the page that is showing, or `null` before the router exists. */
	currentPage: () => string | null
	/** The loader data that a route of the showing page holds. `undefined` when it has none. */
	currentLoaderData: (routeId: string) => unknown
}

const DATA_PARAM = "_data"

// Routes whose latest loader data is what they had before a failed revalidation.
const kept = new Set<string>()

/** Whether the route's loader data was kept after a failed revalidation, and not answered by the server. */
export function keptLoaderData(routeId: string): boolean {
	return kept.has(routeId)
}

/** The request's URL when it is a GET for a route's loader data on this origin, else `null`. */
export function loaderRequestUrl(
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	origin: string,
): URL | null {
	const method =
		init?.method ?? (input instanceof Request ? input.method : "GET")
	if (method.toUpperCase() !== "GET") return null
	let url: URL
	try {
		url = new URL(input instanceof Request ? input.url : String(input), origin)
	} catch {
		return null
	}
	if (url.origin !== origin || !url.searchParams.has(DATA_PARAM)) return null
	return url
}

/** A failure of the network, as `fetch` reports it. A cancelled request is an `AbortError` and doesn't count. */
export function isNetworkError(error: unknown): boolean {
	return error instanceof TypeError
}

function pageOf(url: URL): string {
	const page = new URL(url)
	page.searchParams.delete(DATA_PARAM)
	return page.pathname + page.search
}

// Loader data came from JSON, so it can go back into a response. Streamed (deferred) data holds promises and can't.
function asResponse(data: unknown): Response | null {
	if (data === undefined) return null
	if (
		data !== null &&
		typeof data === "object" &&
		Object.values(data).some(
			(value) =>
				typeof (value as { then?: unknown } | null)?.then === "function",
		)
	)
		return null
	try {
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"X-Remix-Response": "yes",
			},
		})
	} catch {
		return null
	}
}

/** Returns a `fetch` that retries and recovers loader requests by the rules at the top of this file. */
export function withLoaderRetry(env: LoaderRetryEnv): typeof fetch {
	return async (input, init) => {
		const url = loaderRequestUrl(input, init, env.origin)
		if (!url) return env.fetch(input, init)
		const routeId = url.searchParams.get(DATA_PARAM) ?? ""
		const signal =
			init?.signal ?? (input instanceof Request ? input.signal : undefined)
		const send = async () => {
			const response = await env.fetch(input, init)
			kept.delete(routeId)
			return response
		}
		try {
			return await send()
		} catch (error) {
			if (!isNetworkError(error) || signal?.aborted) throw error
		}
		await env.wait(LOADER_RETRY_DELAY_MS)
		signal?.throwIfAborted()
		try {
			return await send()
		} catch (error) {
			if (!isNetworkError(error) || signal?.aborted) throw error
			if (env.currentPage() !== pageOf(url)) throw error
			const response = asResponse(env.currentLoaderData(routeId))
			if (!response) throw error
			kept.add(routeId)
			return response
		}
	}
}

type RemixRouter = {
	state: {
		location: { pathname: string; search: string }
		loaderData: Record<string, unknown>
	}
}

/** Installs the wrapper in a browser. Call it once, before the app hydrates. */
export function installLoaderRetry(): void {
	const router = () =>
		(window as unknown as { __remixRouter?: RemixRouter }).__remixRouter
	const browserFetch = window.fetch.bind(window)
	window.fetch = withLoaderRetry({
		fetch: browserFetch,
		origin: window.location.origin,
		wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		currentPage: () => {
			const location = router()?.state.location
			return location ? location.pathname + location.search : null
		},
		currentLoaderData: (routeId) => router()?.state.loaderData[routeId],
	})
}
