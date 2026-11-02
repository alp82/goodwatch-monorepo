// Discover's controls above the grid: the page heading with the count at its right (FilterMix), the Discover bar, the
// status line (Ready to watch, the chips, For you + Sort), and the panel that opens from the bar (desktop) or the sheet
// (phones). On phones Ready to watch takes its own row under the bar. Both combined controls shrink to short labels or
// icons when the chips need the room (useControlSize). The page owns the data: it binds the filter state (useFilterState), keeps the bar's state
// (useDiscoverBar, whose `counts` go into its results request), runs the search, and passes the results' counts in.
//
// Keyboard: "/" opens Search from anywhere outside a text field. On desktop, Escape or a press outside the bar and
// the panel closes it; Escape in Find clears Find first. Closing returns focus to the bar's segment for the tab that was
// open (the Search segment after "/"), except after a press outside, which keeps focus where it landed. The phone sheet
// returns focus to the control that opened it, and closing phone Find returns it to the magnifier.
import { type Attach, AttForYou, AttReady, AttSort, Divider } from "~/ui/discover/prototype-easy/attached"
import { type Examples, ProtoSearch } from "~/ui/discover/prototype-easy/ProtoSearch"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import {
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import type { SearchScope } from "~/domain/discover-search"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { TitleCard } from "~/server/title-cards.server"
import { SortControl } from "~/ui/filter-bar/controls"
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
import { FilterMix } from "./FilterMix"
import { ForYouSort } from "./ForYouSort"
import { PanelFooter } from "./PanelFooter"
import { ReadyToWatch, type ReadyToWatchProps } from "./ReadyToWatch"
import { type SortChoice, StatusLine } from "./StatusLine"
import type { BarChip } from "./chips"
import {
	type FindControls,
	FindField,
	type FindKeys,
	FindOpenButton,
	FindOverlay,
} from "./find/FindField"
import { type ControlSize, useControlSize } from "./control-size"
import { shownSubTab } from "./panel-state"
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
	searchSet?: string
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
}

/** PROTOTYPE (discover-easy): what the easy content reads from the bar. */
export interface EasyApi {
	query: string | null
	reading: ReadingChip[] | undefined
	chips: readonly BarChip[]
	remove: (chip: BarChip) => void
	open?: (chip: BarChip) => void
	customize: () => void
	clearSearch: () => void
	ready: ReactNode
	phone: boolean
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
	/** The page's title; the count sits at its right. */
	heading?: ReactNode
	className?: string
	/** PROTOTYPE (discover-easy): shared search + readout; easy mode shows `easy` instead of the bar. */
	proto?: {
		mode: "easy" | "advanced"
		setMode: (mode: "easy" | "advanced") => void
		/** Under the search, in both modes. */
		renderReading?: (api: EasyApi) => ReactNode
		/** A line inside the search field, under the text, in both modes. */
		renderInside?: (api: EasyApi) => ReactNode
		modeTabs: ReactNode
		/** How Ready to watch, Sort and (Advanced) For you attach to the search bar. */
		attach: Attach
		examples?: Examples
	}
}

