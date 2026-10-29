// What the bar, the status line and the panel footer show beyond the filter state: the names of services, titles and
// people (useFilterData), the rating ladder of the last answer, the chips in their order, each tab's value line and
// badge, and the Clear all count.
import { useMemo, useRef } from "react"
import { ladderStepFor } from "~/domain/age-content"
import { stateAsApplied } from "~/domain/filter-state"
import { type FilterNames, activeChips } from "~/ui/filter-bar/labels"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import {
	type StreamingProvider,
	useMyServices,
	usePeopleNames,
	useTitleNames,
} from "~/ui/filter-bar/useFilterData"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import { type BarChip, barChips } from "./chips"
import {
	type MainTab,
	type TabContext,
	type TabValue,
	clearAllCount,
	tabValues,
} from "./tabs"

export interface BarData {
	context: TabContext
	names: FilterNames
	chips: BarChip[]
	values: Record<MainTab, TabValue>
	clearCount: number
	/** The viewer's saved services, with logos (On my services). */
	myProviders: StreamingProvider[]
	/** Every service of the streaming country, with logos. */
	countryProviders: StreamingProvider[]
}

export function useBarData({
	filters,
	counts,
	member,
	query,
}: {
	filters: FilterStateBinding
	counts: FilterBarCounts | null
	member: boolean
	/** The running search, or null. */
	query: string | null
}): BarData {
	const { state } = filters
	const services = useMyServices({
		country: state.streamingCountry,
		include: state.services,
	})
	const titles = useTitleNames(
		[
			...(state.similarTo ?? []),
			...(state.loved ?? []),
			...(state.disliked ?? []),
		],
		"",
	)
	const people = usePeopleNames(state.people ?? [], "")
	// The ladder stays while new counts are on their way, so Age and content doesn't come and go.
	const lastLadder = useRef(counts?.ladder ?? null)
	if (counts) lastLadder.current = counts.ladder ?? null
	const ladder = lastLadder.current

	const names = useMemo<FilterNames>(
		() => ({
			service: (id) => services.countryProviders.find((p) => p.id === id)?.name,
			serviceLogo: (id) =>
				services.countryProviders.find((p) => p.id === id)?.logo_path,
			title: (key) => titles.byKey.get(key)?.title,
			poster: (key) => titles.byKey.get(key)?.poster,
			person: (id) => people.byId.get(id)?.name,
			ageStep: (age) =>
				ladder ? ladderStepFor(ladder.steps, age).label : undefined,
		}),
		[services.countryProviders, titles.byKey, people.byId, ladder],
	)
	const context = useMemo<TabContext>(
		() => ({ member, viewerCountry: services.country, ladder, query }),
		[member, services.country, ladder, query],
	)
	const chips = useMemo(() => {
		const applied = stateAsApplied(state, ladder, member, services.country)
		return barChips(applied, activeChips(applied, names), {
			query,
			names,
			face: (id) => people.byId.get(id)?.profile,
		})
	}, [state, ladder, member, services.country, names, query, people.byId])
	const values = useMemo(
		() => tabValues(state, context, names),
		[state, context, names],
	)
	return {
		context,
		names,
		chips,
		values,
		clearCount: clearAllCount(state, context),
		myProviders: services.providers,
		countryProviders: services.countryProviders,
	}
}
