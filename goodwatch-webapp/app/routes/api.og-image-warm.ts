// Called by the browser after a page view, so the page's Open Graph card is ready and current
// by the time someone shares the link. See useOgImageWarmup.
import type { ActionFunctionArgs } from "@remix-run/node"
import { warmOgImage } from "~/server/og-image/og-image.server"

const MAX_PATH_LENGTH = 512

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return new Response(null, { status: 405 })
	// remix-serve sees HTTP behind TLS termination. Use the public origin without
	// trusting forwarded headers supplied by the caller.
	const expectedOrigin =
		process.env.APP_ORIGIN ||
		(process.env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: "http://localhost:3003")
	if (request.headers.get("origin") !== expectedOrigin)
		return new Response(null, { status: 403 })

	const path = (await request.text()).trim()
	if (!path.startsWith("/") || path.length > MAX_PATH_LENGTH)
		return new Response(null, { status: 400 })

	// Answer right away; the render runs on its own.
	warmOgImage(path).catch((error) =>
		console.warn("[og-image] warmup failed", path, error),
	)
	return new Response(null, { status: 204 })
}
