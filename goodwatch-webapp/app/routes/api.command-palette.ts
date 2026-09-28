import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getPaletteTitles } from "~/server/command-palette.server"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import { getUserIdFromRequest } from "~/utils/auth"
import type { PaletteTitle } from "~/utils/command-palette"

// The command palette's matching titles: GET /api/command-palette?q=rea returns { titles } with up to five movies and
// shows (see command-palette.server.ts). The palette matches its destinations in the browser, since they depend only
// on the viewer's features. Served while REC_NAVIGATION shows the navigation to the viewer; not found otherwise.

const headers = { "Cache-Control": "private, no-store" }

export async function loader({ request }: LoaderFunctionArgs) {
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
	let titles: PaletteTitle[] = []
	try {
		titles = await getPaletteTitles(q)
	} catch (error) {
		// The palette still offers "Search for …" and the destinations without titles.
		console.error("Command palette title lookup failed:", error)
	}
	return json<{ titles: PaletteTitle[] }>(
		{ titles },
		{
			headers: {
				...headers,
				"Server-Timing": `titles;dur=${(performance.now() - started).toFixed(1)}`,
			},
		},
	)
}
