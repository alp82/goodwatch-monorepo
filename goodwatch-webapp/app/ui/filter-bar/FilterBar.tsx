import { TitleChipPreview } from "./TitleChipPreview"
// The shared filter bar. Desktop: one row (On my services, Not seen yet, For you where the surface has it, the sort,
// and Filters), a sub-bar with removable chips and the hidden-titles insight, and the Filters side sheet. Phones: the
// active chips where the bar sits, and the slab fixed at the bottom. The surface owns the data: it binds the state
// with useFilterState, fetches counts for `filters.query`, and passes them in. It also says whether the viewer has
// taste (`taste`), which Best match and the Taste match filter need.
import { SERVICES_PATH } from "~/ui/settings/paths"
import { useNavigate } from "@remix-run/react"
import { MotionConfig } from "framer-motion"
import { type ReactNode, useMemo, useRef, useState } from "react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { ladderStepFor } from "~/domain/age-content"
import { secondaryFilterCount, stateAsApplied } from "~/domain/filter-state"
import {
	FiltersButton,
	NotSeenSwitch,
	ServicesControl,
	SortControl,
} from "./controls"
import type { FilterGroupsData } from "./FilterGroups"
import { FiltersSheet } from "./FiltersSheet"
// PROTOTYPE - throwaway: the member preview of the Filters sheet prototype.
import { PREVIEW_SERVICES, useFilterSheetVariant, useMemberPreview } from "./FilterGroups.prototype"
import { ForYouSortSplit } from "./FilterBar.prototype"
import { OneRowChips } from "./FilterGroups.prototype"
import { FILTER_ACCENTS } from "./labels"
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
	/**
	 * In place of On my services, Not seen yet and For you, on the desktop row and in the slab (Discover's sign-up key
	 * for visitors).
	 */
	signUpKey?: { row: ReactNode; slab: ReactNode }
}

export function FilterBar(props: FilterBarProps) {
	const { filters, counts, taste = "ready" } = props
	const { state } = filters
	const navigate = useNavigate()
	const [sheetOpen, setSheetOpen] = useState(false)
	const [sortOpen, setSortOpen] = useState(false)
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
	// PROTOTYPE: ?as=member pretends Netflix, Prime Video and Disney+ are saved when nothing is.
	const memberPreview = useMemberPreview()
	// PROTOTYPE: the variants also try the bar: For you | Sort split, Filters merged with the chips.
	const protoBar = useFilterSheetVariant() !== "now"
	const myIds =
		memberPreview && services.ids.length === 0
			? PREVIEW_SERVICES.filter((id) =>
					services.countryProviders.some((p) => p.id === id),
				)
			: services.ids
	const previewProviders =
		memberPreview && services.ids.length === 0
			? services.countryProviders.filter((p) => myIds.includes(p.id))
			: services.providers
	const hasServices =
		filters.defaults.onMyServices || myIds.length > 0
	// The ladder stays while new counts are on their way, so the sheet's Age & content group doesn't come and go.
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
	const onAddServices =
		props.onAddServices ?? (() => navigate(SERVICES_PATH))
	const onChange = (next: typeof state) => filters.update(() => next)
	const notSeen = counts?.optionCounts.notSeenYet
	const notSeenHides = notSeen
		? Math.max(0, (notSeen.off ?? 0) - (notSeen.on ?? 0))
		: null
	const groups: FilterGroupsData = {
		state,
		counts,
		onChange,
		myServices: myIds,
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
						providers={previewProviders}
						everywherePreview={chips.find((chip) => chip.key === "services")}
						labels={{
							everywhere:
								!state.onMyServices && state.services?.length
									? `${state.services.length} selected`
									: "Everywhere",
						}}
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
					{forYou && !protoBar && <ForYouSwitch forYou={forYou} />}
					</>
					)}
					{protoBar ? (
						<ForYouSortSplit
							forYou={props.signUpKey ? undefined : forYou}
							sort={{
								options: sorts,
								value: sort,
								onChange: pick,
								footnote: sortFootnote,
								footer: props.sortFooter,
								open: sortOpen,
								onOpenChange: setSortOpen,
								outsideIgnore: FOR_YOU_SWITCH,
							}}
						/>
					) : (
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
					)}
					{protoBar && (
						// PROTOTYPE: Filters at the row's end, the active filters on one line beside it.
						<div className="flex min-w-[14rem] flex-1 items-center gap-2">
							<FiltersButton
								count={secondaryCount}
								expanded={sheetOpen}
								onClick={() => setSheetOpen(true)}
							/>
							<OneRowChips
								chips={displayChips}
								state={state}
								onChange={onChange}
								onMore={() => setSheetOpen(true)}
								className="flex-1"
								trailing={
									<button
										type="button"
										onClick={filters.clearSecondary}
										className="h-8 shrink-0 px-1.5 text-[13px] text-gray-500 cursor-pointer hover:text-white"
									>
										Clear
									</button>
								}
							/>
						</div>
					)}
					{!protoBar && (
					<div className="ml-auto flex items-center gap-2.5">
						{props.rowTrail}
						<FiltersButton
							count={secondaryCount}
							expanded={sheetOpen}
							onClick={() => setSheetOpen(true)}
						/>
					</div>
					)}
				</div>
				{protoBar ? null : (
				<FilterChips
					chips={displayChips}
					state={state}
					onChange={onChange}
					onClear={filters.clearSecondary}
					lead={props.chipLead}
					className="mt-3"
				/>
				)}
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
					chips={chips}
					onClear={filters.clearSecondary}
				/>
			</div>
			<div className="lg:hidden">
				{(displayChips.length > 0 || props.chipLead) && (
					<ul
						aria-label="Active filters"
						className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
					>
						{props.chipLead}
						{displayChips.map((chip) => (
							<li key={chip.key} className="shrink-0">
								<TitleChipPreview chip={chip}>
									<button
										type="button"
										onClick={() => onChange(chip.remove(state))}
										aria-label={`Remove ${chip.label}`}
										className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-2 text-sm text-gray-100 cursor-pointer"
									>
										{protoBar && (
											<span
												className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`}
											/>
										)}
										{chip.label}
										<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
									</button>
								</TitleChipPreview>
							</li>
						))}
						{protoBar && displayChips.length > 1 && (
							<li className="shrink-0">
								<button
									type="button"
									onClick={filters.clearSecondary}
									className="flex h-8 items-center px-2 text-sm text-gray-500 cursor-pointer"
								>
									Clear
								</button>
							</li>
						)}
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
					providers={previewProviders}
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
					signUpKey={props.signUpKey?.slab}
				/>
			</div>
		</MotionConfig>
	)
}

/** Space the slab takes at the bottom of a phone screen; the page adds it below its content. */
export const SLAB_CLEARANCE = "pb-64 lg:pb-0"
