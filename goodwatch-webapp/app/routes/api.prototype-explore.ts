// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What an explore variant shows around another title, for a step in place: the related titles of that title with
// reasons. Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { exploreModel } from "~/server/prototype-carousels.server"
import { getRelatedPanel } from "~/server/related.server"
import { isExploreVariant } from "~/ui/prototype-carousels/explore-model"

export async function loader({ request }: LoaderFunctionArgs) {
	const headers = { "Cache-Control": "no-store" }
	if (process.env.PROTO_CAROUSELS !== "1")
		throw new Response("Not found", { status: 404, headers })
	const params = new URL(request.url).searchParams
	const variant = params.get("variant")
	const type = params.get("type")
	const id = params.get("id") ?? ""
	if (
		!isExploreVariant(variant) ||
		(type !== "movie" && type !== "show") ||
		!/^\d+$/.test(id)
	)
		throw new Response("Invalid parameters", { status: 400, headers })
	const tmdbId = Number.parseInt(id)
	const panel = await getRelatedPanel({ tmdbId, sourceMediaType: type })
	const model = await exploreModel({ variant, type, tmdbId, panel })
	if (!model) throw new Response("Not found", { status: 404, headers })
	return json(model, { headers })
}
