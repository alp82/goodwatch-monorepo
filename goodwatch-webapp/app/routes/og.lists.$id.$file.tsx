// Share card images: /og/lists/<id>/<content hash>.png is the card at full resolution, and .jpg is the same card as a
// small link preview. The hash versions the URL, so the current images are cached for a long time; an old hash answers
// with the current image but only briefly.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { CardRendererBusyError } from "~/server/card-renderer/pool.server"
import { hotCards } from "~/server/og-image/hot-cards.server"
import { matchesEtag } from "~/server/og-image/og-image-route.server"
import {
	type ShareCardKind,
	getShareCardImage,
} from "~/server/share-card/images.server"

const text = (status: number, body: string, cache: string) =>
	new Response(body, {
		status,
		headers: { "Content-Type": "text/plain", "Cache-Control": cache },
	})

const KINDS: Record<string, { kind: ShareCardKind; type: string }> = {
	".png": { kind: "card", type: "image/png" },
	".jpg": { kind: "preview", type: "image/jpeg" },
}

export async function loader({ params, request }: LoaderFunctionArgs) {
	const file = params.file ?? ""
	const extension = file.slice(file.lastIndexOf("."))
	const format = KINDS[extension]
	if (!format) return text(404, "Not Found", "public, max-age=60")
	const hash = file.slice(0, -extension.length)

	let result: Awaited<ReturnType<typeof getShareCardImage>>
	try {
		result = await getShareCardImage(params.id ?? "", hash, format.kind)
	} catch (error) {
		if (error instanceof CardRendererBusyError)
			return new Response("Renderer busy", {
				status: 503,
				headers: {
					"Content-Type": "text/plain",
					"Retry-After": "5",
					"Cache-Control": "no-store",
				},
			})
		console.error("[share-card] render failed", params.id, error)
		return text(500, "Render failed", "no-store")
	}
	if (!result) return text(404, "Not Found", "public, max-age=60")

	const cache = result.current
		? "public, max-age=31536000, immutable"
		: "public, max-age=60"
	// The current image is answered before Express for a moment (see hot-cards.server.ts). An old hash isn't.
	if (result.current)
		hotCards.remember(new URL(request.url).pathname, {
			image: result.image,
			etag: result.etag,
			contentType: format.type,
			cacheControl: cache,
		})
	if (matchesEtag(request, result.etag))
		return new Response(null, {
			status: 304,
			headers: { ETag: result.etag, "Cache-Control": cache },
		})
	return new Response(result.image, {
		headers: {
			ETag: result.etag,
			"Content-Type": format.type,
			"Content-Length": String(result.image.length),
			"Cache-Control": cache,
		},
	})
}