/** The chips Ready to watch stands in for on the status line. */
const READY_CHIPS = new Set(["on-my-services", "not-seen-yet"])

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
	heading,
	proto,
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
		member,
		query,
		page,
		text,
		setText,
		runSearch,
		open: openTab,
		close,
		forYou,
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
			chips={data.chips}
			clearCount={data.clearCount}
			onChange={filters.update}
			onClearAll={clearAllNow}
			onShow={close}
			phone={phone}
		/>
	)
	const ready: ReadyToWatchProps = {
		state,
		update: filters.update,
		mine: data.myProviders,
		member,
		open: openTab,
	}
	const chipKey = `${data.chips.map((chip) => `${chip.key}:${chip.label}`).join(",")}|${reading?.map((chip) => chip.text).join(",") ?? ""}`
	const { size, rowRef, measureRef } = useControlSize({
		desktop,
		chipKey,
		maxSize: data.chips.some((chip) => !READY_CHIPS.has(chip.key)) ? 1 : 2,
	})
	const order = (at: ControlSize) =>
		forYou ? (
			<ForYouSort
				forYou={forYou}
				sort={sort}
				size={at}
				locked={!member}
				onLocked={() => openTab("you", "taste")}
			/>
		) : (
			<SortControl {...sort} size="sm" align="right" />
		)
	// Desktop: Ready to watch leads the line; phones give it its own row above.
	const statusLine = (phone: boolean) => (
		<StatusLine
			chips={data.chips.filter((chip) => !READY_CHIPS.has(chip.key))}
			reading={reading}
			clearCount={data.clearCount}
			onOpen={openChip}
			onChange={filters.update}
			onClearSearch={onClearSearch}
			onClearAll={clearAllNow}
			lead={phone ? undefined : <ReadyToWatch ready={ready} size={size} />}
			end={order(phone ? (Math.min(size, 1) as ControlSize) : size)}
			rowRef={rowRef}
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

	// PROTOTYPE (discover-easy): what the easy content reads. In easy mode anything that opens a panel goes to Advanced.
	const toAdvanced = (tab: MainTab, sub?: SubTabId) => {
		proto?.setMode("advanced")
		openTab(tab, sub)
	}
	const easyApi: EasyApi = {
		query,
		reading,
		chips: data.chips,
		remove: (chip) => (chip.remove ? filters.update(chip.remove) : onClearSearch()),
		// Easy never switches by itself: a filter's name opens its panel only in Advanced.
		open: proto?.mode === "advanced" ? (chip) => chip.opens && openTab(tabOfSubTab(chip.opens), chip.opens) : undefined,
		customize: () => toAdvanced("mood"),
		clearSearch: onClearSearch,
		ready: <ReadyToWatch ready={{ ...ready, open: toAdvanced }} size={1} />,
		phone: !desktop,
	}
	// PROTOTYPE (discover-easy) round 8: Ready to watch and Sort attach to the search bar; For you joins in Advanced.
	// Phones always use the lip (the strip along the bar's bottom edge).
	const readyOn = state.onMyServices && (!member || state.notSeenYet)
	const toggleReady = () =>
		filters.update((s) => {
			const on = !readyOn
			const out = { ...s, onMyServices: on, anyService: undefined, services: undefined }
			return member ? { ...out, notSeenYet: on, seenBefore: on ? undefined : out.seenBefore } : out
		})
	const attach: Attach | undefined = proto ? (desktop || proto.attach === "rowsort" ? proto.attach : "lip") : undefined
	const look = attach === "segments" ? "segment" : attach === "lip" ? "lip" : "inline"
	const advanced = proto?.mode === "advanced"
	const tallSearch = proto?.examples?.how === "links" || proto?.examples?.how === "chips"
	const attReady = <AttReady on={readyOn} toggle={toggleReady} member={member} look={look} short={!desktop} />
	const attSort = <AttSort sort={sort} look={look} short={!desktop} />
	const attForYou = (
		<AttForYou forYou={forYou} locked={!member} onLocked={() => toAdvanced("you", "taste")} look={look} shown={advanced} short={!desktop} />
	)
	const readingLine = proto?.renderReading?.(easyApi)
	const lip = attach === "lip" && (
		<div className="flex min-w-0 items-center gap-1 border-t border-white/[0.07] pt-2 max-lg:justify-between">
			{attReady}
			<Divider tall={false} />
			<div className="flex min-w-0 flex-1 px-2">{desktop ? readingLine : null}</div>
			{attForYou}
			{attSort}
		</div>
	)
	const trail =
		attach === "end" || attach === "segments" ? (
			<div className="mr-2 flex h-full items-center">
				<Divider />
				{attReady}
				{attForYou}
				<Divider />
				{attSort}
			</div>
		) : attach === "prefix" ? (
			<div className="mr-2 flex h-full items-center">
				{attForYou}
				<Divider />
				{attSort}
			</div>
		) : attach === "rowsort" && desktop ? (
			tallSearch ? (
				<div className="flex h-14 items-center">
					<AttReady on={readyOn} toggle={toggleReady} member={member} look="inline" big />
				</div>
			) : (
				<div className="mr-2 flex h-full items-center">
					<Divider />
					{attReady}
				</div>
			)
		) : undefined
	const lead = attach === "prefix" ? (
		<div className="-ml-3 mr-4 flex h-full items-center">
			{attReady}
			<Divider />
		</div>
	) : undefined
	// PROTOTYPE (discover-easy): with the shared search on top, the bar's Search segment holds titles and people only.
	const like = data.chips.filter((c) => c.kind === "steer" || c.kind === "person")
	const barValues = proto
		? {
				...data.values,
				search: {
					...data.values.search,
					plain: true,
					query: null,
					label: desktop ? "Titles & people" : "Like",
					value: like.length ? like.map((c) => c.label).slice(0, 2).join(", ") + (like.length > 2 ? ` +${like.length - 2}` : "") : null,
					placeholder: desktop ? "Like a title, with a person" : "Any",
					badge: like.length,
				},
			}
		: data.values
	return (
		<MotionConfig reducedMotion="user">
			{/* Both combined controls at every size, for useControlSize; never seen or reached. */}
			<div
				ref={measureRef}
				aria-hidden
				{...{ inert: "" }}
				className="pointer-events-none invisible fixed top-0 right-full -z-10 flex flex-col items-start"
			>
				{([0, 1, 2] as ControlSize[]).map((at) => (
					<div key={at} className="flex">
						<div data-size={`ready-${at}`} className="flex">
							<ReadyToWatch ready={ready} size={at} />
						</div>
						<div data-size={`order-${at}`} className="flex">
							{order(at)}
						</div>
					</div>
				))}
			</div>
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
				{proto && (
					<>
						<ProtoSearch
							query={query}
							onClear={onClearSearch}
							phone={!desktop}
							inside={lip || undefined}
							lead={lead}
							trail={trail}
							examples={proto.examples}
						/>
					</>
				)}
				<AnimatePresence initial={false}>
				{(!proto || proto.mode === "advanced") && (<motion.div
					key="advanced"
					className={proto ? "mt-3" : ""}
					initial={proto ? { height: 0, opacity: 0, overflow: "hidden" } : false}
					animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
					exit={{ height: 0, opacity: 0, overflow: "hidden" }}
					transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
				>
				<div className="hidden lg:block">
					<div className="relative">
						<DiscoverBar
							values={barValues}
							active={desktop ? open : null}
							onPick={(next) => (next === open ? close() : openTab(next))}
							onClearSearch={onClearSearch}
							providers={providers}
							barRef={barRef}
							panelId={panelId}
							search={
								desktop && open && !proto ? (
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
					{!proto && statusLine(false)}
				</div>
				<div className="lg:hidden">
					<PhoneDiscoverBar
						values={barValues}
						onPick={openTab}
						onClearSearch={onClearSearch}
						providers={providers}
					/>
					{!proto && (
						<div className="mt-2">
							<ReadyToWatch ready={ready} size={1} />
						</div>
					)}
					{!proto && statusLine(true)}
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
								!proto &&
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
				</motion.div>)}
				</AnimatePresence>
				{proto && (
					<>
						{/* The reading of the search (unless the lip holds it), Sort over the results (rowsort), and the phone tabs. */}
						<motion.div layout="position" className="mt-3 flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2 lg:flex-nowrap">
							{(attach !== "lip" || !desktop) && <div className="order-last flex min-w-0 basis-full lg:order-1 lg:flex-1 lg:basis-auto">{readingLine}</div>}
							{attach === "rowsort" && !desktop && (
								<div className="flex h-10 items-center rounded-full ring-1 ring-white/10">{attReady}</div>
							)}
							{attach === "rowsort" && (
								<div className="flex h-10 items-center rounded-full ring-1 ring-white/10 lg:order-2">
									{attForYou}
									{attSort}
								</div>
							)}
							{!desktop && <div className="ml-auto">{proto.modeTabs}</div>}
						</motion.div>
					</>
				)}
			</div>
		</MotionConfig>
	)
}
