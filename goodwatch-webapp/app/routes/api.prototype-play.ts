// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// One title's pack for the play forms: its neighborhood with fingerprint levels, small enough to prefetch (see
// server/prototype-play.server.ts). Not found unless the server runs with PROTO_CAROUSELS=1.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { playPack } from "~/server/prototype-play.server"

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
	const pack = await playPack(
		key[1] === "m" ? "movie" : "show",
		Number.parseInt(key[2]),
	)
	if (!pack) throw new Response("Not found", { status: 404 })
	// A pack is the same for every visitor and changes with the catalog: the browser may keep it for ten minutes.
	return json(pack, {
		headers: {
			"Cache-Control": "private, max-age=600",
			"Server-Timing": `pack;dur=${Math.round(performance.now() - started)}`,
		},
	})
}
