import { useSearchParams } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	type FilterDefaults,
	type FilterName,
	type FilterState,
	type SortKey,
	clearSecondaryFilters,
	dropFilter,
	filterQuery,
	filterStateFromParams,
	filterStateToParams,
	secondaryFilterCount,
	sortFromParams,
} from "~/domain/filter-state"

export interface FilterStateBinding {
	state: FilterState
	sort: SortKey
	defaults: FilterDefaults
	searching: boolean
	/** How many of the Filters sheet's filters are active. */
	secondaryCount: number
	/** The filter and sort parameters alone, for fetching counts and results. */
	query: string
	update: (change: (state: FilterState) => FilterState) => void
	set: (patch: Partial<FilterState>) => void
	/**
	 * `also` changes other URL parameters in the same step (For you's `foryou`): two URL writes in one tick would lose
	 * the first.
	 */
	setSort: (sort: SortKey, also?: (params: URLSearchParams) => void) => void
	/** A one-tap recovery: the group back at its widest. */
	drop: (name: FilterName) => void
	clearSecondary: () => void
}

/**
 * The filter bar's state, bound to the URL (`services`, `unseen`, `type`, `moods`, `genres`, `score`, `match`, `released`,
 * `similar`, `people`, `sort`, and the legacy filters). Defaults are omitted from the URL; other parameters (`q`,
 * `foryou`) are kept. A change shows at once: the hook holds it until the URL catches up, so a toggle doesn't wait
 * for the navigation. URL changes replace the history entry and keep the scroll position.
 *
 * The route that uses it should skip revalidating its loader when only these parameters change, since the counts and
 * results come from the results endpoint, not the loader.
 */
export function useFilterState({
	defaults,
	searching = false,
}: {
	defaults: FilterDefaults
	searching?: boolean
}): FilterStateBinding {
	const [params, setParams] = useSearchParams()
	const urlKey = params.toString()
	const defaultsKey = `${defaults.onMyServices}-${defaults.notSeenYet}`

	// Parsed again only when the URL or the defaults change.
	const fromUrl = useMemo(
		() => ({
			state: filterStateFromParams(params, defaults),
			sort: sortFromParams(params, searching),
		}),
		[urlKey, defaultsKey, searching],
	)

	// The change the URL hasn't caught up with yet. Any URL change (ours arriving, or back and forward) ends it.
	const [pending, setPending] = useState<typeof fromUrl | null>(null)
	const latest = useRef(fromUrl)
	useEffect(() => {
		setPending(null)
	}, [urlKey])
	const current = pending ?? fromUrl
	latest.current = current

	const write = useCallback(
		(
			next: { state: FilterState; sort: SortKey },
			also?: (params: URLSearchParams) => void,
		) => {
			latest.current = next
			setPending(next)
			setParams(
				(previous) => {
					const out = filterStateToParams(
						next.state,
						defaults,
						new URLSearchParams(previous),
					)
					const plainSort = searching ? "relevance" : "popular"
					if (next.sort === plainSort) out.delete("sort")
					else out.set("sort", next.sort)
					// A new filter starts the list from its first page.
					out.delete("page")
					also?.(out)
					return out
				},
				{ replace: true, preventScrollReset: true },
			)
		},
		[setParams, defaults, searching],
	)

	const update = useCallback(
		(change: (state: FilterState) => FilterState) =>
			write({ ...latest.current, state: change(latest.current.state) }),
		[write],
	)

	return {
		state: current.state,
		sort: current.sort,
		defaults,
		searching,
		secondaryCount: secondaryFilterCount(current.state),
		query: useMemo(
			() => filterQuery(current.state, current.sort, defaults),
			[current, defaults],
		),
		update,
		set: useCallback(
			(patch: Partial<FilterState>) => update((s) => ({ ...s, ...patch })),
			[update],
		),
		setSort: useCallback(
			(sort: SortKey, also?: (params: URLSearchParams) => void) =>
				write({ ...latest.current, sort }, also),
			[write],
		),
		drop: useCallback(
			(name: FilterName) => update((s) => dropFilter(s, name)),
			[update],
		),
		clearSecondary: useCallback(() => update(clearSecondaryFilters), [update]),
	}
}
