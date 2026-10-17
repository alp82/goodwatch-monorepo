// PROTOTYPE - throwaway. The film's pick (ui/prototype-landing/film-taps.tsx) as landing cards: score, services in the
// viewer's country (Germany's locally while the US read times out, as the landing loader does), and mood words.
//   GET /prototype/landing-cards?t=movie:603,show:1396
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { loadLandingCards } from "~/server/prototype-landing.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const titles = (new URL(request.url).searchParams.get("t") ?? "")
		.split(",")
		.map((one) => one.split(":"))
		.filter(([type, id]) => (type === "movie" || type === "show") && Number(id) > 0)
		.slice(0, 12)
		.map(([type, id]) => ({ media_type: type as "movie" | "show", tmdb_id: Number(id) }))
	const cards = await loadLandingCards(request, titles as never, titles.length)
	return json({ cards })
}
