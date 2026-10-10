// One title's pack for the related map of a title page: its neighborhood with the levels the chips read, small enough
// to prefetch (see server/related-map.server.ts). With `f` and `d`: a further page of that neighborhood under a
// filter. The same for every visitor, country, and language, so browsers and caches may keep it by its address.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import {
	relatedMapEnabled,
	relatedMapPack,
	relatedMapPage,
} from "~/server/related-map.server"

const noStore = { "Cache-Control": "no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	if (!relatedMapEnabled())
		throw new Response("Not found", { status: 404, headers: noStore })
	const params = new URL(request.url).searchParams
	const key = /^([ms])(\d{1,9})$/.exec(params.get("key") ?? "")
	const page = params.get("d")
	if (!key || (page !== null && !/^\d$/.test(page)))
		throw new Response("Invalid parameters", { status: 400, headers: noStore })
	const type = key[1] === "m" ? "movie" : "show"
	const id = Number.parseInt(key[2])
	try {
		const found =
			page === null
				? await relatedMapPack(type, id)
				: await relatedMapPage(type, id, params.get("f") ?? "", Number(page))
		// A title without a fingerprint has no pack, and a filter the chips can't make has no page.
		if (!found)
			throw new Response("Not found", { status: 404, headers: noStore })
		return json(found, {
			headers: { "Cache-Control": PUBLIC_DATA_CACHE_CONTROL },
		})
	} catch (error) {
		if (error instanceof Response) throw error
		console.error("Related map lookup failed", { key: key[0], error })
		return json(
			{ error: "Related titles temporarily unavailable" },
			{ status: 503, headers: { ...noStore, "Retry-After": "5" } },
		)
	}
}
