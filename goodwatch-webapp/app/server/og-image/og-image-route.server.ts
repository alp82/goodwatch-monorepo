// Serves the Open Graph image for a page: /og/<page path>.jpg, and /og/index.jpg for the home page. Used by the og.*
// routes. The cards are JPEG. /og/<page path>.png answers with the same JPEG: links shared while the cards were PNG
// still name that URL, and link-preview clients go by the content type, not by the extension.
//
// A card that can't be drawn in time (the renderer is busy, or the render failed) is answered with a generic card and
// a lifetime of one minute, never with an error: platforms keep what they fetched, and a missing preview is worse
// than a generic one that is replaced on the next fetch.
import type { LoaderFunctionArgs } from "@remix-run/node"
import type { OgResult } from "~/server/og-image/store.server"
import { OG_IMAGE } from "~/ui/og-image/format"
import { type HotCard, hotCards } from "./hot-cards.server.ts"
import { cardClient, type CardClient } from "./clients.ts"

type Dependencies = {
	countClient?: (client: CardClient, result: string) => void
	remember?: (pathname: string, card: HotCard) => void
	getOgImage: (path: string) => Promise<OgResult>
	getFallbackCard: () => Buffer | null
}
// A card changes when its title's data changes, so it isn't immutable: browsers keep it for a day and shared caches
// for a week, and the ETag lets both revalidate without the body.
const CACHE =
	"public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
const text = (status: number, body: string, extra = {}) =>
	new Response(body, {
		status,
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": "no-store",
			...extra,
		},
	})
export function matchesEtag(request: Request, etag: string) {
	return (
		request.headers
			.get("If-None-Match")
			?.split(",")
			.some(
				(value) =>
					value.trim() === "*" || value.trim().replace(/^W\//, "") === etag,
			) ?? false
	)
}
export function createOgImageLoader(deps: Dependencies) {
	return async ({ request }: Pick<LoaderFunctionArgs, "request">) => {
		const pathname = new URL(request.url).pathname
		const file = pathname.replace(/^\/og\//, "")
		if (!/\.(jpg|png)$/.test(file)) return text(404, "Not Found")
		const stem = file.slice(0, -4)
		const result = await deps.getOgImage(stem === "index" ? "/" : `/${stem}`)
		deps.countClient?.(
			cardClient(request.headers.get("User-Agent")),
			result.status === "ok" ? result.source : result.status,
		)
		if (result.status === "missing") return text(404, "Not Found")
		if (result.status !== "ok") {
			const fallback = deps.getFallbackCard()
			if (!fallback)
				return text(503, "Renderer unavailable", { "Retry-After": "2" })
			return new Response(fallback, {
				headers: {
					"Content-Type": OG_IMAGE.type,
					"Content-Length": String(fallback.length),
					"Cache-Control": "public, max-age=60",
					"X-OG-Card": "fallback",
				},
			})
		}
		const headers = { "Cache-Control": CACHE, ETag: result.etag }
		const lastModified = new Date(result.renderedAt).toUTCString()
		// Before the 304: a card that is only ever revalidated is hot too.
		// A first-time card must reach the route on its second request so the store learns of it.
		if (result.kept)
			deps.remember?.(pathname, {
				image: result.image,
				etag: result.etag,
				contentType: OG_IMAGE.type,
				cacheControl: CACHE,
				lastModified,
			})
		if (matchesEtag(request, result.etag))
			return new Response(null, { status: 304, headers })
		return new Response(result.image, {
			headers: {
				...headers,
				"Content-Type": OG_IMAGE.type,
				"Content-Length": String(result.image.length),
				"Last-Modified": lastModified,
				"X-OG-Card": result.source,
			},
		})
	}
}
export async function ogImageLoader(args: LoaderFunctionArgs) {
	const deps = await import("~/server/og-image/og-image.server")
	return createOgImageLoader({
		...deps,
		countClient: deps.countOgCardClient,
		remember: (pathname, card) =>
			hotCards.remember(pathname, {
				...card,
				onHit: (userAgent) => {
					deps.countOgCard("memory")
					deps.countOgCardClient(cardClient(userAgent), "memory")
				},
			}),
	})(args)
}
