import { presentCatalogLoader } from "~/server/media-payload.server"
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getPaletteTitles } from "~/server/command-palette.server"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import { getUserIdFromRequest } from "~/utils/auth"
import type { PaletteTitles } from "~/utils/command-palette"

// The command palette's matching titles: GET /api/command-palette?q=rea returns { titles, more } with up to eight movies
// and shows and about how many more match (see command-palette.server.ts). The palette matches its destinations in the
// browser, since they depend only on the viewer's features. Served while REC_NAVIGATION shows the navigation to the viewer; not found otherwise.

const headers = { "Cache-Control": "private, no-store" }

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const mode = getFeatureMode("navigation")
	// Only preview needs to know who's asking, which costs a session check; on and off don't.
	const allowed =
		mode === "on" ||
		(mode === "preview" &&
			isEnabled("navigation", {
				userId: await getUserIdFromRequest({ request }),
			}))
	if (!allowed) return json({ error: "Not found" }, { status: 404, headers })

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

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
