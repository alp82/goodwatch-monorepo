// A title's whole cast or crew from /api/title-people, searched and filtered on the server, in pages. Nothing here
// ever asks for everyone at once: Grey's Anatomy has more than 3,000 people in its cast.
//
//   const people = usePeople({ mediaType, tmdbId, kind: "cast", q, group, pageSize: 48 })
//   people.rows        every row loaded so far for (q, group), in the server's order
//   people.groups      [{ key, label, count }] for the current q (tiers or departments), for chips with live numbers
//   people.total       everyone (ignores q and group); people.matched: matches for q and group
//   people.loadMore()  the next page; people.hasMore, people.loadingMore
//   people.busy        a new q or group is on its way (the previous rows stay on screen meanwhile)
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

// The response of /api/title-people (routes/api.title-people.ts).
import type { PeoplePage, PeopleRow } from "~/utils/title-people"
export type { PeopleGroup, PeoplePage, PeopleRow } from "~/utils/title-people"

export interface PeopleQuery {
	mediaType: "movie" | "show"
	tmdbId: number
	kind: "cast" | "crew"
	/** Name, character or job; sent after a short pause in typing. */
	q?: string
	/** A tier (main | recurring | guest, top | more) or a department; "" for all. */
	group?: string
	pageSize?: number
	/** False to wait. */
	enabled?: boolean
}

/** The value after it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = window.setTimeout(() => setV(value), ms)
		return () => window.clearTimeout(id)
	}, [value, ms])
	return v
}

function peopleUrl(
	{ mediaType, tmdbId, kind, q = "", group = "" }: PeopleQuery,
	offset: number,
	limit: number,
) {
	const p = new URLSearchParams({
		type: mediaType,
		id: String(tmdbId),
		kind,
		q,
		group,
		offset: String(offset),
		limit: String(limit),
	})
	return `/api/title-people?${p}`
}

/** "466 episodes", "1 episode", or null. */
export const episodesWords = (n: number | null | undefined) =>
	n ? `${n.toLocaleString("en-US")} episode${n === 1 ? "" : "s"}` : null

export function usePeople(query: PeopleQuery) {
	const {
		mediaType,
		tmdbId,
		kind,
		group = "",
		pageSize = 60,
		enabled = true,
	} = query
	const typed = (query.q ?? "").trim()
	const q = useDebounced(typed, 220)
	const result = useInfiniteQuery({
		queryKey: ["title-people", mediaType, tmdbId, kind, q, group, pageSize],
		queryFn: async ({ pageParam, signal }) => {
			const r = await fetch(
				peopleUrl({ mediaType, tmdbId, kind, q, group }, pageParam, pageSize),
				{ signal },
			)
			if (!r.ok) throw new Error(String(r.status))
			return (await r.json()) as PeoplePage
		},
		initialPageParam: 0,
		getNextPageParam: (last: PeoplePage) => last.nextOffset ?? undefined,
		placeholderData: keepPreviousData,
		enabled,
	})
	const pages = result.data?.pages ?? []
	const first = pages[0]
	return {
		rows: pages.flatMap((p) => p.rows),
		groups: first?.groups ?? [],
		total: first?.total ?? null,
		matched: first?.matched ?? null,
		/** True once an answer for this exact q and group is in. */
		ready: Boolean(first) && !result.isPlaceholderData,
		busy:
			typed !== q ||
			result.isPlaceholderData ||
			(result.isFetching && !result.isFetchingNextPage),
		error: result.isError,
		hasMore: Boolean(result.hasNextPage),
		loadingMore: result.isFetchingNextPage,
		loadMore: () => {
			if (result.hasNextPage && !result.isFetchingNextPage)
				void result.fetchNextPage()
		},
		/** The q the rows answer (lags the typed one by the pause). */
		q,
	}
}
