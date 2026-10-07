// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What an explore variant shows around another title, for a step in place: the related titles of that title with
// reasons. Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	diveStage,
	exploreModel,
	walkModel,
} from "~/server/prototype-carousels.server"
import { diveStageHtml } from "~/server/prototype-dive-view.server"
import { walkStageHtml } from "~/server/prototype-walk.server"
import { getRelatedPanel } from "~/server/related.server"
import { isDiveVariant } from "~/ui/prototype-carousels/dive-model"
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
		!(
			isExploreVariant(variant) ||
			isWalkVariant(variant) ||
			isDiveVariant(variant)
		) ||
		(type !== "movie" && type !== "show") ||
		!/^\d+$/.test(id)
	)
		throw new Response("Invalid parameters", { status: 400, headers })
	const tmdbId = Number.parseInt(id)
	// Fourth round: the stage around a title in a walk whose axis the browser passes on. `lock` dives into one
	// direction, and `from` and `via` say where the visitor came from and which way they went.
	if (isDiveVariant(variant)) {
		const from = /^(movie|show)-(\d+)$/.exec(params.get("from") ?? "")
		const dive = await diveStage({
			variant,
			type,
			tmdbId,
			axis: params.get("axis") ?? undefined,
			lock: params.get("lock"),
			from: from
				? {
						type: from[1] as "movie" | "show",
						id: Number.parseInt(from[2]),
						via: params.get("via") ?? "",
					}
				: null,
		})
		if (!dive) throw new Response("Not found", { status: 404, headers })
		if (params.has("debug")) return json(dive, { headers })
		return new Response(diveStageHtml(dive, params.get("root") ?? ""), {
			headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
		})
	}
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
