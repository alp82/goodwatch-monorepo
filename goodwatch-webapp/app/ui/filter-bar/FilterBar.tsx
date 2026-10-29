// The shared filter bar. Desktop: one row (On my services, Not seen yet, For you and the sort as one control, and
// Filters at the end), the count line under it (what shows and hides, the biggest recoveries, the active filters under
// "N more", Clear all; popular filters while none is set), and the Filters side sheet. Phones: Filters and the most used
// filters as buttons where the bar sits, each opening the slab's sheet, and the slab fixed at the bottom. The surface owns the data: it binds the state
// with useFilterState, fetches counts for `filters.query`, and passes them in. It also says whether the viewer has
// taste (`taste`), which Best match and the Taste match filter need.
import { SERVICES_PATH } from "~/ui/settings/paths"
import { useNavigate } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { type ReactNode, useMemo, useRef, useState } from "react"
import { ladderStepFor } from "~/domain/age-content"
import { secondaryFilterCount, stateAsApplied } from "~/domain/filter-state"
import { FilterInsight } from "./ActiveFilters"
import { FiltersButton, NotSeenSwitch, ServicesControl } from "./controls"
import { PopularInline } from "./PopularFilters"
import { focusSheetOn } from "./filter-cards"
import type { FilterGroupsData } from "./FilterGroups"
import { FiltersSheet } from "./FiltersSheet"
import { FOR_YOU_SWITCH, ForYouSort, useForYouUnderBestMatch } from "./ForYou"
import { PhoneFilterRow } from "./PhoneFilterRow"
import {
	type SortOption,
	type TasteState,
	activeChips,
	discoverSorts,
	sortShown,
} from "./labels"
import { Slab } from "./Slab"
import type { FilterBarCounts, ForYouControl } from "./types"
import { useMyServices, usePeopleNames, useTitleNames } from "./useFilterData"
import type { FilterStateBinding } from "./useFilterState"

export interface FilterBarProps {
	filters: FilterStateBinding
	member?: boolean
	/** What the title filter counted for `filters.query`; null while the first answer is on its way. */
	counts: FilterBarCounts | null
	/** Discover's For you switch, before the sort. */
	forYou?: ForYouControl
	/** Whether the viewer has taste, or why not (tasteStateOf of the results); ready by default. */
	taste?: TasteState
	/** The way in to the sorts that need taste (Best match) while the viewer has no account; leads the sort menu. */
	sortSignUp?: ReactNode
	/** The sort choices; Discover's by default (Relevance only while searching). */
	sorts?: SortOption[]
	sort?: string
	onSort?: (sort: string) => void
	/** Where "Add my services" goes; the streaming settings by default. */
	onAddServices?: () => void
	/** Desktop: before On my services, and before Filters at the row's end. */
	rowLead?: ReactNode
	rowTrail?: ReactNode
	/** A first chip the surface adds to the chips. */
	chipLead?: ReactNode
	/** Desktop: before the count in the insight line. */
	insightLead?: ReactNode
	/** Phones: replaces the slab's hidden line. */
	slabLine?: ReactNode
	/**
	 * In place of On my services, Not seen yet and For you, on the desktop row and in the slab (Discover's sign-up key
	 * for visitors).
	 */
	signUpKey?: { row: ReactNode; slab: ReactNode }
}

