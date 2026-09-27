import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import {
	DISCOVER_MAX_PAGE,
	type DiscoverResults,
	SnapshotNotLoaded,
	discoverFilterDefaults,
	forYouFromParams,
	getDiscoverResults,
} from "~/server/discover-results.server"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import { type GuestProgress, getViewerContext } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"

// One page of Discover's browse results with the filter bar's counts, recoveries, For you movement, and cards.
// - Members: GET /api/discover/results?<filter bar parameters>&page=1
// - Guests: POST /api/discover/results?<filter bar parameters>&page=1 with { guest: { interactions, country,
//   services } }, the guest progress their browser holds. A signed-in member's POST ignores `guest`.
// Parameters are the filter bar's URL state (services, unseen, type, moods, genres, score, released, similar, people,
// sort, foryou, and the legacy Discover filters). Served while REC_FILTER_BAR lets the viewer see it; not found
// otherwise.

export type DiscoverResultsResponse = DiscoverResults

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
const notFound = () => json({ error: "Not found" }, { status: 404, headers })
const invalid = (error: string) => json({ error }, { status: 400, headers })

async function respond(request: Request, guest?: GuestProgress) {
	const startedAt = performance.now()
	const ctx = await getViewerContext(request, guest)
	const userId = ctx.viewer.kind === "member" ? ctx.viewer.userId : null
	if (!isEnabled("filterBar", { userId })) return notFound()
	const contextMs = performance.now() - startedAt

	const params = new URL(request.url).searchParams
	let response: DiscoverResults
	try {
		response = await getDiscoverResults(ctx, {
			state: filterStateFromParams(params, discoverFilterDefaults(ctx)),
			sort: sortFromParams(params, false),
			forYou: forYouFromParams(params, ctx),
			page: Math.min(
				DISCOVER_MAX_PAGE,
				Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
			),
		})
	} catch (error) {
		if (error instanceof SnapshotNotLoaded)
			return json(
				{ error: "Starting up, try again shortly" },
				{ status: 503, headers: { ...headers, "Retry-After": "5" } },
			)
		throw error
	}
	const totalMs = performance.now() - startedAt
	return json(response, {
		headers: {
			...headers,
			"Server-Timing": `viewer;dur=${contextMs.toFixed(1)}, results;dur=${(totalMs - contextMs).toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
		},
	})
}

export async function loader({ request }: LoaderFunctionArgs) {
	if (getFeatureMode("filterBar") === "off") return notFound()
	return respond(request)
}

// Query hook

/**
 * One page of results and the filter bar's counts for a filter query (useFilterState's `query`). Members GET; guests
 * POST their guest progress. The previous answer stays while the next loads, so counts don't blank between toggles.
 */
export function useDiscoverResults({
	query,
	page = 1,
	forYou,
	guest,
	enabled = true,
}: {
	query: string
	page?: number
	/** The `foryou` parameter when the view sets it. */
	forYou?: boolean
	/** A guest's progress (snapshotGuestProgress), or null for a member. */
	guest: {
		interactions: unknown[]
		country?: string | null
		services?: string | null
	} | null
	enabled?: boolean
}) {
	const params = new URLSearchParams(query)
	params.set("page", String(page))
	if (forYou !== undefined) params.set("foryou", forYou ? "1" : "0")
	const url = `/api/discover/results?${params}`
	return useQuery<DiscoverResultsResponse>({
		queryKey: ["discover-results", url, guest ? "guest" : "member"],
		queryFn: async () => {
			const response = await fetch(
				url,
				guest
					? {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ guest }),
						}
					: undefined,
			)
			if (!response.ok)
				throw new Error(`Discover results failed: ${response.status}`)
			return response.json()
		},
		placeholderData: (previous) => previous,
		enabled,
	})
}

export async function action({ request }: ActionFunctionArgs) {
	if (getFeatureMode("filterBar") === "off") return notFound()
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
