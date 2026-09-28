// PROTOTYPE - throwaway. Round 3 data for the living room: tuning (attributes, service, taste seeds), the
// deck to rate, service buttons, and title details for in-TV navigation. Development only.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { getRateDeck, getServiceButtons, getTitle, tune3 } from "~/server/prototype-start-living-room.server"
import { getLocaleFromRequest } from "~/utils/locale"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const p = new URL(request.url).searchParams
	const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean).slice(0, 12)
	const country = p.get("country") || getLocaleFromRequest(request).locale.country
	try {
		switch (p.get("op")) {
			case "tune":
				return json(await tune3({ include: list("inc"), exclude: list("exc"), country, service: p.get("service"), seeds: list("seeds") }))
			case "deck":
				return json(await getRateDeck())
			case "services":
				return json(await getServiceButtons())
			case "title":
				return json(await getTitle(p.get("key") ?? "", country))
			default:
				return json({ error: "Unknown op" }, { status: 400 })
		}
	} catch (e) {
		// #220 round 2 runs without databases: the remote's streaming keys still need their labels.
		if (p.get("op") === "services") return json(FALLBACK_SERVICES)
		if (p.get("op") === "deck" || p.get("op") === "tune") return json([])
		console.error("[prototype living room] api3 failed", e)
		return json({ error: "Failed" }, { status: 503 })
	}
}

const FALLBACK_SERVICES = [
	{ key: "netflix", label: "Netflix", color: "#e50914", logo: null, ids: [8] },
	{ key: "prime", label: "Prime Video", color: "#1f8ef1", logo: null, ids: [9] },
	{ key: "disney", label: "Disney+", color: "#113ccf", logo: null, ids: [337] },
	{ key: "max", label: "Max", color: "#002be7", logo: null, ids: [1899] },
]
