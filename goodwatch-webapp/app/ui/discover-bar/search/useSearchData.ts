// What the Search tab reads: starter titles and people from the panel endpoint, the person search, the preview of a
// typed search, and the keyboard over a list while focus stays in the bar's search field.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import type { CastMember } from "~/server/cast.server"
import type { DiscoverPanel } from "~/server/discover-panel.server"
import type { TitleCard } from "~/server/title-cards.server"
import { useDiscoverSearch } from "~/ui/discover/useDiscoverSearch"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import type { DiscoverPageContext } from "../DiscoverControls"
import { personNote } from "./search-tab"

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return debounced
}

type PanelOf<P extends DiscoverPanel["part"]> = Extract<
	DiscoverPanel,
	{ part: P }
>

/** One panel part: members GET, guests POST their progress (as /api/discover/results). */
function usePanelPart<P extends "titles" | "people">(
	part: P,
	params: string,
	guest: DiscoverPageContext["guest"],
	enabled = true,
) {
	const { locale } = useLocale()
	const url = mediaLanguageUrl(
		`/api/discover/panel?part=${part}${params ? `&${params}` : ""}`,
		locale.language,
	)
	return useQuery<PanelOf<P>>({
		queryKey: ["discover-panel", url, guest ? "guest" : "member"],
		queryFn: async ({ signal }) => {
			const response = await fetch(url, {
				signal,
				...(guest
					? {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ guest }),
						}
					: {}),
			})
			if (!response.ok)
				throw new Error(`Discover panel failed: ${response.status}`)
			return response.json()
		},
		placeholderData: (previous) => previous,
		enabled,
	})
}

/** The 12 starter titles shown while the field is empty. */
export function useStarterTitles(
	guest: DiscoverPageContext["guest"],
	enabled = true,
) {
	const panel = usePanelPart("titles", "", guest, enabled)
	return { cards: panel.data?.cards ?? [], loading: panel.isLoading }
}

export interface PanelPerson {
	id: number
	name: string
	profile: string | null
	/** Actor, Director, Writer, or the crew job. */
	role: string
	/** Titles in these results; null for featured people. */
	count: number | null
	/** "12 titles", "Director · 20", or the role. */
	note: string
}

/**
 * Who is in the running search's or the filters' results, most titles first; well-known people when neither runs.
 * `unavailable` means the server couldn't read them: show nothing rather than an empty message.
 */
export function usePanelPeople(
	filters: FilterStateBinding,
	page: DiscoverPageContext,
	searching: boolean,
	enabled = true,
) {
	const params = new URLSearchParams(filters.query)
	if (page.ranked) params.set("ranked", page.ranked.join(","))
	// While a search is still ranking, its people wait for the ranked list.
	const panel = usePanelPart(
		"people",
		params.toString(),
		page.guest,
		enabled && (!searching || page.ranked !== null),
	)
	const data = panel.data
	const toPerson = (p: NonNullable<typeof data>["actors"][number]) => ({
		id: p.tmdb_id,
		name: p.name,
		profile: p.profile_path || null,
		role: p.role,
		count: p.count,
		note: personNote(p),
	})
	return {
		mode: data?.mode ?? (searching ? "results" : "featured"),
		actors: (data?.actors ?? []).map(toPerson) as PanelPerson[],
		crew: (data?.crew ?? []).map(toPerson) as PanelPerson[],
		unavailable: Boolean(data && "unavailable" in data && data.unavailable),
		loading: !data || panel.isPlaceholderData,
	}
}

export interface FoundPerson {
	id: number
	name: string
	profile: string | null
	department: string
	popularity: number
}

/** The cast search caps its answer at this many people. */
export const PEOPLE_CAP = 100

