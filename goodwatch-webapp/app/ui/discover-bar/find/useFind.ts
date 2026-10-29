// Find's sources for findHits: the same searches, rows and setters the tabs use. Titles come from the title name
// search (as Search > Titles), people from the person search (as Cast and crew), Mood's rows and mixes from the Mood
// tab's hooks, the taste groups from You's. Each pick goes through the tab's own setter, so the tab, badges, status
// line and footer agree.
import { useMemo } from "react"
import { currentYear } from "~/domain/title-scales"
import { useQuickTitles } from "~/ui/filter-bar/FilterPickers"
import { parseTitleKey } from "~/utils/title-key"
import type { SubTabView } from "../DiscoverControls"
import { applyMix } from "../mood/mood-model"
import { useMixes, useMoodTab } from "../mood/useMoodData"
import { PEOPLE_CAP, usePeopleSearch } from "../search/useSearchData"
import { SUB_TABS, type SubTabId, isSubTabShown } from "../tabs"
import { findableCodes } from "../watch/made-in-choices"
import { useTasteGroups } from "../you/useTasteGroups"
import {
	type FindHit,
	type FindSources,
	type RowTotals,
	findHits,
} from "./find-model"

export interface FindFound {
	hits: FindHit[]
	/** How many titles and people the searches found, for "4 of 13". */
	totals: RowTotals
	/** A search is still answering the text as typed. */
	loading: boolean
}

export function useFind(text: string, view: SubTabView): FindFound {
	const { filters, data, member, counts, forYou } = view
	const { state } = filters
	const asking = text.trim().length >= 2
	const titles = useQuickTitles(asking ? text : "")
	const people = usePeopleSearch(asking ? text : "")
	const mood = useMoodTab(view)
	const mixes = useMixes(view)
	const groups = useTasteGroups(member)
	const ladder = data.context.ladder?.steps ?? null

	const foundTitles = useMemo(
		() =>
			titles.found.map((title) => ({
				...title,
				mediaType: parseTitleKey(title.key).mediaType,
			})),
		[titles.found],
	)
	const shown = new Set(
		SUB_TABS.filter((sub) => isSubTabShown(sub.id, state, data.context)).map(
			(sub) => sub.id,
		),
	)
	const sources: FindSources = {
		state,
		now: currentYear(),
		member,
		ladder,
		shown: (id: SubTabId) => shown.has(id),
		counts: counts?.optionCounts ?? null,
		// Retained rows belong to their original query, even before the debounce advances.
		titles: titles.query === text.trim() ? foundTitles : [],
		people: people.query === text.trim() ? people.found : [],
		moods: mood.rows,
		mixes,
		searching: Boolean(view.query?.trim()),
		services: {
			country: data.countryProviders,
			mine: data.myProviders.map((provider) => provider.id),
		},
		countries: findableCodes(state, counts?.optionCounts.productionCountries),
		groups: (groups.data ?? []).map((group) => ({
			key: group.key,
			name: group.name,
			number: group.number,
			hues: group.wordDots.map((word) => word.hue),
		})),
		forYou: forYou ? forYou.on : null,
		bestFirst: filters.sort === "match",
		acts: {
			update: filters.update,
			toggleMood: mood.toggle,
			applyMix: (mix) =>
				filters.update((current) => applyMix(current, mix, mood.prefs)),
			setForYou: forYou?.onChange,
			setBestFirst: (on) =>
				filters.setSort(
					on ? "match" : filters.searching ? "relevance" : "popular",
				),
		},
	}
	return {
		hits: findHits(text, sources),
		totals: {
			title: { n: titles.found.length, full: titles.full },
			person: {
				n: people.found.length,
				full: people.found.length >= PEOPLE_CAP,
			},
		},
		loading: asking && (titles.loading || people.loading),
	}
}
