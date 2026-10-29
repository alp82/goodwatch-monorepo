// Discover panel pictures and mixes: GET /api/discover/panel?part=mixes|titles with the filter bar's URL state.
// Guests POST the same guest progress body as /api/discover/results; members use GET.
// `mixes` returns ready tag pairs with catalog counts and a top-title card, preserving non-tag filters.
// `titles` returns shared starter keys and viewer-specific cards. This route ignores `ranked`;
// cards show no counts during a search, since these counts describe the catalog rather than the search results.
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { z } from "zod"
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import { getDiscoverPanel, isPanelPart } from "~/server/discover-panel.server"
import {
	SnapshotNotLoaded,
	discoverFilterDefaults,
} from "~/server/discover-results.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { type GuestProgress, getViewerContext } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"

// Members GET; guests POST the same progress body as /api/discover/results.
const MAX_BODY_CHARS = 256 * 1024

const bodySchema = z.object({
	guest: z
		.object({
			interactions: z.array(z.unknown()).max(5000),
			country: z.string().nullish(),
			services: z.union([z.string(), z.array(z.number())]).nullish(),
		})
		.optional(),
})

const headers = { "Cache-Control": "private, no-store" }

const invalid = (error: string) => json({ error }, { status: 400, headers })

async function respond(request: Request, guest?: GuestProgress) {
	const startedAt = performance.now()
	const params = new URL(request.url).searchParams
	const part = params.get("part")
	if (!isPanelPart(part)) return invalid("Unknown panel part")
	const ctx = await getViewerContext(request, guest)
	const contextMs = performance.now() - startedAt
	try {
		const response = await getDiscoverPanel(ctx, part, {
			state: filterStateFromParams(params, discoverFilterDefaults(ctx)),
			sort: sortFromParams(params, false),
		})
		const totalMs = performance.now() - startedAt
		return json(response, {
			headers: {
				...headers,
				"Server-Timing": `viewer;dur=${contextMs.toFixed(1)}, ${part};dur=${(totalMs - contextMs).toFixed(1)}, endpoint;dur=${totalMs.toFixed(1)}`,
			},
		})
	} catch (error) {
		if (error instanceof SnapshotNotLoaded)
			return json(
				{ error: "Starting up, try again shortly" },
				{ status: 503, headers: { ...headers, "Retry-After": "5" } },
			)
		throw error
	}
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	return respond(request)
}

async function canonicalAction({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const text = await request.text()
	if (text.length > MAX_BODY_CHARS) return invalid("Request too large")
	let body: z.infer<typeof bodySchema>
	try {
		body = bodySchema.parse(text ? JSON.parse(text) : {})
	} catch {
		return invalid("Send { guest: { interactions, country, services } }")
	}
	return respond(request, {
		interactions: (body.guest?.interactions ?? []) as TasteInteraction[],
		country: body.guest?.country ?? null,
		services: body.guest?.services ?? null,
	})
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
export const action = presentCatalogLoader(canonicalAction, { live: true })
