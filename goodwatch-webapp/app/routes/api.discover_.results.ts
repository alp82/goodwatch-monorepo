import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { discoverSearchKeys } from "~/server/discover-search-set.server"
import { filterStateFromParams, sortFromParams } from "~/domain/filter-state"
import {
	type DiscoverResults,
	SnapshotNotLoaded,
	discoverFilterDefaults,
	forYouFromParams,
	getDiscoverResults,
} from "~/server/discover-results.server"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { type GuestProgress, getViewerContext } from "~/server/viewer.server"
import type { TasteInteraction } from "~/ui/taste/types"
import { DISCOVER_MAX_PAGE } from "~/utils/constants"
import useLocale from "~/utils/locale"
import { discoverFetch } from "~/ui/discover/discover-fetch"
import { mediaLanguageUrl } from "~/utils/media-presentation"

// One page of Discover's browse results with the filter bar's counts, recoveries, For you movement, and cards.
// - Members: GET /api/discover/results?<filter bar parameters>&page=1
// - Guests: POST /api/discover/results?<filter bar parameters>&page=1 with { guest: { interactions, country,
//   services } }, the guest progress their browser holds. A signed-in member's POST ignores `guest`.
// Parameters are the filter bar's URL state (services, unseen, type, moods, genres, score, match, released, similar,
// people, sort, foryou, and the legacy Discover filters). In search mode, `ranked` carries the search's ranked list in its plain
// order (title keys, comma-separated, at most SEARCH_RESULTS; empty when the search found nothing), and the results are
// that list filtered in memory, with Relevance as the default sort. Sides of you, for a member while For you is on:
// `sides=rows` asks for a row per side on the first page, `side=<id>` narrows the list to one side (see
// discover-sides.server.ts).

export type DiscoverResultsResponse = DiscoverResults

const MAX_BODY_CHARS = 256 * 1024

const bodySchema = z.object({
	ranked: z.array(z.number().int().gt(1e12).lt(3e12)).max(5000).optional(),
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

async function respond(
	request: Request,
	guest?: GuestProgress,
	bodyRanked?: number[],
) {
	const startedAt = performance.now()
	const ctx = await getViewerContext(request, guest)
	const contextMs = performance.now() - startedAt

	const params = new URL(request.url).searchParams
	if (bodyRanked) params.set("ranked", bodyRanked.join(","))
	const ranked = await discoverSearchKeys(params)
	const counts = params.get("counts")?.split(",")
	let response: DiscoverResults
	try {
		response = await getDiscoverResults(ctx, {
			budgetCounts: counts?.includes("budget"),
			showsCounts: counts?.includes("shows"),
			popularityCounts: counts?.includes("popularity"),
			releasedCounts: counts?.includes("released"),
			lengthCounts: counts?.includes("length"),
			originCounts: counts?.includes("origin"),
			scoresCounts: counts?.includes("scores"),
			state: filterStateFromParams(params, discoverFilterDefaults(ctx)),
			sort: sortFromParams(params, ranked !== undefined),
			ranked,
			tasteCounts: counts?.includes("taste"),
			forYou: forYouFromParams(params, ctx),
			sides: {
				rows: params.get("sides") === "rows",
				side: params.get("side"),
			},
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
			"Server-Timing": `viewer;dur=${contextMs.toFixed(1)}, results;dur=${(totalMs - contextMs).toFixed(1)}, endpoint;dur=${totalMs.toFixed(1)}`,
		},
	})
}

async function canonicalLoader({ request }: LoaderFunctionArgs) {
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
	counts = [],
	enabled = true,
}: {
	query: string
	page?: number
	/** The `foryou` parameter when the view sets it. */
	forYou?: boolean
	/** Opt-in option counts (`counts=`), for example the open Discover sub-tab's (countsFlags). */
	counts?: readonly string[]
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
	if (counts.length) params.set("counts", counts.join(","))
	const { locale } = useLocale()
	const url = mediaLanguageUrl(
		`/api/discover/results?${params}`,
		locale.language,
	)
	return useQuery<DiscoverResultsResponse>({
		queryKey: ["discover-results", url, guest ? "guest" : "member"],
		queryFn: async ({ signal }) => {
			const response = await discoverFetch(url, guest, signal)
			if (!response.ok)
				throw new Error(`Discover results failed: ${response.status}`)
			return response.json()
		},
		placeholderData: (previous, previousQuery) =>
			typeof previousQuery?.queryKey[1] === "string" &&
			new URL(
				previousQuery.queryKey[1],
				"https://goodwatch.invalid",
			).searchParams.get("displayLanguage") === locale.language
				? previous
				: undefined,
		enabled,
	})
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
	return respond(
		request,
		{
			interactions: (body.guest?.interactions ?? []) as TasteInteraction[],
			country: body.guest?.country ?? null,
			services: body.guest?.services ?? null,
		},
		body.ranked,
	)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
export const action = presentCatalogLoader(canonicalAction, { live: true })
