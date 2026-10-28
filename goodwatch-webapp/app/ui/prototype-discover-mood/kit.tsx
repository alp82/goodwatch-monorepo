// PROTOTYPE - throwaway. Shared plumbing for the Discover mood prototype (/prototype/discover-mood?variant=…):
// - a fetch patch that sends the app's /api/ calls to the live site through the read-only proxy route, as a guest;
// - useProtoDiscover: URL-bound filter state (the real useFilterState), the text search (the real combined search) and
//   the results page (the real /api/discover/results), so every variant shows real titles and real counts;
// - TAGS: the moods, themes and styles Discover can filter by, as one list of combinable tags;
// - ProtoGrid: the real Discover grid with a Load more button.
// Variants own all layout. They may reuse any real component (FilterBar, DiscoverGrid, ReadAsChips, TitlePosterCard).
import { useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import { MOODS, MAX_MOODS, type MoodKey } from "~/domain/moods"
import {
	MAX_STYLES,
	MAX_THEMES,
	STYLES,
	THEMES,
	type StyleKey,
	type ThemeKey,
} from "~/domain/themes-styles"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { TitleCard } from "~/server/title-cards.server"
import { DiscoverGrid } from "~/ui/discover/DiscoverGrid"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import type { FilterBarCounts, TasteState } from "~/ui/filter-bar"
import { activeChips, useFilterState } from "~/ui/filter-bar"
import type { FilterGroupsData } from "~/ui/filter-bar/FilterGroups"
import type { ActiveChip } from "~/ui/filter-bar/labels"
import { useMyServices, usePeopleNames, useTitleNames } from "~/ui/filter-bar/useFilterData"
import { ladderStepFor } from "~/domain/age-content"
import { type FilterState, secondaryFilterCount, stateAsApplied } from "~/domain/filter-state"
import type { TitleKey } from "~/utils/title-key"

// ---------------------------------------------------------------------------------------------------------------
// Fetch patch: the local server has no title snapshot, so the app's read APIs come from the live site.

const PROXY = "/prototype/discover-mood/proxy"
let patched = false
export function installProxyFetch() {
	if (patched || typeof window === "undefined") return
	patched = true
	const original = window.fetch.bind(window)
	window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
		const url = new URL(raw, window.location.origin)
		if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
			const target = `${PROXY}${url.pathname}${url.search}`
			if (typeof input === "string" || input instanceof URL) return original(target, init)
			return original(new Request(target, input), init)
		}
		return original(input, init)
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Tags: what Discover can filter by today, as one list. Within a group a title fits any picked tag (the live rule);
// across groups it must fit each group. Up to three per group.

export type TagGroup = "moods" | "themes" | "styles"
export interface Tag {
	group: TagGroup
	key: string
	name: string
	color: string
	description?: string
}
export const TAGS: Tag[] = [
	...MOODS.map((m) => ({ group: "moods" as const, key: m.key, name: m.name, color: m.hue, description: m.description })),
	...THEMES.map((t) => ({ group: "themes" as const, key: t.id, name: t.name, color: t.color })),
	...STYLES.map((s) => ({ group: "styles" as const, key: s.id, name: s.name, color: s.color })),
]
export const GROUP_LABEL: Record<TagGroup, string> = { moods: "Mood", themes: "About", styles: "Style" }
const MAX: Record<TagGroup, number> = { moods: MAX_MOODS, themes: MAX_THEMES, styles: MAX_STYLES }
export const tagId = (t: Pick<Tag, "group" | "key">) => `${t.group}:${t.key}`

// Example prompts for free-text mood searches (the combined search reads these into fingerprint wants and avoids).
export const EXAMPLE_PROMPTS = [
	"cozy rainy day mystery",
	"something funny but smart",
	"a slow burn thriller with a twist",
	"feel-good movie for a bad day",
	"mind-bending sci-fi like Dark",
	"dark comedy about a heist",
	"a show to binge with my parents",
	"beautiful animated film for adults",
]

// ---------------------------------------------------------------------------------------------------------------

const GUEST_DEFAULTS = { onMyServices: false, notSeenYet: false }

export function useProtoDiscover() {
	installProxyFetch()
	const [params, setParams] = useSearchParams()
	const q = searchText(params.get("q"))
	const filters = useFilterState({ defaults: GUEST_DEFAULTS, searching: q !== null })

	const setQ = (text: string | null) => {
		const next = new URLSearchParams(params)
		const value = (text ?? "").trim()
		if (value) next.set("q", value)
		else next.delete("q")
		setParams(next, { replace: true, preventScrollReset: true })
	}

	// Tags, read from and written to the filter state.
	const picked: Tag[] = TAGS.filter((t) => (filters.state[t.group] as string[]).includes(t.key))
	const isOn = (t: Tag) => (filters.state[t.group] as string[]).includes(t.key)
	const toggle = (t: Tag) =>
		filters.update((s) => {
			const list = s[t.group] as string[]
			const on = list.includes(t.key)
			const next = on ? list.filter((k) => k !== t.key) : [...list, t.key].slice(-MAX[t.group])
			return { ...s, [t.group]: next }
		})
	const clearTags = () => filters.update((s) => ({ ...s, moods: [] as MoodKey[], themes: [] as ThemeKey[], styles: [] as StyleKey[] }))

	// The text search: the real combined search, streamed. Its ranked list then goes through the results endpoint.
	const eligibility = useMemo(() => searchEligibility(filters.state, { country: "US", services: [] }), [filters.state])
	const [reading, setReading] = useState<ReadingChip[]>([])
	const search = useQuery({
		queryKey: ["proto-discover-search", q, JSON.stringify(eligibility)],
		enabled: q !== null,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) => runDiscoverSearch(q ?? "", eligibility, true, signal, setReading),
	})
	useEffect(() => {
		if (q === null) setReading([])
		else if (search.data) setReading(search.data.reading)
	}, [q, search.data])

	const ranked = q !== null ? search.data?.ranked : undefined
	const waitingForSearch = q !== null && !search.data
	const [pages, setPages] = useState(1)
	const baseQuery = `${filters.query}${ranked ? `${filters.query ? "&" : ""}ranked=${ranked.join(",")}` : ""}`
	useEffect(() => setPages(1), [baseQuery])

	const results = useQuery<DiscoverResults[]>({
		queryKey: ["proto-discover-results", baseQuery, pages],
		enabled: !waitingForSearch,
		placeholderData: (previous) => previous,
		staleTime: 60_000,
		queryFn: async ({ signal }) => {
			const all: DiscoverResults[] = []
			for (let page = 1; page <= pages; page++) {
				const response = await fetch(`/api/discover/results?${baseQuery}${baseQuery ? "&" : ""}page=${page}`, { signal })
				if (!response.ok) throw new Error(`Results ${response.status}`)
				all.push((await response.json()) as DiscoverResults)
			}
			return all
		},
	})

	const first = results.data?.[0] ?? null
	const cards: TitleCard[] = useMemo(() => {
		const seen = new Set<TitleKey>()
		return (results.data ?? []).flatMap((r) => r.cards).filter((c) => !seen.has(c.key) && seen.add(c.key))
	}, [results.data])
	const counts: FilterBarCounts | null = first
		? {
				total: first.total,
				hidden: first.hidden,
				recoveries: first.recoveries,
				optionCounts: first.optionCounts,
				approximate: first.approximate,
				ladder: first.ladder,
			}
		: null
	const last = results.data?.[results.data.length - 1]
	const hasMore = Boolean(last && last.page * last.pageSize < last.total)

	return {
		q,
		setQ,
		filters,
		picked,
		isOn,
		toggle,
		clearTags,
		reading,
		/** The search is still reading or ranking the query. */
		searchBusy: q !== null && search.isFetching,
		searchError: search.error ? String(search.error) : null,
		/** Titles in the current list (the search's top 100 while searching). */
		total: first?.total ?? null,
		counts,
		cards,
		loading: results.isFetching || waitingForSearch,
		hasMore,
		loadMore: () => setPages((p) => p + 1),
		/** What a tag would leave with everything else unchanged (the results endpoint's option counts). */
		countFor: (t: Tag): number | null => first?.optionCounts?.[t.group]?.[t.key] ?? null,
	}
}

