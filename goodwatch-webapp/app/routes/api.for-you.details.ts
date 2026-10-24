import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getForYouDetails } from "~/server/for-you-page/details.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { loadTaste } from "~/server/taste/index.server"
import { getViewerContext } from "~/server/viewer.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleKey } from "~/utils/title-key"

const headers = { "Cache-Control": "private, no-store" }
async function load({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	if (!userId)
		return json({ error: "Sign in required" }, { status: 401, headers })
	const raw = new URL(request.url).searchParams.get("keys")?.split(",") ?? []
	if (
		!raw.length ||
		raw.length > 12 ||
		raw.some(
			(key) =>
				!/^(movie|show)-[1-9]\d*$/.test(key) ||
				!Number.isSafeInteger(Number(key.split("-")[1])) ||
				Number(key.split("-")[1]) >= 1e12,
		)
	)
		return json(
			{ error: "Pass up to 12 movie-N or show-N keys" },
			{ status: 400, headers },
		)
	const keys = [...new Set(raw)].map((key) => {
		const [type, id] = key.split("-")
		return titleKey(type as "movie" | "show", Number(id))
	})
	try {
		const ctx = await getViewerContext(request, undefined, userId)
		const taste = await loadTaste(ctx.viewer)
		return json(await getForYouDetails(ctx, taste, keys), { headers })
	} catch (error) {
		console.error("For you details unavailable:", error)
		return json({ error: "unavailable" }, { status: 503, headers })
	}
}
export const loader = presentCatalogLoader(load, { live: true })
