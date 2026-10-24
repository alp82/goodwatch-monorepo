// What the import screens load besides the import itself: a small set of posters for the poster rows, and the rows
// whose score differs from the member's, for the conflict question's examples.
import { useQuery } from "@tanstack/react-query"
import type { ImdbImportItemsResponse } from "~/domain/imdb-import"
import type { ImportItem } from "~/domain/imports"
import type { FlowPoster } from "./ImportFlowParts"
import type { ImportResultApi } from "./ImportResult"
import { request } from "./api"

/** Enough posters to fill a wide progress row. */
export const POSTER_LIMIT = 24

/** Posters of the titles an import brings, read once per import. Empty while they load or if they can't. */
export function useImportPosters(
	api: ImportResultApi,
	id: string,
	options: { outcome?: string; limit?: number; enabled?: boolean } = {},
): FlowPoster[] {
	const { outcome, limit = POSTER_LIMIT, enabled = true } = options
	const query = useQuery({
		queryKey: ["import-posters", api, id, outcome ?? "all", limit],
		enabled,
		// The titles of an import don't change; a poster row never needs a refresh.
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: false,
		queryFn: () =>
			request<{ posters: FlowPoster[] }>(
				`${api}/${encodeURIComponent(id)}/posters?limit=${limit}${outcome ? `&outcome=${outcome}` : ""}`,
			),
	})
	return query.data?.posters ?? []
}

/** The most conflict rows read for the question's wording and examples. */
export const CONFLICT_ROWS = 200

/** One row whose score or review differs from the member's: what GoodWatch has and what the file says. */
export interface ConflictRow {
	key: string
	kind: string
	title: string
	yours: number | null
	theirs: number | null
}

/** The first rows that differ from GoodWatch, and whether those are all of them. Null while loading. */
export function useConflictRows(
	api: ImportResultApi,
	id: string,
	enabled: boolean,
): { rows: ConflictRow[]; all: boolean } | null {
	const query = useQuery({
		queryKey: ["import-conflicts", api, id],
		enabled,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: false,
		queryFn: async () => {
			const url = `${api}/${encodeURIComponent(id)}/items?outcome=conflict&offset=0&limit=${CONFLICT_ROWS}`
			if (api === "/api/imdb-import") {
				const page = await request<ImdbImportItemsResponse>(url)
				return {
					all: page.items.length >= page.total,
					rows: page.items.map(
						(item): ConflictRow => ({
							key: `${item.mediaType ?? "movie"}:${item.tmdbId}`,
							kind: item.episode ? "episode_rating" : "rating",
							title: item.title,
							yours: item.currentScore,
							theirs: item.imdbScore,
						}),
					),
				}
			}
			const page = await request<{ items: ImportItem[]; total: number }>(url)
			return {
				all: page.items.length >= page.total,
				rows: page.items.map(
					(item): ConflictRow => ({
						key: `${item.mediaType}:${item.tmdbId}`,
						kind: item.kind,
						title: item.title,
						yours: item.currentScore ?? null,
						theirs: item.score ?? null,
					}),
				),
			}
		},
	})
	if (!enabled) return { rows: [], all: true }
	if (query.isError) return { rows: [], all: false }
	return query.data ?? null
}
