import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getPaletteTitles } from "~/server/command-palette.server"
import type { PaletteTitles } from "~/utils/command-palette"

// The command palette's matching titles: GET /api/command-palette?q=rea returns { titles, more } with up to eight movies
// and shows and about how many more match (see command-palette.server.ts). The palette matches its destinations in the
// browser.

const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
	const started = performance.now()
	const q = new URL(request.url).searchParams.get("q") ?? ""
	let answer: PaletteTitles = { titles: [], more: 0 }
	try {
		answer = await getPaletteTitles(q)
	} catch (error) {
		// The palette still offers "Search for …" and the destinations without titles.
		console.error("Command palette title lookup failed:", error)
	}
	return json<PaletteTitles>(answer, {
		headers: {
			...headers,
			"Server-Timing": `titles;dur=${(performance.now() - started).toFixed(1)}`,
		},
	})
}
