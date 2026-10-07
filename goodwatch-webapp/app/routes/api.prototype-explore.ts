// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What an explore variant shows around another title, for a step in place: the related titles of that title with
// reasons. Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { exploreModel, walkModel } from "~/server/prototype-carousels.server"
import { walkStageHtml } from "~/server/prototype-walk.server"
import { getRelatedPanel } from "~/server/related.server"
import { isExploreVariant } from "~/ui/prototype-carousels/explore-model"
import { isWalkVariant } from "~/ui/prototype-carousels/walk-model"

export async function loader({ request }: LoaderFunctionArgs) {
	const headers = { "Cache-Control": "no-store" }
	if (process.env.PROTO_CAROUSELS !== "1")
		throw new Response("Not found", { status: 404, headers })
	const params = new URL(request.url).searchParams
	const variant = params.get("variant")
	const type = params.get("type")
	const id = params.get("id") ?? ""
	if (
		!(isExploreVariant(variant) || isWalkVariant(variant)) ||
		(type !== "movie" && type !== "show") ||
		!/^\d+$/.test(id)
	)
		throw new Response("Invalid parameters", { status: 400, headers })
	const tmdbId = Number.parseInt(id)
	const panel = await getRelatedPanel({ tmdbId, sourceMediaType: type })
	// Third round: the stage around a title as markup, which the section's script swaps in. `debug` gives the model.
	if (isWalkVariant(variant)) {
		const walk = await walkModel({ variant, type, tmdbId, panel })
		if (!walk) throw new Response("Not found", { status: 404, headers })
		if (params.has("debug")) return json(walk, { headers })
		return new Response(walkStageHtml(walk, params.get("root") ?? ""), {
			headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
		})
	}
	const model = await exploreModel({ variant, type, tmdbId, panel })
	if (!model) throw new Response("Not found", { status: 404, headers })
	return json(model, { headers })
}
