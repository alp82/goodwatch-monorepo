// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// One title's pack for the play forms: its neighborhood with fingerprint levels, small enough to prefetch (see
// server/prototype-play.server.ts). Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import {
	playPack,
	playPack2,
	playPack4,
	playPack5,
} from "~/server/prototype-play.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.PROTO_CAROUSELS !== "1")
		throw new Response("Not found", {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		})
	const key = /^([ms])(\d+)$/.exec(
		new URL(request.url).searchParams.get("key") ?? "",
	)
	if (!key) throw new Response("Invalid parameters", { status: 400 })
	const started = performance.now()
	// Ninth round: `v=2` asks for the pack that reaches further, along the walk's traits when `tr` names them.
	const params = new URL(request.url).searchParams
	const type = key[1] === "m" ? "movie" : "show"
	// Tenth round: `v=4` asks for the pack in similarity order, with the walk's switches (`tr`), the flipped ones
	// (`f`), and further pages of it (`d`).
	// Eleventh round: `v=5` asks for the rings pack: the lists it brings along (`tr`, or the form's mode `m`), a
	// further page of one filter (`f`, `d`), and the visitor's country for the streaming filter (`cc`).
	const pack =
		params.get("v") === "5"
			? await playPack5(type, Number.parseInt(key[2]), {
					tr: params.get("tr") ?? "",
					m: params.get("m") ?? "",
					f: params.get("f") ?? "",
					d: params.has("d") ? Number.parseInt(params.get("d") ?? "0") || 0 : -1,
					cc: params.get("cc") ?? "",
				})
			: params.get("v") === "4"
			? await playPack4(
					type,
					Number.parseInt(key[2]),
					params.get("tr") ?? "",
					params.get("f") ?? "",
					params.has("d") ? Number.parseInt(params.get("d") ?? "0") || 0 : -1,
				)
			: params.get("v") === "2"
			? await playPack2(
					type,
					Number.parseInt(key[2]),
					(params.get("tr") ?? "").split(",").filter(Boolean).slice(0, 4),
					params.get("m") ?? "",
				)
			: await playPack(type, Number.parseInt(key[2]))
	if (!pack) throw new Response("Not found", { status: 404 })
	// A pack is the same for every visitor and changes with the catalog: the browser may keep it for ten minutes.
	return json(pack, {
		headers: {
			"Cache-Control": "private, max-age=600",
			"Server-Timing": `pack;dur=${Math.round(performance.now() - started)}`,
		},
	})
}
