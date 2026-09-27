import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import {
	type FilterDefaults,
	type FilterState,
	type SortKey,
	filterStateFromParams,
	sortFromParams,
} from "~/domain/filter-state"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import type { FingerprintKey } from "~/server/taste/index.server"
import { loadTaste } from "~/server/taste/index.server"
import {
	type FilterResult,
	SnapshotNotLoaded,
	filterTitles,
} from "~/server/title-filter/index.server"
import {
	type GuestProgress,
	type ViewerContext,
	getViewerContext,
} from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import type { TitleKey } from "~/utils/title-key"

// One page of Discover's browse results with the filter bar's counts, recoveries, and For you movement.
// - Members: GET /api/discover/results?<filter bar parameters>&page=1
// - Guests: POST /api/discover/results?<filter bar parameters>&page=1 with { guest: { interactions, country,
//   services } }, the guest progress their browser holds. A signed-in member's POST ignores `guest`.
// Parameters are the filter bar's URL state (services, unseen, type, moods, genres, score, released, similar, people,
// sort, foryou, and the legacy Discover filters). Served while REC_FILTER_BAR lets the viewer see it; not found
// otherwise.

export const DISCOVER_RESULTS_PAGE_SIZE = 40
const MAX_PAGE = 250
const MAX_BODY_CHARS = 256 * 1024
const LEANINGS = 3
// For you works for guests from this many guest ratings (owner, #193); the match itself needs 5 liked titles.
const GUEST_FOR_YOU_RATINGS = 5

export interface DiscoverResultsResponse
	extends Omit<FilterResult, "keys" | "moved"> {
	page: number
	pageSize: number
	sort: SortKey
	state: FilterState
	/** This page's titles, in order. */
	keys: TitleKey[]
	/** Taste match per title of `keys`; null without a fingerprint or taste. */
	matches: (number | null)[]
	/** For you movement of this page's titles. */
	moved: { key: TitleKey; by: number }[]
	forYou: {
		/** The switch: the URL's `foryou`, else the member's setting. */
		on: boolean
		/** Whether it changed the order: on, and the viewer has taste. */
		applied: boolean
	}
	/** The taste explanation chips while For you applies. */
	explanation: { leanings: FingerprintKey[]; ratings: number } | null
}

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
	const state = filterStateFromParams(params, filterDefaults(ctx))
	const sort = sortFromParams(params, false)
	const page = Math.min(
		MAX_PAGE,
		Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
	)
	const foryou = params.get("foryou")
	const forYouOn =
		foryou === "0" || foryou === "1" ? foryou === "1" : ctx.forYou

	const taste = await loadTaste(ctx.viewer)
	const forYouAllowed =
		ctx.viewer.kind === "member" || taste.ratings >= GUEST_FOR_YOU_RATINGS
	const applied = forYouOn && forYouAllowed && taste.signal === "some"

	let result: FilterResult
	const filterStartedAt = performance.now()
	try {
		result = await filterTitles({
			universe: "catalog",
			state,
			sort,
			forYou: applied ? { taste, surface: "browse" } : null,
			viewer: ctx,
		})
	} catch (error) {
		if (error instanceof SnapshotNotLoaded)
			return json(
				{ error: "Starting up, try again shortly" },
				{ status: 503, headers: { ...headers, "Retry-After": "5" } },
			)
		throw error
	}
	const filterMs = performance.now() - filterStartedAt

	const from = (page - 1) * DISCOVER_RESULTS_PAGE_SIZE
	const keys = result.keys.slice(from, from + DISCOVER_RESULTS_PAGE_SIZE)
	const onPage = new Set(keys)
	const { keys: _all, moved, ...counts } = result
	const response: DiscoverResultsResponse = {
		...counts,
		page,
		pageSize: DISCOVER_RESULTS_PAGE_SIZE,
		sort,
		state,
		keys,
		matches: taste.match(keys),
		moved: (moved ?? []).filter((m) => onPage.has(m.key)),
		forYou: { on: forYouOn, applied },
		explanation: applied
			? { leanings: taste.leanings(LEANINGS), ratings: taste.ratings }
			: null,
	}
	const totalMs = performance.now() - startedAt
	return json(response, {
		headers: {
			...headers,
			"Server-Timing": `viewer;dur=${contextMs.toFixed(1)}, filter;dur=${filterMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
		},
	})
}

/** On my services for anyone with saved (or, for guests, chosen) services; Not seen yet for members and guests with progress. */
function filterDefaults(ctx: ViewerContext): FilterDefaults {
	return {
		onMyServices: ctx.services.length > 0,
		notSeenYet:
			ctx.viewer.kind === "member" ||
			ctx.viewer.progress.interactions.length > 0,
	}
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
