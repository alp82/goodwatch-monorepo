import type { LoaderFunctionArgs } from "@remix-run/node"
import { talkedAboutNowEnabled, talkedAboutNowMode } from "~/server/talked-about-now/flags.server"
import { EMPTY, getTitleSocial } from "~/server/talked-about-now/title-social.server"
import { withinSocialBudget } from "~/server/talked-about-now/read-budget"
import type { SocialTimings } from "~/server/talked-about-now/title-read"

// GET /api/social/title?type=movie|show&id=<tmdb id>: the "Talked about now" section of a title page, requested by
// the page once a visitor comes near the section. With the flag off for the viewer it answers an empty section.
// Never stored by a browser or a cache: a "wrong title?" report must take a post away at once.
const HEADERS = { "Cache-Control": "private, no-store", "Content-Type": "application/json" }
const answer = (body: unknown, status = 200, timings: SocialTimings = {}) => new Response(JSON.stringify(body), {
	status,
	headers: { ...HEADERS, ...(Object.keys(timings).length ? { "Server-Timing": Object.entries(timings).map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", ") } : {}) },
})

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const type = url.searchParams.get("type")
	const id = Number(url.searchParams.get("id"))
	if ((type !== "movie" && type !== "show") || !Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647)
		return answer({ error: "type must be movie or show, id a TMDB id" }, 400)

	const started = performance.now()
	const timings: SocialTimings = {}
	const mode = talkedAboutNowMode("title")
	// Public and disabled surfaces never need a session lookup, even for members.
	const userId = mode === "preview" ? await withinSocialBudget(async () =>
		(await import("~/utils/auth")).getUserIdFromRequest({ request }), 40, undefined) : undefined
	timings.social_auth = performance.now() - started
	if (!talkedAboutNowEnabled("title", userId)) return answer(EMPTY, 200, timings)

	const body = await getTitleSocial({ mediaType: type, tmdbId: id }, timings)
	timings.social_total = performance.now() - started
	return answer(body, 200, timings)
}
