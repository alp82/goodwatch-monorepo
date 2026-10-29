// Discover's controls above the grid: the Discover bar, the status line, and the panel that opens from the bar (desktop)
// or the sheet (phones). The page owns the data: it binds the filter state (useFilterState), keeps the bar's state
// (useDiscoverBar, whose `counts` go into its results request), runs the search, and passes the results' counts in.
//
// Keyboard: "/" opens Search from anywhere outside a text field. On desktop, Escape or a press outside the bar and
// the panel closes it; Escape in Find clears Find first. Closing returns focus to the bar's segment for the tab that was
// open (the Search segment after "/"), except after a press outside, which keeps focus where it landed. The phone sheet
// returns focus to the control that opened it, and closing phone Find returns it to the magnifier.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig } from "framer-motion"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import {
	DiscoverBar,
	PhoneDiscoverBar,
	SearchButton,
	SearchInput,
} from "./DiscoverBar"
import {
	DiscoverPanel,
	DiscoverSheet,
	type PanelTab,
	SubTabSlot,
} from "./DiscoverPanel"
import { PanelFooter } from "./PanelFooter"
import { type SortChoice, StatusLine } from "./StatusLine"
import type { BarChip } from "./chips"
import { FindField, FindOpenButton, FindOverlay } from "./find/FindField"
import { shownSubTab } from "./panel-state"
import {
	MAIN_TABS,
	type MainTab,
	type SubTabId,
	clearAll,
	subTabBadge,
	subTabsOf,
	tabOfSubTab,
} from "./tabs"
import { type BarData, useBarData } from "./useBarData"
import {
	type DiscoverBarState,
	useClearAll,
	useDesktop,
	useOutsideClose,
	useSlashKey,
} from "./useDiscoverBar"

/** What a sub-tab's content gets from the panel. */
export interface SubTabView {
	phone: boolean
	filters: FilterStateBinding
	/** What the title filter counted; null while the first answer is on its way. */
	counts: FilterBarCounts | null
	/** Names, services, the tab context (ladder, viewer country) and chips the bar already holds. */
	data: BarData
	/** The bar's search text as typed (not yet run). */
	text: string
	setText: (text: string) => void
	/** Runs the search and closes the panel. */
	runSearch: (text: string) => void
	open: (tab: MainTab, sub?: SubTabId) => void
	close: () => void
}

export interface DiscoverControlsProps {
	bar: DiscoverBarState
	filters: FilterStateBinding
	/** What the title filter counted; null while the first answer is on its way. */
	counts: FilterBarCounts | null
	member: boolean
	/** The running search, or null. */
	query: string | null
	/** How the search read the query. */
	reading?: ReadingChip[]
	/** Runs a search; empty text clears it. */
	onSearch: (text: string) => void
	onClearSearch: () => void
	sort: SortChoice
	/** A sub-tab's content; an empty area of its final height until its step fills it. */
	renderSubTab?: (id: SubTabId, view: SubTabView) => ReactNode
	/** Find's results in place of the content, while Find has text. */
	renderFind?: (text: string, view: SubTabView) => ReactNode
	className?: string
}

