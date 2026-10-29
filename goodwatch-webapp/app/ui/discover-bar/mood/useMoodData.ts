// What the Mood tab reads besides the page's results: each column's switch, the counts of the groups on all of with one
// pick (an answer without that pick), the ready mixes with their counts and top titles, and the tag pictures.
import { useQuery } from "@tanstack/react-query"
import { useState, useSyncExternalStore } from "react"
import type { ExplorerWorld } from "~/domain/explorer"
import { TAG_GROUPS } from "~/domain/filter-state"
import type { TagGroup } from "~/domain/filter-state"
import { useDiscoverResults } from "~/routes/api.discover_.results"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import type { SubTabView } from "../DiscoverControls"
import {
	type CountInputs,
	type Mode,
	type ModePrefs,
	type MoodChange,
	type MoodOption,
	type MoodRow,
	type PanelMixCount,
	clearedQuery,
	groupsNeedingCleared,
	modesOf,
	moodOptionsOf,
	moodRows,
	setMode,
	togglePick,
} from "./mood-model"

// ---------------------------------------------------------------------------------------------------------------
// The switches: view state for the page's life, shared by Combos and Everything.

let prefs: ModePrefs = {}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
const EMPTY: ModePrefs = {}

export function useModePrefs(): [ModePrefs, (next: ModePrefs) => void] {
	const value = useSyncExternalStore(
		subscribe,
		() => prefs,
		() => EMPTY,
	)
	return [
		value,
		(next) => {
			prefs = next
			for (const listener of listeners) listener()
		},
	]
}

// ---------------------------------------------------------------------------------------------------------------
// Guests send their progress with each request, as the page's own results request does.

type GuestBody = {
	interactions: unknown[]
	country?: string | null
	services?: string | null
}

function useGuest(member: boolean): GuestBody | null {
	const [guest] = useState<GuestBody | null>(() => {
		if (typeof window === "undefined") return { interactions: [] }
		try {
			return snapshotGuestProgress()
		} catch {
			return { interactions: [] }
		}
	})
	return member ? null : guest
}

const postFor = (guest: GuestBody | null): RequestInit | undefined =>
	guest
		? {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ guest }),
			}
		: undefined

// ---------------------------------------------------------------------------------------------------------------
// Counts

/** A group's option counts from the answer without its picks; null while not needed or on its way. */
function useCleared(
	view: SubTabView,
	guest: GuestBody | null,
	group: TagGroup,
	needed: readonly TagGroup[],
) {
	const on = needed.includes(group)
	const params = new URLSearchParams(view.filters.query)
	if (view.page.ranked) params.set("ranked", view.page.ranked.join(","))
	const ready = !view.query?.trim() || view.page.ranked !== null
	const result = useDiscoverResults({
		query: clearedQuery(params.toString(), group),
		guest,
		enabled: on && ready,
	})
	return on && ready && result.data && !result.isPlaceholderData
		? (result.data.optionCounts[group] ?? null)
		: null
}

/** Everything optionCount needs, with the answers without a one-pick group's pick asked for as needed. */
export function useMoodCounts(
	view: SubTabView,
	prefsNow: ModePrefs,
): CountInputs {
	const { state } = view.filters
	const guest = useGuest(view.member)
	const needed = groupsNeedingCleared(state, prefsNow)
	// One request per group; only the groups that need it ask.
	const cleared = {
		moods: useCleared(view, guest, "moods", needed),
		themes: useCleared(view, guest, "themes", needed),
		styles: useCleared(view, guest, "styles", needed),
		genres: useCleared(view, guest, "genres", needed),
	}
	return {
		state,
		prefs: prefsNow,
		total: view.counts?.total ?? null,
		counts: view.counts?.optionCounts ?? null,
		recoveries: view.counts?.recoveries,
		cleared,
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Ready mixes

/** The panel's parameters: every filter but Feel, About and Style, which a mix replaces (so a pick doesn't refetch). */
function mixesQuery(query: string): string {
	const params = new URLSearchParams(query)
	for (const group of ["moods", "themes", "styles"]) params.delete(group)
	const all = (params.get("all") ?? "")
		.split(",")
		.filter((name) => name === "genres")
	if (all.length) params.set("all", all.join(","))
	else params.delete("all")
	params.delete("ranked")
	params.delete("page")
	params.set("part", "mixes")
	return params.toString()
}

export function useMixes(view: SubTabView): PanelMixCount[] | null {
	const guest = useGuest(view.member)
	const { locale } = useLocale()
	const url = mediaLanguageUrl(
		`/api/discover/panel?${mixesQuery(view.filters.query)}`,
		locale.language,
	)
	const result = useQuery<{ mixes: PanelMixCount[] }>({
		queryKey: ["discover-panel-mixes", url, guest ? "guest" : "member"],
		placeholderData: (previous) => previous,
		queryFn: async ({ signal }) => {
			const response = await fetch(url, { ...postFor(guest), signal })
			if (!response.ok)
				throw new Error(`Discover mixes failed: ${response.status}`)
			return response.json()
		},
	})
	return result.data?.mixes ?? null
}

// ---------------------------------------------------------------------------------------------------------------
// Tag pictures: one backdrop per Explorer island ("mood:cozy", "theme:crime", "style:animated").

export function useTagArt(member: boolean, enabled: boolean) {
	const guest = useGuest(member)
	const world = useQuery<ExplorerWorld>({
		queryKey: ["discover-mood-art", guest ? "guest" : "member"],
		enabled,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				"/api/explorer/world?services=all&unseen=0",
				{
					...postFor(
						guest && {
							interactions: [],
							country: guest.country ?? null,
							services: null,
						},
					),
					signal,
				},
			)
			if (!response.ok)
				throw new Error(`Explorer world failed: ${response.status}`)
			return response.json()
		},
	})
	const paths = new Map<string, string>()
	for (const map of world.data?.maps ?? [])
		for (const island of map.islands) {
			const path = island.titles.find((title) => title.backdrop)?.backdrop
			if (path) paths.set(`${map.grouping}:${island.id}`, path)
		}
	return (island: string | null) =>
		island ? (paths.get(island) ?? null) : null
}

// ---------------------------------------------------------------------------------------------------------------
// The tab: rows with counts, modes, and the changes

export function useMoodTab(view: SubTabView) {
	const [prefsNow, setPrefs] = useModePrefs()
	const inputs = useMoodCounts(view, prefsNow)
	const { state } = view.filters
	const [refusedAt, setRefusedAt] = useState<Partial<Record<TagGroup, number>>>(
		{},
	)
	const options = moodOptionsOf(state, inputs.counts)
	const rows = Object.fromEntries(
		TAG_GROUPS.map((group) => [group, moodRows(options[group], inputs)]),
	) as Record<TagGroup, MoodRow[]>
	const apply = (change: MoodChange) => {
		setPrefs(change.prefs)
		view.filters.update(() => change.state)
	}
	return {
		inputs,
		rows,
		modes: modesOf(state, prefsNow),
		prefs: prefsNow,
		refusedAt,
		toggle: (option: MoodOption) => {
			const change = togglePick(state, option, prefsNow)
			if (change) apply(change)
			else setRefusedAt((r) => ({ ...r, [option.group]: Date.now() }))
		},
		setMode: (group: TagGroup, mode: Mode) =>
			apply(setMode(state, group, mode, prefsNow)),
	}
}
