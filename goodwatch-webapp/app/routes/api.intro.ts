// The intro film's data, which the start page's TV asks for during its boot screen (living-room/intro/HomeIntro.tsx),
// so none of it is in the page's HTML.
// - GET /api/intro: the film's titles and each scene's content (server/living-room/intro/intro.server.ts).
// - GET /api/intro?cards=movie:603,show:1396: those titles as intro cards, for the quiz's pick (at most ten).
// The answer depends on the visitor's country and services, so only the browser may keep it.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { parseCardsParam } from "~/server/living-room/intro/cards-param"
import {
	loadIntro,
	loadIntroCards,
} from "~/server/living-room/intro/intro.server"

const HEADERS = { "Cache-Control": "private, max-age=600" }

export async function loader({ request }: LoaderFunctionArgs) {
	const cards = new URL(request.url).searchParams.get("cards")
	// PROTOTYPE (start page lab): the offline lab serves the captured intro (server/prototype-start-lab.server.ts).
	if (process.env.START_LAB_FIXTURES) {
		const { startLabIntro } = await import("~/server/prototype-start-lab.server")
		const intro = startLabIntro() as { pool?: { key: number }[] } | null
		if (cards !== null) {
			const keys = new Set(parseCardsParam(cards))
			return json({ cards: (intro?.pool ?? []).filter((c) => keys.has(c.key)) }, { headers: HEADERS })
		}
		return json(intro ?? { pool: [], extra: {} }, { headers: HEADERS })
	}
	try {
		if (cards !== null) {
			const keys = parseCardsParam(cards)
			return json(
				{ cards: keys.length ? await loadIntroCards(request, keys) : [] },
				{ headers: HEADERS },
			)
		}
		return json(await loadIntro(request), { headers: HEADERS })
	} catch (error) {
		console.error("The intro's data failed", error)
		return json(
			{ error: "The intro isn't available right now." },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		)
	}
}
