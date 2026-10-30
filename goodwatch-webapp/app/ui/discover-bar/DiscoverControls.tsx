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
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import type { SearchScope } from "~/domain/discover-search"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { FilterBarCounts, ForYouControl } from "~/ui/filter-bar/types"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import type { TitleKey } from "~/utils/title-key"
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
import {
	type FindControls,
	FindField,
	type FindKeys,
	FindOpenButton,
	FindOverlay,
} from "./find/FindField"
import { shownSubTab } from "./panel-state"
import { FilterMix } from "./prototype-essentials/FilterMix"
import { type Level, ReadyCombo, useCombo } from "./prototype-essentials/combos"
import { useSearchParams } from "@remix-run/react"
import {
	BarStrip,
	ESSENTIAL_CHIPS,
	type EssentialsProps,
	PillPair,
	READY_V2,
	ReadySwitch,
	ThumbBar,
	type Variant,
} from "./prototype-essentials/Essentials"
import { FindComboboxProvider, SearchComboboxProvider } from "./search/combobox"
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

/** What the page knows beyond the filter state: where its search looks, what it ranked and shows, whose it is. */
export interface DiscoverPageContext {
	/** Where a search's On my services looks: the viewer's country and saved services. */
	scope: SearchScope
	/** The running search's ranked list, once it ranks; null while browsing. */
	ranked: readonly TitleKey[] | null
	/** The grid's first titles. */
	cards: readonly TitleCard[]
	/** False while the counts are still the previous answer's, or the search hasn't ranked yet. */
	countsFresh: boolean
	/** A guest's progress, sent with POST requests; null for a member. */
	guest: {
		interactions: unknown[]
		country?: string | null
		services?: string | null
	} | null
}

/** What a sub-tab's content gets from the panel. */
export interface SubTabView {
	phone: boolean
	filters: FilterStateBinding
	/** What the title filter counted; null while the first answer is on its way. */
	counts: FilterBarCounts | null
	/** Names, services, the tab context (ladder, viewer country) and chips the bar already holds. */
	data: BarData
	member: boolean
	/** The running search, or null. */
	query: string | null
	page: DiscoverPageContext
	/** The bar's search text as typed (not yet run). */
	text: string
	setText: (text: string) => void
	/** Runs the search and closes the panel. */
	runSearch: (text: string) => void
	open: (tab: MainTab, sub?: SubTabId) => void
	close: () => void
	/** The page's For you switch, for You's Order block; without it the block shows only Best match first. */
	forYou?: ForYouControl
	/** PROTOTYPE essentials F: Order lives in the heading row. */
	noOrder?: boolean
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
	page: DiscoverPageContext
	/** The page's For you switch, for You's Order block. */
	forYou?: ForYouControl
	/** A sub-tab's content; an empty area of its final height until its step fills it. */
	renderSubTab?: (id: SubTabId, view: SubTabView) => ReactNode
	/** Find's results in place of the content, while Find has text. */
	renderFind?: (
		text: string,
		view: SubTabView,
		controls: FindControls,
	) => ReactNode
	className?: string
	/** PROTOTYPE: where On my services and Not seen yet sit (prototype-essentials). */
	essentials?: Variant
	/** PROTOTYPE essentials F, phones: For you and Sort at the end of the status line. */
	phoneOrder?: ReactNode
	/** PROTOTYPE essentials J: the page title, with the count at its right. */
	heading?: ReactNode
	/** PROTOTYPE essentials J: For you + Sort at a size (style b shortens). */
	orderAt?: (level: Level) => ReactNode
}

export function DiscoverControls(props: DiscoverControlsProps) {
	return (
		<SearchComboboxProvider>
			<FindComboboxProvider>
				<DiscoverControlsContent {...props} />
			</FindComboboxProvider>
		</SearchComboboxProvider>
	)
}