export type ProtoDiscover = ReturnType<typeof useProtoDiscover>

/** The real Discover grid, with Load more. */
export function ProtoGrid({ d }: { d: ProtoDiscover }) {
	const sentinel = useRef<HTMLDivElement>(null)
	return (
		<div className={d.loading && d.cards.length ? "opacity-70 transition-opacity" : ""}>
			<DiscoverGrid cards={d.cards} marks={null} />
			{d.loading && !d.cards.length && <div className="py-16 text-center text-gray-400">Loading…</div>}
			{!d.loading && !d.cards.length && <div className="py-16 text-center text-gray-400">Nothing fits. Remove a tag or a filter.</div>}
			{d.hasMore && (
				<div ref={sentinel} className="flex justify-center py-8">
					<button
						type="button"
						onClick={d.loadMore}
						className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700"
					>
						Load more
					</button>
				</div>
			)}
		</div>
	)
}

/** A short count, for example 12.4k. */
export const short = (n: number | null | undefined) =>
	n == null ? "" : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

// ---------------------------------------------------------------------------------------------------------------
// Round 2: the pieces FilterBar builds for its own controls, so a variant can place the real controls, chips and
// filter cards anywhere (inline, in a rail, in a panel) instead of only inside the bar and its side sheet.

export function useFilterPieces(d: ProtoDiscover, taste: TasteState = "signUp") {
	const { filters, counts } = d
	const { state } = filters
	const services = useMyServices({ country: state.streamingCountry, include: state.services })
	const titles = useTitleNames([...(state.similarTo ?? []), ...(state.loved ?? []), ...(state.disliked ?? [])], "")
	const people = usePeopleNames(state.people ?? [], "")
	const lastLadder = useRef(counts?.ladder ?? null)
	if (counts) lastLadder.current = counts.ladder ?? null
	const ladder = lastLadder.current
	const applied = useMemo(() => stateAsApplied(state, ladder), [state, ladder])
	const chips: ActiveChip[] = useMemo(
		() =>
			activeChips(applied, {
				service: (id) => services.countryProviders.find((p) => p.id === id)?.name,
				serviceLogo: (id) => services.countryProviders.find((p) => p.id === id)?.logo_path,
				title: (key) => titles.byKey.get(key)?.title,
				poster: (key) => titles.byKey.get(key)?.poster,
				person: (id) => people.byId.get(id)?.name,
				ageStep: (age) => (ladder ? ladderStepFor(ladder.steps, age).label : undefined),
			}),
		[applied, services.countryProviders, titles.byKey, people.byId, ladder],
	)
	const onChange = (next: FilterState) => filters.update(() => next)
	const notSeen = counts?.optionCounts.notSeenYet
	const notSeenHides = notSeen ? Math.max(0, (notSeen.off ?? 0) - (notSeen.on ?? 0)) : null
	/** Pass to <FilterGroups data={groups} query="" /> for the real card stack (or a search across all filters). */
	const groups: FilterGroupsData = {
		state,
		counts,
		onChange,
		myServices: services.ids,
		countryProviders: services.countryProviders,
		streamingCountry: services.country,
		taste,
		ladder,
	}
	return {
		groups,
		/** Every active filter as a chip (services included); see activeChips. */
		chips,
		secondaryCount: secondaryFilterCount(applied),
		notSeenHides,
		services,
		hasServices: filters.defaults.onMyServices || services.ids.length > 0,
		/** Props for the real <ServicesControl />. */
		servicesProps: {
			on: state.onMyServices,
			hasServices: filters.defaults.onMyServices || services.ids.length > 0,
			providers: services.providers,
			everywherePreview: chips.find((c) => c.key === "services"),
			labels: {
				everywhere:
					!state.onMyServices && state.services?.length
						? `${state.services.length} selected`
						: !state.onMyServices && state.anyService
							? "Any service"
							: "Everywhere",
			},
			onChange: (on: boolean) => filters.set({ onMyServices: on, anyService: undefined, services: undefined }),
			onAddServices: () => {},
		},
		/** Props for the real <NotSeenSwitch />. */
		notSeenProps: {
			on: state.notSeenYet,
			hides: notSeenHides,
			onChange: (on: boolean) => filters.set({ notSeenYet: on }),
		},
		onChange,
	}
}
