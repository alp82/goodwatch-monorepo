import type { ClientLoaderFunctionArgs } from "@remix-run/react"

// Keep the current page visible while retrying a brief transport interruption.
// Remix server errors/redirects and superseded navigations must not be retried.
export async function retryNetworkLoader({
	request,
	serverLoader,
}: ClientLoaderFunctionArgs) {
	for (let attempt = 0; ; attempt++) {
		request.signal.throwIfAborted()
		try {
			return await serverLoader()
		} catch (error) {
			if (
				request.signal.aborted ||
				!(error instanceof TypeError) ||
				attempt >= 2
			) {
				throw error
			}
			await new Promise((resolve) =>
				setTimeout(resolve, attempt === 0 ? 250 : 750),
			)
		}
	}
}
