// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What an explore variant shows around another title, for a step in place: the related titles of that title with
// reasons. Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	diveStage,
	exploreModel,
	ringStage,
	walkModel,
} from "~/server/prototype-carousels.server"
import { diveStageHtml } from "~/server/prototype-dive-view.server"
import {
	ringMoreHtml,
	ringStageHtml,
} from "~/server/prototype-ring-view.server"
import { walkStageHtml } from "~/server/prototype-walk.server"
import { getRelatedPanel } from "~/server/related.server"
import { isDiveVariant } from "~/ui/prototype-carousels/dive-model"
import { isExploreVariant } from "~/ui/prototype-carousels/explore-model"
import { isRingVariant } from "~/ui/prototype-carousels/ring-model"
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
			isDiveVariant(variant) ||
			isRingVariant(variant)
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
	// Fifth round: the stage around a title in a walk whose axes and traits the browser passes on. `anchor` and
	// `adir` say where the visitor started walking in one direction, `pick` and `preset` let the server choose an
	// axis, and `more` asks for the further titles of one strip.
	if (isRingVariant(variant)) {
		const keyOf = (value: string | null) => {
			const found = /^(movie|show)-(\d+)$/.exec(value ?? "")
			return found
				? { type: found[1] as "movie" | "show", id: Number.parseInt(found[2]) }
				: null
		}
		const list = (name: string) =>
			params.has(name)
				? (params.get(name) ?? "").split(",").filter(Boolean)
				: undefined
		const from = keyOf(params.get("from"))
		const anchor = keyOf(params.get("anchor"))
		const more = params.get("more")
		const ring = await ringStage({
			variant,
			type,
			tmdbId,
			axes: list("axes"),
			traits: list("traits"),
			pick: params.has("preset")
				? { preset: params.get("preset") ?? "" }
				: params.has("pick")
					? { slot: Number.parseInt(params.get("pick") ?? "0") || 0 }
					: null,
			lock: params.get("lock"),
			from: from ? { ...from, via: params.get("via") ?? "" } : null,
			anchor: anchor ? { ...anchor, dir: params.get("adir") ?? "" } : null,
			more,
		})
		if (!ring) throw new Response("Not found", { status: 404, headers })
		if (params.has("debug")) return json(ring, { headers })
		return new Response(
			more
				? ringMoreHtml(ring, more, 0)
				: ringStageHtml(ring, params.get("root") ?? ""),
			{ headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
		)
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
