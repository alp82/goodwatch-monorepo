import { startBrowserGate } from "~/server/browser-gate.server"
import { registerSessionUserObserver } from "./utils/auth-session.ts"
import { identifyProductUser } from "./telemetry/product-analytics.server.ts"
// The server entry: renders a page with React and hands the HTML to the response.
//
// It is Remix's default Node entry with two changes, both measured in docs/benchmarks/viral-spike-render-profile.md:
// - The HTML goes out in one chunk per React pass instead of about 2 KB at a time (see html-stream.server.ts).
// - The abort timer is cleared when the response is done. The default entry leaves it running, so every request keeps
//   its render and loader data alive for 5 seconds.
// First: what remix-serve's fetch polyfill lacks. Under remix-serve this runs before the polyfill exists, so the MCP and
// auth handlers fill the gaps again per request (see web-fetch-gaps.server.ts).
import "~/server/web-fetch-gaps.server"

import type { AppLoadContext, EntryContext } from "@remix-run/node"
import { createReadableStreamFromReadable } from "@remix-run/node"
import { RemixServer } from "@remix-run/react"
import { isbot } from "isbot"
import { renderToPipeableStream } from "react-dom/server"
import {
	currentAssetBase,
	manifestForBase,
	renderWithAssetBase,
} from "~/server/asset-address.server"
import { INCOMPLETE_DATA_HEADER } from "~/navigation/loader-cache"
import { applyCachePolicy } from "~/server/cache-identity.server"
import { startEarlyHints } from "~/server/early-hints.server"
import { HtmlStream } from "~/server/html-stream.server"
import { startPlexConnectionCleanup } from "~/server/imports/plex-connect-runtime.server"
import { startImportResolutionReconciler } from "~/server/imports/resolution-runtime.server"
import { startTmdbConnectionCleanup } from "~/server/imports/tmdb-connect-runtime.server"
import { startLifecycle } from "~/server/lifecycle.server"
import { capLogLines } from "~/server/log-cap.server"
import { protectMediaResponse } from "~/server/media-read-health.server"
import { routeLabelFor } from "~/server/metrics/http.server"
import { startMetrics } from "~/server/metrics/index.server"
import { startNewPagesRefresh } from "~/server/new-on-services.server"
import { startHotCards } from "~/server/og-image/hot-cards.server"
import {
	configurePageCache,
	pageCacheWants,
	startPageCache,
} from "~/server/page-cache.server"
import { startProcessStats } from "~/server/process-stats.server"
import { withoutRelatedMapMarkup } from "~/server/related-map-handoff"
import { logProcessRole, processRole } from "~/server/role.server"
import { startStaticFiles } from "~/server/static-files.server"
import { startHotOnSocialsWarmup } from "~/server/talked-about-now/startup.server"
import { startTitleSnapshot } from "~/server/title-snapshot/index.server"
import { startCrateDiagnostics } from "~/utils/crate-diagnostics"
import {
	registerAuthCluster,
	registerLazyAuthResolver,
} from "./server/auth/boot.server.ts"
import { getRedisCluster } from "./utils/cache"

// Better Auth itself loads on its first use with BETTER_AUTH_ENABLED on (boot.server.ts).
registerAuthCluster(getRedisCluster)
registerLazyAuthResolver()
registerSessionUserObserver(identifyProductUser)

// While the server build loads, before `remix-serve` registers its signal listeners and before the first request:
// readiness and the shutdown sequence (see lifecycle.server.ts), and the title snapshot's first load, which readiness
// waits for. The root loader starts the snapshot too, but a health check that asks /health/ready never reaches it.
// The role line comes first (see role.server.ts). The metrics start here for the same reason as the snapshot: a
// search role never serves a page, so it never reaches the root loader, and its metrics port stayed closed. The log
// cap starts here for every role, so that it also covers the lines of the start.
capLogLines()
logProcessRole()
startCrateDiagnostics()
startLifecycle()
startTmdbConnectionCleanup()
startImportResolutionReconciler()
startPlexConnectionCleanup()
startMetrics()
// The per-minute "Process:" line starts here only in a search role, which has no first page to start it. The other
// roles keep the root loader's start, so they log what they did before roles.
if (processRole() === "search") startProcessStats()
startTitleSnapshot()
startHotOnSocialsWarmup()
// The title pages' "What's new on" links read the links of the /new pages that this keeps loaded (#489).
if (processRole() !== "search") startNewPagesRefresh()
// The page cache answers repeated anonymous pages before Express (see page-cache.server.ts). It starts before the
// static files, so that the static handler is the outer one and its requests never reach the cache. The first call
// of the route labeler starts loading the route list for the cache's metrics.
configurePageCache({ routeLabel: routeLabelFor })
routeLabelFor("/", 200)
startPageCache()
// Person abuse checks and URL normalization must run before cache misses, root loaders and rendering.
startBrowserGate()
// A page's 103 Early Hints response, before the render (see early-hints.server.ts). After the page cache, so that a
// cached page gets its hints too, and before the static files, which answer files without them.
startEarlyHints()
// Also before the first request: the files of the client build are answered before Express (see
// static-files.server.ts). The root loader starts the gate, but a static request never reaches it.
startStaticFiles()
// Hot cards answer before Express and route matching (see og-image/hot-cards.server.ts).
// The routes keep complete answers here briefly after a successful card request.
startHotCards()

const ABORT_DELAY = 5_000

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	// Where this response's files are: the site's own host or the static hostname (see asset-address.server.ts). Remix
	// takes the addresses of scripts, preloads and route style sheets from the build's file list, so the render gets
	// the copy of the list for that address. `assetUrl` reads the same address for everything else.
	const assetBase = currentAssetBase()
	// The document holds the related map's markup once: the page data that Remix writes into it leaves it out, whatever
	// the request's headers say (see related-map-handoff.ts).
	const context = {
		...withoutRelatedMapMarkup(remixContext),
		manifest: manifestForBase(remixContext.manifest, assetBase),
	}
	return renderWithAssetBase(assetBase, () =>
		renderDocument(request, responseStatusCode, responseHeaders, context),
	)
}

function renderDocument(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
) {
	const renderStarted = performance.now()
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
			responseHeaders.append("Server-Timing", `render;dur=${(performance.now() - renderStarted).toFixed(1)}`)
			protectMediaResponse(responseHeaders)
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
	protectMediaResponse(response.headers)
	// An incomplete page says no-store before the cache policy below makes every private answer say it. The
	// browser's loader cache shows such data once but doesn't keep it (navigation/loader-cache.ts).
	if (/no-store/i.test(response.headers.get("Cache-Control") ?? ""))
		response.headers.set(INCOMPLETE_DATA_HEADER, "1")
	applyCachePolicy(request, response.status, response.headers)
	return response
}
