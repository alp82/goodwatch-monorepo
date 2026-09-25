// Share card images: /og/lists/<id>/<content hash>.png. The hash versions the URL, so the current card is cached
// for a long time; an old hash answers with the current card but only briefly.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { getShareCardImage } from "~/server/share-card/images.server"

const text = (status: number, body: string, cache: string) =>
	new Response(body, { status, headers: { "Content-Type": "text/plain", "Cache-Control": cache } })

export async function loader({ params }: LoaderFunctionArgs) {
	const file = params.file ?? ""
	if (!file.endsWith(".png")) return text(404, "Not Found", "public, max-age=60")
	const hash = file.slice(0, -".png".length)

	let image: Awaited<ReturnType<typeof getShareCardImage>>
	try {
		image = await getShareCardImage(params.id ?? "", hash)
	} catch (error) {
		console.error("[share-card] render failed", params.id, error)
		return text(500, "Render failed", "no-store")
	}
	if (!image) return text(404, "Not Found", "public, max-age=60")

	return new Response(image.png, {
		headers: {
			"Content-Type": "image/png",
			"Content-Length": String(image.png.length),
			"Cache-Control": image.current ? "public, max-age=31536000, immutable" : "public, max-age=60",
		},
	})
}
