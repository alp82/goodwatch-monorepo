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
import { HtmlStream } from "~/server/html-stream.server"

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
		// Gives up on parts that are still suspended after ABORT_DELAY. Cleared when the response is done.
		const abortTimer = setTimeout(() => abort(), ABORT_DELAY)
		const send = () => {
			shellRendered = true
			const body = new HtmlStream()
			body.once("close", () => clearTimeout(abortTimer))
			responseHeaders.set("Content-Type", "text/html")
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
					status = 500
					// Errors during the shell render reject above, and Remix logs them. Log the ones that come after.
					if (shellRendered) console.error(error)
				},
			},
		)
	})
}
