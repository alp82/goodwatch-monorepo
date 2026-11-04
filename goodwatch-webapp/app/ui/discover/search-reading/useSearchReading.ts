// Discover's search reading: what the interpreter reads from the words (/api/discover/interpret), how the search uses it
// (domain/search-preferences.ts), and the items the read strip switches (read-items.ts).
//
// Two readings: the whole query's, for the items (a switched-off item stays listed), and the words switched on, for
// the search itself. With nothing switched off they're one request.
import { useSearchParams } from "@remix-run/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useRef } from "react"
import { type FilterState, resolveFilterChange } from "~/domain/filter-state"
import { type ReadPlan, type ReadProposal, readPlan } from "~/domain/search-preferences"
import { filterStateToParams } from "~/domain/filter-state"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import { type ReadItem, type Reading, readFilterChange, readItems, readText, shownState } from "./read-items"

const INTERPRET_LIMIT = 512

async function interpretWords(query: string, existing: string, signal: AbortSignal): Promise<Reading> {
	const response = await fetch("/api/discover/interpret", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query: query.slice(0, INTERPRET_LIMIT), existing }),
		signal,
	})
	if (!response.ok) throw new Error(`Interpret answered ${response.status}`)
	const body = (await response.json()) as Omit<Reading, "query">
	return { query, params: body.params, proposals: body.proposals ?? [], negated: body.negated ?? [] }
}

/** Without an answer the words are searched as they are, with the person's own filters only. */
function unread(query: string, existing: string): Reading {
	const params = new URLSearchParams(existing)
	params.set("q", query)
	return { query, params: params.toString(), proposals: [], negated: [] }
}

function useReading(text: string | null, existing: string, enabled: boolean) {
	const query = useQuery({
		queryKey: ["discover-interpret", text, existing],
		queryFn: ({ signal }) => interpretWords(text ?? "", existing, signal),
		enabled: enabled && text !== null,
		placeholderData: keepPreviousData,
		retry: false,
		refetchOnWindowFocus: false,
	})
	const fresh = text !== null && query.data && !query.isPlaceholderData ? query.data : null
	const reading = fresh ?? (text !== null && query.isError ? unread(text, existing) : null)
	// While the person's own filters read the same words again, the last reading of those words stays on screen.
	const shown = reading ?? (text !== null && query.data?.query === text ? query.data : null)
	return { reading, shown, pending: enabled && text !== null && !reading }
}

const applied = (reading: Reading) =>
	reading.proposals.filter(
		(p): p is ReadProposal => p.status === "applied" || p.status === "existing wins",
	)

function planOf(reading: Reading, existing: string, namedTitle: boolean): ReadPlan {
	return readPlan({
		params: reading.params,
		existing,
		proposals: applied(reading),
		negated: reading.negated,
		namedTitle,
	})
}

export interface SearchReading {
	/** What the whole query read, with the switched-off items. */
	items: ReadItem[]
	/** The search's plan for the words switched on; null while it's read, or with every word switched off. */
	plan: ReadPlan | null
	/** The words switched on, as the search reads them. */
	text: string | null
	/** The words the search ranks by (`q` of the reading); empty when every word became a filter. */
	words: string | null
	/** The whole query's reading is on its way. */
	pending: boolean
}

export function useSearchReading({
	typed,
	off,
	existing,
	namedTitle,
	defaults,
	enabled,
}: {
	typed: string | null
	off: readonly string[]
	/** The person's own filters, as URL parameters. */
	existing: string
	/** The search found that the words name a title: only the person's own filters apply. */
	namedTitle: boolean
	defaults: FilterStateBinding["defaults"]
	enabled: boolean
}): SearchReading {
	const text = readText(typed, off)
	const whole = useReading(typed, existing, enabled)
	const read = useReading(text, existing, enabled)
	const offKey = off.join("\u0000")
	return useMemo(() => {
		const plan = read.reading ? planOf(read.reading, existing, namedTitle) : null
		const shown = whole.shown
		let items: ReadItem[] = []
		if (shown) {
			const full = planOf(shown, existing, namedTitle)
			// Every read filter strict (a search that leaves something out, or no words left to rank): no preferences.
			const strict = plan && (plan.branch === "exclusion" || plan.branch === "catalogue")
			items = readItems({
				reading: shown,
				existing,
				plan: strict ? { ...full, preferences: [], filters: full.original } : full,
				off,
				defaults,
			})
		}
		return {
			items,
			plan,
			text,
			words: read.reading ? (new URLSearchParams(read.reading.params).get("q")?.trim() ?? "") : null,
			pending: whole.pending,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [read.reading, whole.shown, whole.pending, existing, namedTitle, offKey, defaults, text])
}

/**
 * Discover's filter binding as the controls see it while searching: the person's own filters plus the read items
 * switched on. Its changes go back as the person's own filters and switched-off items (read-items.ts). `query` is the
 * list's: the person's own filters and the hard ones read from the words.
 */
export function useReadFilters(
	own: FilterStateBinding,
	items: readonly ReadItem[],
	enabled: boolean,
	/** The list's filter query (the hard filters read from the words included), for the panels' counts. */
	query: string,
): FilterStateBinding {
	const [, setParams] = useSearchParams()
	const { defaults } = own
	const shown = useMemo(
		() => (enabled ? shownState(own.state, items, defaults) : own.state),
		[enabled, items, own.state, defaults],
	)
	// Read at call time: a panel's content can keep a callback from an earlier render.
	const latest = useRef({ shown, items, own })
	latest.current = { shown, items, own }
	const update = useCallback(
		(change: (state: FilterState) => FilterState) => {
			const { shown, items, own } = latest.current
			if (!enabled) return own.update(change)
			const next = resolveFilterChange(shown, change(shown))
			setParams(
				(previous) => {
					const result = readFilterChange({
						own: own.state,
						next,
						items,
						off: previous.getAll("off"),
						defaults,
					})
					const out = filterStateToParams(result.own, defaults, new URLSearchParams(previous))
					out.delete("off")
					for (const phrase of result.off) out.append("off", phrase)
					out.delete("page")
					return out
				},
				{ replace: true, preventScrollReset: true },
			)
		},
		[enabled, defaults, setParams],
	)
	return useMemo(
		() =>
			enabled
				? {
						...own,
						state: shown,
						query,
						update,
						set: (patch: Partial<FilterState>) => update((state) => ({ ...state, ...patch })),
					}
				: own,
		[enabled, own, shown, update, query],
	)
}