/** People whose name matches `text` (two letters or more), faces and the better-known first, as the sheet's picker. */
export function usePeopleSearch(text: string) {
	const term = useDebounced(text.trim(), 200)
	const query = useQuery<{ castMembers: CastMember[] }>({
		queryKey: ["filter-people-search", term],
		queryFn: async () =>
			(
				await fetch(
					`/api/cast?${new URLSearchParams({ text: term, withCast: "", withoutCast: "" })}`,
				)
			).json(),
		enabled: term.length >= 2,
		placeholderData: (previous) => previous,
	})
	const found = useMemo<FoundPerson[]>(
		() =>
			(term.length >= 2 ? (query.data?.castMembers ?? []) : [])
				.map((m) => ({
					id: m.tmdb_id,
					name: m.name,
					profile: m.profile_path || null,
					department: m.known_for_department ?? "",
					popularity: m.popularity ?? 0,
				}))
				.sort(
					(a, b) =>
						Number(!!b.profile) - Number(!!a.profile) ||
						b.popularity - a.popularity,
				),
		[query.data, term],
	)
	const asking = text.trim().length >= 2
	return {
		found,
		asking,
		full: found.length >= PEOPLE_CAP,
		loading: asking && (query.isFetching || term !== text.trim()),
	}
}

/**
 * What running `text` would show with the current filters: the count and the first cards. Starts 0.6 s after typing
 * stops, three letters or more. It shares the page's search cache, so running the text afterwards is instant.
 */
export function useSearchPreview(
	text: string,
	filters: FilterStateBinding,
	page: DiscoverPageContext,
	query: string | null,
) {
	const now = searchText(text)
	const term = useDebounced(now, 600)
	const active = term !== null && term.length >= 3 && term !== query
	const eligibility = useMemo(
		() => searchEligibility(filters.state, page.scope),
		[filters.state, page.scope],
	)
	const search = useDiscoverSearch({
		q: active ? term : null,
		filters: eligibility,
		allTitles: false,
		enabled: active,
	})
	// A partial list sent ahead of the ranking would count other titles than the run will.
	const ranked = active && !search.partial ? search.current?.ranked : undefined
	const results = useDiscoverResults({
		query: `${filters.query}${filters.query ? "&" : ""}ranked=${(ranked ?? []).join(",")}`,
		guest: page.guest,
		enabled: Boolean(ranked),
	})
	const first = ranked && !results.isPlaceholderData ? results.data : undefined
	const fresh = now !== null && now === term
	return {
		/** The preview isn't for the text as typed yet. */
		busy:
			now !== null &&
			now.length >= 3 &&
			(!fresh || search.loading || results.isFetching || !first),
		ready: fresh && active && Boolean(first),
		failed: fresh && active && (search.error !== null || results.isError),
		cards: (first?.cards ?? []) as readonly TitleCard[],
		total: first?.total ?? null,
	}
}
export type SearchPreview = ReturnType<typeof useSearchPreview>

/** Whether focus is in the bar's search field (desktop bar or phone sheet). */
const inSearchField = () =>
	document.activeElement instanceof HTMLInputElement &&
	document.activeElement.dataset.discoverSearch !== undefined

/**
 * The highlighted row of a list of `count` rows, moved by the arrow keys while typing in the bar's search field. With
 * `firstIsField`, row 0 is highlighted from the start and Enter on it is left to the field (it runs the search);
 * otherwise nothing is highlighted until an arrow moves. Enter on a highlighted row calls `onEnter(i)`. Starts over
 * when `reset` changes.
 */
export function useListNav(
	count: number,
	onEnter: (i: number) => void,
	reset: string,
	firstIsField: boolean,
) {
	const start = firstIsField ? 0 : -1
	const [active, setActive] = useState(start)
	const live = useRef({ count, onEnter, active, firstIsField })
	live.current = { count, onEnter, active, firstIsField }
	useEffect(() => setActive(start), [reset, start])
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!inSearchField()) return
			const { count, onEnter, active, firstIsField } = live.current
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				if (!count) return
				event.preventDefault()
				event.stopPropagation()
				const step = event.key === "ArrowDown" ? 1 : -1
				setActive((at) =>
					Math.max(firstIsField ? 0 : -1, Math.min(count - 1, at + step)),
				)
			} else if (
				event.key === "Enter" &&
				active >= 0 &&
				active < count &&
				!(firstIsField && active === 0)
			) {
				event.preventDefault()
				event.stopPropagation()
				onEnter(active)
			}
		}
		// Capture: the field's own Enter (run the search) must not see a row's Enter.
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
	useEffect(() => {
		if (active >= count) setActive(count - 1)
	}, [active, count])
	return { active, setActive }
}
