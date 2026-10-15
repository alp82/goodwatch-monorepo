import type { LoaderFunctionArgs } from "@remix-run/node"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import { EMPTY, getTitleSocial } from "~/server/talked-about-now/title-social.server"
import { getUserIdFromRequest } from "~/utils/auth"

// GET /api/social/title?type=movie|show&id=<tmdb id>: the "Talked about now" section of a title page, requested by
// the page once a visitor comes near the section. With the flag off for the viewer it answers an empty section.
// Never stored by a browser or a cache: a "wrong title?" report must take a post away at once.
const HEADERS = { "Cache-Control": "private, no-store", "Content-Type": "application/json" }
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS })

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const type = url.searchParams.get("type")
	const id = Number(url.searchParams.get("id"))
	if ((type !== "movie" && type !== "show") || !Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647)
		return answer({ error: "type must be movie or show, id a TMDB id" }, 400)

	const userId = await getUserIdFromRequest({ request })
	if (!talkedAboutNowEnabled("title", userId)) return answer(EMPTY)

	try {
		return answer(await getTitleSocial({ mediaType: type, tmdbId: id }))
	} catch (error) {
		console.error("Talked about now: title read failed", error)
		return answer(EMPTY, 503)
	}
}
