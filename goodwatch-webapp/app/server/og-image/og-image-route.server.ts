// Serves the Open Graph image for a page: /og/<page path>.png, and /og/index.png for the
// home page. Used by the og.* routes.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { getOgImage } from "~/server/og-image/og-image.server"

const notFound = () =>
	new Response("Not Found", {
		status: 404,
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": "public, max-age=60",
		},
	})

export const ogImageLoader = async ({ request }: LoaderFunctionArgs) => {
	const file = new URL(request.url).pathname.replace(/^\/og\//, "")
	if (!file.endsWith(".png")) return notFound()
	const pagePath =
		file === "index.png" ? "/" : `/${file.slice(0, -".png".length)}`

	let png: Buffer | null
	try {
		png = await getOgImage(pagePath)
	} catch (error) {
		console.error("[og-image] render failed", pagePath, error)
		return new Response("Render failed", {
			status: 500,
			headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
		})
	}
	if (!png) return notFound()

	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
			"Content-Length": String(png.length),
			"Cache-Control":
				"public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
		},
	})
}
