// A title's most notable reported award results, for the quick view: `?type=movie&id=872585` answers
// `{ results: NotableAward[] }`, empty for a title without rows. From memory (server/award-marks.server.ts).
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import type { NotableAward } from "~/domain/award-marks"

export async function loader({ request }: LoaderFunctionArgs) {
	const p = new URL(request.url).searchParams
	const type = p.get("type")
	const id = Number(p.get("id"))
	if (
		(type !== "movie" && type !== "show") ||
		!Number.isSafeInteger(id) ||
		id <= 0
	)
		return json({ error: "Bad title" }, { status: 400 })
	const { awardIndex } = await import("~/server/award-marks.server")
	const index = await awardIndex()
	if (!index)
		return json(
			{ error: "Award results are loading" },
			// An error, not an empty answer, so the quick view asks again instead of keeping "no results".
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		)
	return json(
		{ results: index.notable.get(`${type}:${id}`) ?? [] },
		{
			headers: {
				"Cache-Control":
					"public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
			},
		},
	)
}