export function DiscoverControls({
	bar,
	filters,
	counts,
	member,
	query,
	reading,
	onSearch,
	onClearSearch,
	sort,
	renderSubTab,
	renderFind,
	className = "",
}: DiscoverControlsProps) {
	const { state } = filters
	const data = useBarData({ filters, counts, member, query })
	const desktop = useDesktop()
	const panelId = useId()
	const { panel } = bar
	const open = panel.open
	const searching = Boolean(query?.trim())

	// The bar's search text while the panel is open: the running search when it opens.
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const sheetField = useRef<HTMLInputElement>(null)
	const barRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const openTab = useCallback(
		(tab: MainTab, sub?: SubTabId) => {
			if (!open) setText(query ?? "")
			bar.open(tab, sub)
		},
		[open, query, bar.open],
	)
	// Desktop: once the panel has closed, focus goes back to the bar's segment for the tab that was open.
	const [refocus, setRefocus] = useState<MainTab | null>(null)
	const close = useCallback(() => {
		if (open) setRefocus(open)
		bar.close()
	}, [open, bar.close])
	useEffect(() => {
		if (!refocus || open) return
		setRefocus(null)
		if (!desktop) return
		barRef.current
			?.querySelector<HTMLElement>(`[data-tab="${refocus}"] button`)
			?.focus({ preventScroll: true })
	}, [refocus, open, desktop])
	const runSearch = (value: string) => {
		const trimmed = value.trim()
		if (trimmed) onSearch(trimmed)
		close()
	}
	const clearAllNow = useClearAll({
		query,
		clearSearch: onClearSearch,
		clearFilters: () => filters.update(clearAll),
	})
	const openChip = (chip: BarChip) =>
		chip.opens && openTab(tabOfSubTab(chip.opens), chip.opens)

	// "/" opens Search; desktop focuses the bar's field, phones the sheet's.
	const [slashed, setSlashed] = useState(0)
	useSlashKey(() => {
		openTab("search")
		setSlashed((n) => n + 1)
	})
	const finding = panel.find.trim() !== ""
	useEffect(() => {
		if (open !== "search" || finding) return
		if (desktop) field.current?.focus({ preventScroll: true })
		else if (slashed) sheetField.current?.focus({ preventScroll: true })
	}, [open, slashed, desktop])
	useOutsideClose(
		desktop && open !== null,
		(how) => (how === "escape" ? close() : bar.close()),
		panelRef,
		barRef,
	)

	// The phone sheet keeps showing its last tab while it closes.
	const [lastTab, setLastTab] = useState<MainTab>("search")
	useEffect(() => {
		if (open) setLastTab(open)
	}, [open])
	const tab = open ?? lastTab
	const subTabs = subTabsOf(tab, state, data.context)
	const active = shownSubTab(panel, tab, state, data.context)
	const badges = Object.fromEntries(
		subTabs.map((sub) => [sub.id, subTabBadge(sub.id, state, data.context)]),
	) as Partial<Record<SubTabId, number>>

	const view = (phone: boolean): SubTabView => ({
		phone,
		filters,
		counts,
		data,
		text,
		setText,
		runSearch,
		open: openTab,
		close,
	})
	const panelTab = (phone: boolean): PanelTab => ({
		tab,
		dir: panel.dir,
		subTabs,
		active,
		badges,
		onPickSub: bar.pickSub,
		finding,
		content: finding
			? (renderFind?.(panel.find, view(phone)) ?? null)
			: (renderSubTab?.(active, view(phone)) ?? (
					<SubTabSlot id={active} phone={phone} />
				)),
	})
	const footer = (phone: boolean) => (
		<PanelFooter
			counts={counts}
			searching={searching}
			state={state}
			chips={data.chips}
			clearCount={data.clearCount}
			onOpen={openChip}
			onChange={filters.update}
			onDrop={filters.drop}
			onClearSearch={onClearSearch}
			onClearAll={clearAllNow}
			onShow={close}
			phone={phone}
		/>
	)
	const statusLine = (
		<StatusLine
			counts={counts}
			searching={searching}
			chips={data.chips}
			reading={reading}
			clearCount={data.clearCount}
			sort={sort}
			onOpen={openChip}
			onChange={filters.update}
			onClearSearch={onClearSearch}
			onClearAll={clearAllNow}
			className="mt-2 lg:mt-3"
		/>
	)
	const providers = { mine: data.myProviders, country: data.countryProviders }
	const typed = text.trim()
	// Typing or focusing the bar's field on another tab moves to Search, Titles.
	const toSearch = () => {
		if (open !== "search") openTab("search", "titles")
	}

	// Phones: Find opens over the sub-tabs; Cancel or Escape on an empty field closes Find, not the sheet.
	const [phoneFind, setPhoneFind] = useState(false)
	useEffect(() => {
		if (!open) setPhoneFind(false)
	}, [open])
	const findButton = useRef<HTMLButtonElement>(null)
	const phoneFindField = useRef<HTMLInputElement>(null)
	// Focuses the field each time Find opens, also while the field from the last time is still leaving.
	useEffect(() => {
		if (phoneFind) phoneFindField.current?.focus({ preventScroll: true })
	}, [phoneFind])
	const endPhoneFind = () => {
		bar.setFind("")
		setPhoneFind(false)
		findButton.current?.focus({ preventScroll: true })
	}

	return (
		<MotionConfig reducedMotion="user">
			<div className={className}>
				<div className="hidden lg:block">
					<div className="relative">
						<DiscoverBar
							values={data.values}
							active={desktop ? open : null}
							onPick={(next) => (next === open ? close() : openTab(next))}
							onClearSearch={onClearSearch}
							providers={providers}
							barRef={barRef}
							panelId={panelId}
							search={
								desktop && open ? (
									<div className="flex items-center gap-2">
										<SearchInput
											value={text}
											onChange={(value) => {
												setText(value)
												toSearch()
											}}
											onFocus={toSearch}
											onEnter={() => runSearch(text)}
											onEscape={close}
											inputRef={field}
										/>
										<SearchButton
											onClick={() => runSearch(text)}
											empty={!typed}
										/>
									</div>
								) : undefined
							}
						/>
						<AnimatePresence>
							{desktop && open !== null && (
								<DiscoverPanel
									key="panel"
									id={panelId}
									tab={panelTab(false)}
									panelRef={panelRef}
									find={
										<FindField
											value={panel.find}
											onChange={bar.setFind}
											onEmptyEscape={close}
										/>
									}
									footer={footer(false)}
								/>
							)}
						</AnimatePresence>
					</div>
					{statusLine}
				</div>
				<div className="lg:hidden">
					<PhoneDiscoverBar
						values={data.values}
						onPick={openTab}
						onClearSearch={onClearSearch}
						providers={providers}
					/>
					{statusLine}
					{!desktop && (
						<DiscoverSheet
							open={open !== null}
							tab={panelTab(true)}
							badges={
								Object.fromEntries(
									MAIN_TABS.map((t) => [t, data.values[t].badge]),
								) as Record<MainTab, number>
							}
							onPickTab={openTab}
							onClose={close}
							initialFocus={
								slashed && open === "search" ? sheetField : undefined
							}
							find={
								<FindOpenButton
									onClick={() => setPhoneFind(true)}
									buttonRef={findButton}
								/>
							}
							findOverlay={
								<FindOverlay
									shown={phoneFind || panel.find !== ""}
									onCancel={endPhoneFind}
								>
									<FindField
										value={panel.find}
										onChange={bar.setFind}
										onEmptyEscape={endPhoneFind}
										inputRef={phoneFindField}
									/>
								</FindOverlay>
							}
							top={
								tab === "search" &&
								!finding && (
									<div className="mb-5 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
										<MagnifyingGlassIcon
											className="h-5 w-5 shrink-0 text-gray-300"
											aria-hidden
										/>
										<SearchInput
											value={text}
											onChange={setText}
											onEnter={() => runSearch(text)}
											inputRef={sheetField}
											size="md"
										/>
										<SearchButton
											onClick={() => runSearch(text)}
											empty={!typed}
											small
										/>
									</div>
								)
							}
							footer={footer(true)}
						/>
					)}
				</div>
			</div>
		</MotionConfig>
	)
}
