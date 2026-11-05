import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getPaletteAnswer } from "~/server/command-palette.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import type { PaletteAnswer } from "~/utils/command-palette"

// Grouped matches, plus the unchanged legacy title fields for tabs opened before this deployment.
// Page destinations remain matched in the browser.

const headers = { "Cache-Control": "private, no-store" }

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const started = performance.now()
	const q = new URL(request.url).searchParams.get("q") ?? ""
	let answer: PaletteAnswer = { titles: [], more: 0, groups: [] }
	try {
		answer = await getPaletteAnswer(q)
	} catch (error) {
		// The palette still offers "Search for …" and the destinations without titles.
		console.error("Command palette title lookup failed:", error)
	}
	return json<PaletteAnswer>(answer, {
		headers: {
			...headers,
			"Server-Timing": `titles;dur=${(performance.now() - started).toFixed(1)}`,
		},
	})
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