function DiscoverControlsContent({
	bar,
	filters,
	counts,
	member,
	query,
	reading,
	onSearch,
	onClearSearch,
	sort,
	page,
	forYou,
	renderSubTab,
	renderFind,
	className = "",
	essentials,
	phoneOrder,
	heading,
	orderAt,
}: DiscoverControlsProps) {
	const combo = useCombo()
	const [fitParams] = useSearchParams()
	const fixedFit = fitParams.get("fit")
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
		member,
		query,
		page,
		text,
		setText,
		runSearch,
		open: openTab,
		close,
		forYou,
		noOrder: READY_V2.has(v ?? ""),
	})
	// Find's results take the field's arrow keys and Enter; a handoff ends Find in the sub-tab it opens.
	const findKeys = useRef<FindKeys | null>(null)
	const findControls: FindControls = {
		keys: findKeys,
		openSub: (id) => {
			bar.pickSub(id)
			setPhoneFind(false)
		},
	}
	const panelTab = (phone: boolean): PanelTab => ({
		tab,
		dir: panel.dir,
		subTabs,
		active,
		badges,
		onPickSub: bar.pickSub,
		finding,
		content: finding
			? (renderFind?.(panel.find, view(phone), findControls) ?? null)
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
	// PROTOTYPE J: style b's size. The widest size whose two controls leave the chips the room they need.
	// The status line renders in both the desktop and the phone block; only one is visible.
	const rows = useRef(new Set<HTMLDivElement>())
	const rowRef = useCallback((el: HTMLDivElement | null) => {
		if (el) rows.current.add(el)
	}, [])
	const measure = useRef<HTMLDivElement>(null)
	const [fit, setFit] = useState<Level>(2)
	const chipKey = data.chips.map((c) => c.key).join(",")
	useLayoutEffect(() => {
		const m = measure.current
		if (!m || !orderAt) return
		const run = () => {
			const row = [...rows.current].find((r) => r.isConnected && r.clientWidth > 0)
			if (!row) return
			const ul = row.querySelector<HTMLElement>('ul[aria-label="Active filters"]')
			const last = ul?.lastElementChild as HTMLElement | null | undefined
			const chips = Math.max(120, last ? last.offsetLeft + last.offsetWidth + 32 : 0)
			const width = (key: string) =>
				m.querySelector<HTMLElement>(`[data-m="${key}"]`)?.offsetWidth ?? 0
			const room = row.clientWidth - 36
			const levels: Level[] = desktop ? [2, 1, 0] : [1, 0]
			const pick =
				levels.find(
					(l) => (desktop ? width(`r${l}`) : 0) + width(`o${l}`) + chips <= room,
				) ?? 0
			setFit((was) => (was === pick ? was : pick))
		}
		run()
		const observer = new ResizeObserver(run)
		for (const r of rows.current) if (r.isConnected) observer.observe(r)
		return () => observer.disconnect()
	}, [desktop, chipKey, orderAt, combo])
	const ess: EssentialsProps = {
		state,
		update: filters.update,
		mine: data.myProviders,
		counts,
		member,
		open: openTab,
	}
	const v = essentials && essentials !== "0" ? essentials : null
	const statusChips = v
		? data.chips.filter((chip) => !ESSENTIAL_CHIPS.has(chip.key))
		: data.chips
	const r2 = READY_V2.has(v ?? "")
	const levelShown: Level =
		fixedFit === "0" || fixedFit === "1" || fixedFit === "2"
			? (Number(fixedFit) as Level)
			: fit
	const ready =
		v === "J" ? (
			<ReadyCombo p={ess} combo={combo} phone={false} level={levelShown} />
		) : (
			<ReadySwitch p={ess} phone={false} v2 quiet={v === "I"} />
		)
	const statusLine = (
		<StatusLine
			noCount={v === "J"}
			rowRef={v === "J" ? rowRef : undefined}
			chipLook={
				v === "J"
					? ((["a", "b", "c", "d"].includes(fitParams.get("chips") ?? "")
							? fitParams.get("chips")
							: "c") as "a" | "b" | "c" | "d")
					: undefined
			}
			counts={counts}
			searching={searching}
			chips={statusChips}
			lead={
				v === "A" && desktop ? (
					<PillPair p={ess} />
				) : desktop && (v === "G" || v === "H" || v === "J") ? (
					ready
				) : undefined
			}
			beforeSort={
				v === "C" && desktop ? (
					<ReadySwitch p={ess} phone={false} />
				) : desktop && (v === "F" || v === "I") ? (
					ready
				) : desktop && v === "J" && orderAt ? (
					orderAt(levelShown)
				) : v === "J" && orderAt ? (
					<div className="-mr-1 ml-auto">{orderAt(Math.min(levelShown, 1) as Level)}</div>
				) : desktop && v === "G" ? (
					phoneOrder
				) : r2 && !desktop ? (
					<div className="-mr-1 ml-auto">{phoneOrder}</div>
				) : undefined
			}
			meter={r2}
			state={state}
			hideSort={r2}
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
			{v === "J" && orderAt && (
				<div
					ref={measure}
					aria-hidden
					{...{ inert: "" }}
					className="pointer-events-none invisible fixed top-0 left-0 -z-10 flex flex-col items-start"
				>
					{([0, 1, 2] as Level[]).map((l) => (
						<div key={l} className="flex">
							<div data-m={`r${l}`} className="flex">
								<ReadyCombo p={ess} combo={combo} phone={false} level={l} />
							</div>
							<div data-m={`o${l}`} className="flex">
								{orderAt(l)}
							</div>
						</div>
					))}
				</div>
			)}
			{heading && (
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">{heading}</div>
					<FilterMix
						counts={counts}
						searching={searching}
						state={state}
						chips={data.chips}
						update={filters.update}
						phone={!desktop}
					/>
				</div>
			)}
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
							strip={v === "B" ? <BarStrip p={ess} phone={false} /> : undefined}
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
											keys={findKeys}
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
						strip={v === "B" ? <BarStrip p={ess} phone /> : undefined}
					/>
					{v === "A" && (
						<div className="mt-2">
							<PillPair p={ess} stretch />
						</div>
					)}
					{v === "J" && (
						<div className="mt-2">
							<ReadyCombo p={ess} combo={combo} phone />
						</div>
					)}
					{(v === "C" || (r2 && v !== "J")) && (
						<div className="mt-2">
							<ReadySwitch p={ess} phone v2={r2} />
						</div>
					)}
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
										keys={findKeys}
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
				{v === "E" && <ThumbBar p={ess} />}
			</div>
		</MotionConfig>
	)
}
