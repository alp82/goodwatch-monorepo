import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { scoresChoiceOf } from "~/domain/profile-scores"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { profileLoader } from "~/server/profile/route.server"
import { loadProfileScoreView } from "~/server/profile/scores.server"

// Each batch resolves the profile and visibility again; authenticated responses stay private.
async function load(args: LoaderFunctionArgs) {
	const params = new URL(args.request.url).searchParams
	const tier = Number(params.get("tier"))
	const offset = Number(params.get("offset") ?? 0)
	if (
		!Number.isInteger(tier) ||
		tier < 1 ||
		tier > 10 ||
		!Number.isSafeInteger(offset) ||
		offset < 0 ||
		offset > 1_000_000
	)
		return json(
			{ error: "Invalid score tier or offset" },
			{ status: 400, headers: { "Cache-Control": "private, no-store" } },
		)
	return profileLoader(args, ({ ownerId, viewerId, shell }) =>
		loadProfileScoreView(
			ownerId,
			viewerId,
			shell,
			scoresChoiceOf(params),
			{
				tier,
				offset,
			},
			params.get("revision"),
		),
	)
}
export const loader = presentCatalogLoader(load, { live: true })
