// The server entry: renders a page with React and hands the HTML to the response.
//
// It is Remix's default Node entry with two changes, both measured in docs/benchmarks/viral-spike-render-profile.md:
// - The HTML goes out in one chunk per React pass instead of about 2 KB at a time (see html-stream.server.ts).
// - The abort timer is cleared when the response is done. The default entry leaves it running, so every request keeps
//   its render and loader data alive for 5 seconds.
import type { AppLoadContext, EntryContext } from "@remix-run/node"
import { createReadableStreamFromReadable } from "@remix-run/node"
import { RemixServer } from "@remix-run/react"
import { isbot } from "isbot"
import { renderToPipeableStream } from "react-dom/server"
import { applyCachePolicy } from "~/server/cache-identity.server"
import { HtmlStream } from "~/server/html-stream.server"
import { startLifecycle } from "~/server/lifecycle.server"
import { routeLabelFor } from "~/server/metrics/http.server"
import {
	configurePageCache,
	pageCacheWants,
	startPageCache,
} from "~/server/page-cache.server"
import { startStaticFiles } from "~/server/static-files.server"
import { startTitleSnapshot } from "~/server/title-snapshot/index.server"

// While the server build loads, before `remix-serve` registers its signal listeners and before the first request:
// readiness and the shutdown sequence (see lifecycle.server.ts), and the title snapshot's first load, which readiness
// waits for. The root loader starts the snapshot too, but a health check that asks /health/ready never reaches it.
startLifecycle()
startTitleSnapshot()
// The page cache answers repeated anonymous pages before Express (see page-cache.server.ts). It starts before the
// static files, so that the static handler is the outer one and its requests never reach the cache. The first call
// of the route labeler starts loading the route list for the cache's metrics.
configurePageCache({ routeLabel: routeLabelFor })
routeLabelFor("/", 200)
startPageCache()
// Also before the first request: the files of the client build are answered before Express (see
// static-files.server.ts). The root loader starts the gate and the metrics, but a static request never reaches it.
startStaticFiles()

const ABORT_DELAY = 5_000

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	// Crawlers get the complete document in one piece. Browsers get the shell first and suspended parts as they finish.
	const waitForAll =
		isbot(request.headers.get("user-agent") ?? "") || remixContext.isSpaMode

	return new Promise((resolve, reject) => {
		let shellRendered = false
		let status = responseStatusCode
		let errored = false
		// Gives up on parts that are still suspended after ABORT_DELAY. Cleared when the response is done.
		const abortTimer = setTimeout(() => {
			errored = true
			abort()
		}, ABORT_DELAY)
		const send = () => {
			shellRendered = true
			responseHeaders.set("Content-Type", "text/html")
			const routePolicy = responseHeaders.get("Cache-Control")
			const decision = applyCachePolicy(request, status, responseHeaders)
			const offer = pageCacheWants(
				request,
				status,
				responseHeaders,
				decision,
				routePolicy,
			)
			const body = new HtmlStream(
				offer
					? (html) => {
							if (!errored) offer(html)
						}
					: undefined,
			)
			body.once("close", () => clearTimeout(abortTimer))
			resolve(
				new Response(createReadableStreamFromReadable(body), {
					headers: responseHeaders,
					status,
				}),
			)
			pipe(body)
		}
		const { pipe, abort } = renderToPipeableStream(
			<RemixServer
				context={remixContext}
				url={request.url}
				abortDelay={ABORT_DELAY}
			/>,
			{
				onShellReady() {
					if (!waitForAll) send()
				},
				onAllReady() {
					if (waitForAll) send()
				},
				onShellError(error: unknown) {
					clearTimeout(abortTimer)
					reject(error)
				},
				onError(error: unknown) {
					errored = true
					status = 500
					// Errors during the shell render reject above, and Remix logs them. Log the ones that come after.
					if (shellRendered) console.error(error)
				},
			},
		)
	})
}

export function handleDataRequest(
	response: Response,
	{ request }: { request: Request },
) {
	applyCachePolicy(request, response.status, response.headers)
	return response
}
