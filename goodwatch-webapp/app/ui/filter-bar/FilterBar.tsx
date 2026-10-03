// The shared filter bar. Desktop: one row (On my services, Not seen yet, For you where the surface has it, the sort,
// Age & content where the surface has a rating ladder, and Filters), a sub-bar with removable chips and the hidden-titles insight, and the Filters side sheet. Phones: the
// active chips where the bar sits, and the slab fixed at the bottom. The surface owns the data: it binds the state
// with useFilterState, fetches counts for `filters.query`, and passes them in. It also says whether the viewer has
// taste (`taste`), which Best match and the Taste match filter need.
import { useNavigate } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { type ReactNode, useMemo, useRef, useState } from "react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { ladderStepFor } from "~/domain/age-content"
import { secondaryFilterCount, stateAsApplied } from "~/domain/filter-state"
import { AgeContentControl } from "./AgeContent"
import {
	FiltersButton,
	NotSeenSwitch,
	ServicesControl,
	SortControl,
} from "./controls"
import type { FilterGroupsData } from "./FilterGroups"
import { FiltersSheet } from "./FiltersSheet"
import { FOR_YOU_SWITCH, ForYouSwitch, useForYouUnderBestMatch } from "./ForYou"
import {
	type SortOption,
	type TasteState,
	activeChips,
	discoverSorts,
	sortShown,
} from "./labels"
import { Slab } from "./Slab"
import { FilterChips, HiddenInsight } from "./SubBar"
import type { FilterBarCounts, ForYouControl } from "./types"
import { useMyServices, usePeopleNames, useTitleNames } from "./useFilterData"
import type { FilterStateBinding } from "./useFilterState"

export interface FilterBarProps {
	filters: FilterStateBinding
	/** What the title filter counted for `filters.query`; null while the first answer is on its way. */
	counts: FilterBarCounts | null
	/** Discover's For you switch, before the sort. */
	forYou?: ForYouControl
	/** Whether the viewer has taste, or why not (tasteStateOf of the results); ready by default. */
	taste?: TasteState
	/** Under the sorts in their menu, for example the sign-up prompt while Best match needs an account. */
	sortFooter?: ReactNode
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
	/** Phones: replaces the slab's dock row (the site navigation by default). */
	nav?: ReactNode
}

export function FilterBar(props: FilterBarProps) {
	const { filters, counts, taste = "ready" } = props
	const { state } = filters
	const navigate = useNavigate()
	const [sheetOpen, setSheetOpen] = useState(false)
	const [sortOpen, setSortOpen] = useState(false)
	const services = useMyServices()
	const titles = useTitleNames(state.similarTo ?? [], "")
	const people = usePeopleNames(state.people ?? [], "")
	const hasServices = filters.defaults.onMyServices || services.ids.length > 0
	// The ladder stays while new counts are on their way, so the Age & content control doesn't come and go.
	const lastLadder = useRef(counts?.ladder ?? null)
	if (counts) lastLadder.current = counts.ladder ?? null
	const ladder = lastLadder.current
	// What shows as active (chips here and on phones, the count on Filters and in the slab) goes by the state as it
	// applies: without a ladder the title filter ignores the age limit and content, so they show nowhere, also while
	// the first counts are on their way. The controls still change the state itself.
	const applied = useMemo(() => stateAsApplied(state, ladder), [state, ladder])
	const secondaryCount = secondaryFilterCount(applied)

	const chips = useMemo(
		() =>
			activeChips(applied, {
				service: (id) =>
					services.countryProviders.find((p) => p.id === id)?.name,
				title: (key) => titles.byKey.get(key)?.title,
				person: (id) => people.byId.get(id)?.name,
				ageStep: (age) =>
					ladder ? ladderStepFor(ladder.steps, age).label : undefined,
			}),
		[applied, services.countryProviders, titles.byKey, people.byId, ladder],
	)
	// On desktop the Age & content control says what its chips would say again, so they show only on phones.
	const rowChips = useMemo(
		() =>
			chips.filter(
				(chip) => chip.group !== "ageLimit" && chip.group !== "content",
			),
		[chips],
	)
	const sorts = props.sorts ?? discoverSorts(filters.searching, taste)
	const sort = props.sort ?? sortShown(filters.sort, filters.searching, taste)
	const onSort =
		props.onSort ??
		((key: string) => filters.setSort(key as typeof filters.sort))
	const sortFootnote =
		props.sorts || filters.searching
			? undefined
			: "Relevance joins once you search."
	const onAddServices =
		props.onAddServices ?? (() => navigate("/settings/streaming"))
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
					<ServicesControl
						on={state.onMyServices}
						hasServices={hasServices}
						providers={services.providers}
						onChange={(on) =>
							filters.set({ onMyServices: on, services: undefined })
						}
						onAddServices={onAddServices}
					/>
					<NotSeenSwitch
						on={state.notSeenYet}
						hides={notSeenHides}
						onChange={(on) => filters.set({ notSeenYet: on })}
					/>
					{forYou && <ForYouSwitch forYou={forYou} />}
					<SortControl
						options={sorts}
						value={sort}
						onChange={pick}
						footnote={sortFootnote}
						footer={props.sortFooter}
						open={sortOpen}
						onOpenChange={setSortOpen}
						outsideIgnore={FOR_YOU_SWITCH}
					/>
					<div className="ml-auto flex items-center gap-2.5">
						{props.rowTrail}
						{ladder && (
							<AgeContentControl
								state={state}
								ladder={ladder}
								counts={counts}
								onChange={onChange}
							/>
						)}
						<FiltersButton
							count={secondaryCount}
							expanded={sheetOpen}
							onClick={() => setSheetOpen(true)}
						/>
					</div>
				</div>
				<FilterChips
					chips={rowChips}
					state={state}
					onChange={onChange}
					onClear={filters.clearSecondary}
					canClear={rowChips.length < chips.length}
					lead={props.chipLead}
					className="mt-3"
				/>
				<HiddenInsight
					counts={counts}
					state={state}
					onDrop={filters.drop}
					searching={filters.searching}
					lead={props.insightLead}
					className="mt-5"
				/>
				<FiltersSheet
					open={sheetOpen}
					onClose={() => setSheetOpen(false)}
					data={groups}
					onClear={filters.clearSecondary}
				/>
			</div>
			<div className="lg:hidden">
				{(chips.length > 0 || props.chipLead) && (
					<ul
						aria-label="Active filters"
						className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
					>
						{props.chipLead}
						{chips.map((chip) => (
							<li key={chip.key} className="shrink-0">
								<button
									type="button"
									onClick={() => onChange(chip.remove(state))}
									aria-label={`Remove ${chip.label}`}
									className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 cursor-pointer"
								>
									{chip.label}
									<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
								</button>
							</li>
						))}
					</ul>
				)}
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
					sortFooter={props.sortFooter}
					forYou={props.forYou}
					searching={filters.searching}
					groups={groups}
					line={props.slabLine}
					nav={props.nav}
				/>
			</div>
		</MotionConfig>
	)
}

/** Space the slab takes at the bottom of a phone screen; the page adds it below its content. */
export const SLAB_CLEARANCE = "pb-64 lg:pb-0"