export function FilterBar(props: FilterBarProps) {
	const { filters, counts, member = true, taste = "ready" } = props
	const { state } = filters
	const navigate = useNavigate()
	const [sheetOpen, setSheetOpen] = useState(false)
	const [sortOpen, setSortOpen] = useState(false)
	// Each tap on the phone's quick filter buttons opens the slab's sheet.
	const [phoneSheet, setPhoneSheet] = useState(0)
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
	const hasServices = filters.defaults.onMyServices || services.ids.length > 0
	// The ladder stays while new counts are on their way, so the sheet's Age & content group doesn't come and go.
	const lastLadder = useRef(counts?.ladder ?? null)
	if (counts) lastLadder.current = counts.ladder ?? null
	const ladder = lastLadder.current
	const lastFacts = useRef(counts?.facts)
	if (counts) lastFacts.current = counts.facts
	const facts = lastFacts.current
	// What shows as active (chips here and on phones, the count on Filters and in the slab) goes by the state as it
	// applies: without a ladder the title filter ignores the age limit and content, so they show nowhere, also while
	// the first counts are on their way. Guests also omit member-only choices. The controls still change the state itself.
	const applied = useMemo(
		() => stateAsApplied(state, ladder, member, services.country, facts),
		[state, ladder, member, services.country, facts],
	)
	const secondaryCount = secondaryFilterCount(applied)

	const chips = useMemo(
		() =>
			activeChips(applied, {
				service: (id) =>
					services.countryProviders.find((p) => p.id === id)?.name,
				serviceLogo: (id) =>
					services.countryProviders.find((p) => p.id === id)?.logo_path,
				title: (key) => titles.byKey.get(key)?.title,
				poster: (key) => titles.byKey.get(key)?.poster,
				person: (id) => people.byId.get(id)?.name,
				ageStep: (age) =>
					ladder ? ladderStepFor(ladder.steps, age).label : undefined,
			}),
		[applied, services.countryProviders, titles.byKey, people.byId, ladder],
	)
	// The service selection is already shown in the control above the chips.
	const displayChips = chips.filter((chip) => chip.key !== "services")
	const sorts = props.sorts ?? discoverSorts(filters.searching, taste)
	const sort = props.sort ?? sortShown(filters.sort, filters.searching, taste)
	const onSort =
		props.onSort ??
		((key: string) => filters.setSort(key as typeof filters.sort))
	const sortFootnote =
		props.sorts || filters.searching
			? undefined
			: "Relevance joins once you search."
	const onAddServices = props.onAddServices ?? (() => navigate(SERVICES_PATH))
	const onChange = (next: typeof state) => filters.update(() => next)
	const notSeen = counts?.optionCounts.notSeenYet
	const notSeenHides = notSeen
		? Math.max(0, (notSeen.off ?? 0) - (notSeen.on ?? 0))
		: null
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
	// The desktop row's For you under Best match; the slab runs its own over its own sort menu.
	const { forYou, pick } = useForYouUnderBestMatch({
		forYou: props.forYou,
		sort,
		onSort,
		open: sortOpen,
		onOpen: () => setSortOpen(true),
		onClose: () => setSortOpen(false),
	})

	return (
		<MotionConfig reducedMotion="user">
			<div className="hidden lg:block">
				<div className="flex flex-wrap items-center gap-2.5">
					{props.rowLead}
					{props.signUpKey?.row ?? (
						<>
							<ServicesControl
								on={state.onMyServices}
								hasServices={hasServices}
								providers={services.providers}
								everywherePreview={chips.find(
									(chip) => chip.key === "services",
								)}
								labels={{
									everywhere:
										!state.onMyServices && state.services?.length
											? `${state.services.length} selected`
											: !state.onMyServices && state.anyService
												? "Any service"
												: "Everywhere",
								}}
								onChange={(on) =>
									filters.set({
										onMyServices: on,
										anyService: undefined,
										services: undefined,
									})
								}
								onAddServices={onAddServices}
							/>
							<NotSeenSwitch
								on={state.notSeenYet}
								hides={notSeenHides}
								onChange={(on) => filters.set({ notSeenYet: on })}
								compact
							/>
						</>
					)}
					<ForYouSort
						forYou={props.signUpKey ? undefined : forYou}
						sort={{
							options: sorts,
							value: sort,
							onChange: pick,
							footnote: sortFootnote,
							signUp: props.sortSignUp,
							open: sortOpen,
							onOpenChange: setSortOpen,
							outsideIgnore: FOR_YOU_SWITCH,
						}}
					/>
					<div className="ml-auto flex items-center gap-2.5">
						{props.rowTrail}
						<FiltersButton
							count={secondaryCount}
							expanded={sheetOpen}
							onClick={() => setSheetOpen(true)}
							compact
						/>
					</div>
				</div>
				<FilterInsight
					counts={counts}
					chips={displayChips}
					state={state}
					onChange={onChange}
					onDrop={filters.drop}
					onClear={filters.clearSecondary}
					searching={filters.searching}
					lead={
						props.chipLead || props.insightLead ? (
							<>
								{props.chipLead}
								{props.insightLead}
							</>
						) : undefined
					}
					idle={<PopularInline data={groups} />}
					className="mt-5"
				/>
				<FiltersSheet
					open={sheetOpen}
					onClose={() => setSheetOpen(false)}
					data={groups}
					chips={chips}
					onClear={filters.clearSecondary}
				/>
			</div>
			<div className="lg:hidden">
				<PhoneFilterRow
					count={secondaryCount}
					chips={displayChips}
					state={state}
					onOpen={(key) => {
						focusSheetOn(key)
						setPhoneSheet((n) => n + 1)
					}}
				/>
				<Slab
					state={state}
					counts={counts}
					onChange={onChange}
					onDrop={filters.drop}
					onClear={filters.clearSecondary}
					secondaryCount={secondaryCount}
					hasServices={hasServices}
					providers={services.providers}
					onAddServices={onAddServices}
					sorts={sorts}
					sort={sort}
					onSort={onSort}
					sortFootnote={sortFootnote}
					sortSignUp={props.sortSignUp}
					forYou={props.forYou}
					searching={filters.searching}
					groups={groups}
					line={props.slabLine}
					signUpKey={props.signUpKey?.slab}
					openSheet={phoneSheet}
				/>
			</div>
		</MotionConfig>
	)
}

/** Space the slab takes at the bottom of a phone screen; the page adds it below its content. */
export const SLAB_CLEARANCE = "pb-64 lg:pb-0"
