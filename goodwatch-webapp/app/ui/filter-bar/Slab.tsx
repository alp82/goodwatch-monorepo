// The phone slab: the filter strip docked above the site navigation's dock. Top to bottom: the hidden line, then the
// strip (On my services, Not seen yet, For you on Discover, Sort) with the 52 px Filters key. Scrolling down folds
// the hidden line away; the strip stays.
import {
	AdjustmentsHorizontalIcon,
	ArrowUpIcon,
	ArrowsUpDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { DockStrip } from "~/ui/navigation/MobileDock"
import {
	FilterGroups,
	type FilterGroupsData,
	FilterSearchField,
} from "./FilterGroups"
import { ShowTitlesButton } from "./FiltersSheet"
import { FOR_YOU_SWITCH, ForYouRow, useForYouUnderBestMatch } from "./ForYou"
import { SnapSheet } from "./SnapSheet"
// PROTOTYPE - throwaway: a shorter phone sheet for the ?variant= layouts.
import { useFilterSheetVariant } from "./FilterGroups.prototype"
import { HiddenMeter, RecoveryList } from "./SubBar"
import { ServiceStack, SortItems, radioKeys, useMenu } from "./controls"
import { type SortOption, compactCount, recoveryLabel } from "./labels"
import { Knob, MENU, RollingNumber, SPRING, TAP } from "./motion"
import type { FilterBarCounts, ForYouControl } from "./types"
import type { StreamingProvider } from "./useFilterData"

/** One segment of the slab's strip. */
export const SLAB_SEGMENT =
	"relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** Scrolling down more than 10 px folds; scrolling up unfolds; under 80 px from the top it always shows. */
export function useScrollFold(threshold = 10, top = 80) {
	const [folded, setFolded] = useState(false)
	useEffect(() => {
		let last = window.scrollY
		const onScroll = () => {
			const y = window.scrollY
			const dy = y - last
			if (y < top) setFolded(false)
			else if (dy > threshold) setFolded(true)
			else if (dy < -threshold) setFolded(false)
			if (Math.abs(dy) > threshold || y < top) last = y
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
	}, [threshold, top])
	return folded
}

/** A menu that opens above the slab's strip, anchored right, above the thumb. */
function SlabMenu({
	open,
	label,
	width,
	asDialog = false,
	children,
	id,
}: {
	open: boolean
	label: string
	width: number
	/** A panel with controls rather than a menu of choices. */
	asDialog?: boolean
	children: ReactNode
	id: string
}) {
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					id={id}
					role={asDialog ? "dialog" : "menu"}
					aria-label={label}
					initial={{ opacity: 0, y: 10, scale: 0.97 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 8, scale: 0.97 }}
					transition={SPRING}
					style={{ width }}
					className={`absolute right-3 bottom-full mb-2 max-w-[calc(100vw-1.5rem)] origin-bottom-right shadow-2xl shadow-black ${MENU}`}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/** The For you segment: amber when on, "↑N" by the fingerprint. The fingerprint opens the explanation. */
function SlabForYou({
	forYou,
	onExplain,
	explainOpen,
	explainId,
}: {
	forYou: ForYouControl
	onExplain: () => void
	explainOpen: boolean
	explainId: string
}) {
	const lit = forYou.on && !forYou.disabled
	return (
		<div
			className={`${SLAB_SEGMENT} !flex-[0.85] !p-0 ${lit ? "text-gray-950" : "text-gray-400"}`}
		>
			<AnimatePresence initial={false}>
				{lit && (
					<motion.span
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="absolute inset-0 rounded-[14px] bg-linear-to-b from-amber-400 to-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_22px_-4px_rgba(245,158,11,.7)]"
					/>
				)}
			</AnimatePresence>
			<motion.button
				type="button"
				role="switch"
				aria-checked={lit}
				aria-disabled={forYou.disabled || undefined}
				aria-label="For you"
				data-for-you-switch
				whileTap={forYou.disabled ? undefined : TAP}
				onClick={() => !forYou.disabled && forYou.onChange(!forYou.on)}
				className="absolute inset-0 flex flex-col items-center justify-end gap-0.5 rounded-[14px] pb-[7px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
			>
				<span className="relative">For you</span>
			</motion.button>
			<button
				type="button"
				data-slab-trigger
				aria-label="What For you does"
				aria-expanded={explainOpen}
				aria-controls={explainOpen ? explainId : undefined}
				onClick={onExplain}
				className="absolute top-[3px] left-1/2 z-10 flex h-[18px] -translate-x-1/2 items-center justify-center gap-1 rounded-full px-1.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
			>
				<FingerPrintIcon
					className={`h-4 w-4 ${lit ? "text-gray-950/80" : "text-amber-500/80"}`}
				/>
				{lit && forYou.movedUp > 0 && (
					<span className="flex items-center text-[10px] font-black tabular-nums">
						<ArrowUpIcon className="h-2.5 w-2.5" />
						<span aria-hidden>{compactCount(forYou.movedUp)}</span>
						<span className="sr-only">
							{forYou.movedUp.toLocaleString("en")} moved up
						</span>
					</span>
				)}
			</button>
		</div>
	)
}

function Block({
	title,
	right,
	children,
}: {
	title: string
	right?: ReactNode
	children: ReactNode
}) {
	return (
		<section className="px-4 pt-5">
			<div className="mb-2.5 flex items-baseline justify-between">
				<h3 className="text-[15px] font-bold text-white">{title}</h3>
				{right}
			</div>
			{children}
		</section>
	)
}

/**
 * The slab's frame: an optional line, a filter strip and its menus. It lives in DockStrip, above the shared hub row.
 * Scrolling down folds the line away; the filter strip stays.
 */
export function SlabShell({
	line,
	strip,
	trailing,
	children,
}: {
	line?: ReactNode
	/** The strip's segments; SLAB_SEGMENT styles one. */
	strip: ReactNode
	/** The key after the strip, for example Filters. */
	trailing?: ReactNode
	/** Anchored above the strip, for example its menus. */
	children?: ReactNode
}) {
	const folded = useScrollFold()
	return (
		<DockStrip>
			<motion.div layout transition={SPRING} className="relative min-w-0 flex-1">
				<AnimatePresence initial={false}>
					{!folded && line && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={SPRING}
							className="overflow-hidden"
						>
							{line}
						</motion.div>
					)}
				</AnimatePresence>
				<div className="flex items-center gap-2">
					<div className="flex h-[52px] min-w-0 flex-1 items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10">
						{strip}
					</div>
					{trailing}
				</div>
				{children}
			</motion.div>
		</DockStrip>
	)
}

export interface SlabProps {
	state: FilterState
	counts: FilterBarCounts | null
	onChange: (state: FilterState) => void
	onDrop: (filter: FilterName) => void
	onClear: () => void
	secondaryCount: number
	hasServices: boolean
	providers: StreamingProvider[]
	onAddServices: () => void
	sorts: SortOption[]
	sort: string
	onSort: (sort: string) => void
	sortFootnote?: string
	/** Under the sorts, in the menu and in the sheet. */
	sortFooter?: ReactNode
	forYou?: ForYouControl
	searching: boolean
	groups: FilterGroupsData
	/** Replaces the hidden line, always shown (for example a search's own line). */
	line?: ReactNode
	/** In place of the strip's first three segments (Discover's sign-up key for visitors). */
	signUpKey?: ReactNode
	/** PROTOTYPE: a change opens the sheet tall (the phone's quick filter buttons). */
	openSignal?: number
}

export function Slab(props: SlabProps) {
	const { state, counts, onChange, onDrop, searching, hasServices, providers } =
		props
	const [sheet, setSheet] = useState(-1)
	// PROTOTYPE: the quick filter buttons above the grid open the sheet.
	useEffect(() => {
		if (props.openSignal) setSheet(1)
	}, [props.openSignal])
	const [menu, setMenu] = useState<"sort" | "explain" | null>(null)
	// For you under Best match: flipping it opens the sort menu, or, inside the sheet, leaves the sorts below it to pick.
	const { forYou, pick } = useForYouUnderBestMatch({
		forYou: props.forYou,
		sort: props.sort,
		onSort: props.onSort,
		open: menu === "sort" || sheet >= 0,
		onOpen: () => sheet < 0 && setMenu("sort"),
		onClose: () => setMenu((m) => (m === "sort" ? null : m)),
	})
	const sortMenu = useRef<HTMLDivElement>(null)
	const explainMenu = useRef<HTMLDivElement>(null)
	const sortTrigger = useRef<HTMLButtonElement>(null)
	const sortId = useId()
	const explainId = useId()
	useMenu(
		menu === "sort",
		() => setMenu(null),
		sortMenu,
		sortTrigger,
		`[data-slab-trigger], ${FOR_YOU_SWITCH}`,
	)
	useEffect(() => {
		if (menu !== "explain") return
		const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null)
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (explainMenu.current?.contains(t) || t.closest("[data-slab-trigger]"))
				return
			setMenu(null)
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [menu])

	const top = counts?.recoveries[0]
	const chosenSort = props.sorts.find((s) => s.key === props.sort)
	const sortLabel = chosenSort?.label ?? ""
	const mineOn = state.onMyServices
	const hiddenLine =
		counts && (counts.hidden > 0 || searching) ? (
			<div className="flex items-center gap-2.5 px-4 pt-3 text-xs">
				<HiddenMeter counts={counts} className="w-12 shrink-0" />
				<span className="truncate whitespace-nowrap text-gray-400">
					<RollingNumber
						value={searching ? counts.total : counts.hidden}
						className="font-bold text-white"
					/>{" "}
					{searching ? "matches" : "hidden by filters"}
					{searching &&
						counts.hidden > 0 &&
						`, ${counts.hidden.toLocaleString("en")} hidden`}
				</span>
				{top && (
					<motion.button
						type="button"
						whileTap={TAP}
						onClick={() => onDrop(top.filter)}
						className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap font-bold text-amber-400 cursor-pointer"
					>
						<PlusIcon className="h-3 w-3" />
						<span className="sr-only">Show </span>
						{recoveryLabel(top.filter, top.titles, state, true)}
					</motion.button>
				)}
			</div>
		) : null

	return (
		<>
			<SlabShell
				line={props.line ?? hiddenLine}
				strip={
					<>
						{props.signUpKey ?? (
						<>
						<motion.button
							type="button"
							role="switch"
							aria-checked={mineOn}
							aria-label="On my services"
							whileTap={TAP}
							onClick={() =>
								hasServices
									? onChange({
											...state,
											onMyServices: !mineOn,
											services: undefined,
										})
									: props.onAddServices()
							}
							className={`${SLAB_SEGMENT} ${mineOn ? "text-white" : "text-gray-400"}`}
						>
							{mineOn && (
								<motion.span
									layoutId={`${sortId}-mine`}
									className="absolute inset-0 rounded-[14px] bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
								/>
							)}
							<span className="relative">
								{mineOn ? (
									<ServiceStack providers={providers} on size={16} />
								) : hasServices ? (
									<GlobeAltIcon className="h-4 w-4" />
								) : (
									<PlusIcon className="h-4 w-4" />
								)}
							</span>
							<span className="relative w-full truncate px-0.5 text-center">
								{mineOn
									? "My services"
									: hasServices
										? "Everywhere"
										: "Add services"}
							</span>
						</motion.button>
						<motion.button
							type="button"
							role="switch"
							aria-checked={state.notSeenYet}
							aria-label="Not seen yet"
							whileTap={TAP}
							onClick={() =>
								onChange({ ...state, notSeenYet: !state.notSeenYet })
							}
							className={`${SLAB_SEGMENT} ${state.notSeenYet ? "text-white" : "text-gray-400"}`}
						>
							{state.notSeenYet && (
								<motion.span
									layoutId={`${sortId}-seen`}
									className="absolute inset-0 rounded-[14px] bg-linear-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
								/>
							)}
							<span className="relative">
								{state.notSeenYet ? (
									<EyeSlashIcon className="h-4 w-4" />
								) : (
									<EyeIcon className="h-4 w-4" />
								)}
							</span>
							<span className="relative w-full truncate px-0.5 text-center">
								{state.notSeenYet ? "Not seen" : "Seen too"}
							</span>
						</motion.button>
						{forYou &&
							(forYou.replacement ? (
								<div className={`${SLAB_SEGMENT} !flex-[0.85]`}>
									{forYou.replacement}
								</div>
							) : (
								<SlabForYou
									forYou={forYou}
									explainOpen={menu === "explain"}
									explainId={explainId}
									onExplain={() =>
										setMenu((m) => (m === "explain" ? null : "explain"))
									}
								/>
							))}
						</>
						)}
						<motion.button
							ref={sortTrigger}
							type="button"
							data-slab-trigger
							whileTap={TAP}
							aria-haspopup="menu"
							aria-expanded={menu === "sort"}
							aria-controls={menu === "sort" ? sortId : undefined}
							aria-label={`Sort: ${sortLabel}`}
							onClick={() => setMenu((m) => (m === "sort" ? null : "sort"))}
							className={`${SLAB_SEGMENT} ${menu === "sort" ? "bg-white/10 text-white" : "text-gray-200"}`}
						>
							<ArrowsUpDownIcon
								className={`h-4 w-4 ${chosenSort?.taste ? "text-amber-400" : "text-gray-400"}`}
							/>
							<span className="relative w-full overflow-hidden px-1 text-center">
								<AnimatePresence mode="popLayout" initial={false}>
									<motion.span
										key={props.sort}
										initial={{ y: 12, opacity: 0 }}
										animate={{ y: 0, opacity: 1 }}
										exit={{ y: -12, opacity: 0 }}
										transition={SPRING}
										className="block truncate"
									>
										{sortLabel}
									</motion.span>
								</AnimatePresence>
							</span>
						</motion.button>
					</>
				}
				trailing={
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onClick={() => {
							setMenu(null)
							setSheet(0)
						}}
						aria-haspopup="dialog"
						aria-expanded={sheet >= 0}
						aria-label={
							props.secondaryCount
								? `Filters, ${props.secondaryCount} active`
								: "Filters"
						}
						className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<AdjustmentsHorizontalIcon className="h-5 w-5" />
						{props.secondaryCount > 0 && (
							<span
								aria-hidden
								className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950"
							>
								{props.secondaryCount}
							</span>
						)}
					</motion.button>
				}
			>
				<div ref={sortMenu}>
					<SlabMenu open={menu === "sort"} label="Sort" width={272} id={sortId}>
						<div className="p-1.5">
							<SortItems
								options={props.sorts}
								value={props.sort}
								dense
								footnote={props.sortFootnote}
								footer={props.sortFooter}
								onPick={(key) => {
									pick(key)
									setMenu(null)
									sortTrigger.current?.focus()
								}}
							/>
						</div>
					</SlabMenu>
				</div>
				{forYou && (
					<div ref={explainMenu}>
						<SlabMenu
							open={menu === "explain"}
							label="For you"
							width={320}
							asDialog
							id={explainId}
						>
							<div className="p-4">
								{forYou.explanation}
								<div className="mt-3">
									<ForYouRow forYou={forYou} compact />
								</div>
							</div>
						</SlabMenu>
					</div>
				)}
			</SlabShell>
			<SnapSheet
				index={sheet}
				onIndex={setSheet}
				label="Filters"
				footer={
					<div className="shrink-0 border-t border-white/5 bg-gray-950/90 px-4 pt-3 pb-5">
						<ShowTitlesButton
							counts={counts}
							onClick={() => setSheet(-1)}
							className="w-full"
						/>
					</div>
				}
			>
				<SheetBody {...props} forYou={forYou} onSort={pick} />
			</SnapSheet>
		</>
	)
}

// PROTOTYPE - throwaway: the variants get a shorter sheet; "now" keeps the live one.
function SheetBody(props: SlabProps) {
	const variant = useFilterSheetVariant()
	return variant === "now" ? (
		<LiveSheetBody {...props} />
	) : (
		<ProtoSheetBody {...props} />
	)
}

/**
 * PROTOTYPE - throwaway. The sheet for the variants: what's hidden, the sort as one row of chips with the chosen
 * sort's line under it, Not seen yet, then the filters. Streaming services moved into the filters, so the Show me
 * block's My services / Everywhere is gone.
 */
function ProtoSheetBody(props: SlabProps) {
	const { state, counts, onChange, onDrop, forYou } = props
	const [query, setQuery] = useState("")
	const hides = counts?.optionCounts.notSeenYet
	const seenHidden = hides ? Math.max(0, (hides.off ?? 0) - (hides.on ?? 0)) : 0
	const pickSort = (sort: SortOption) =>
		!sort.disabled && props.onSort(sort.key)
	const current = props.sorts.find((s) => s.key === props.sort)
	return (
		<div className="pb-6">
			<h2 className="sr-only">Filters</h2>
			{counts && counts.hidden > 0 && (
				<Block
					title={`${counts.hidden.toLocaleString("en")} hidden by your filters`}
					right={<HiddenMeter counts={counts} className="w-24" />}
				>
					<div className="-mx-3">
						<RecoveryList counts={counts} state={state} onDrop={onDrop} />
					</div>
				</Block>
			)}
			<Block title="Sort">
				{forYou && !forYou.replacement && (
					<div className="mb-2">
						<ForYouRow forYou={forYou} />
					</div>
				)}
				<div
					className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
					role="radiogroup"
					aria-label="Sort"
					onKeyDown={(event) =>
						radioKeys(event, (index) => pickSort(props.sorts[index]))
					}
				>
					{props.sorts.map((s) => {
						const on = s.key === props.sort
						return (
							<motion.button
								key={s.key}
								// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
								type="button"
								role="radio"
								aria-checked={on}
								aria-disabled={s.disabled || undefined}
								tabIndex={on ? 0 : -1}
								data-sort={s.key}
								whileTap={s.disabled ? undefined : TAP}
								onClick={() => pickSort(s)}
								className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${s.disabled ? "cursor-default text-gray-600 ring-1 ring-white/5" : "cursor-pointer"} ${
									on
										? s.taste
											? "bg-amber-500/[0.18] font-bold text-amber-100 ring-1 ring-amber-500/45"
											: "bg-white font-bold text-gray-950"
										: s.disabled
											? ""
											: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10"
								}`}
							>
								{s.label}
							</motion.button>
						)
					})}
				</div>
				{current && (
					<p className="mt-1.5 text-xs text-gray-500">{current.hint}</p>
				)}
				{props.sortFooter}
				<motion.button
					type="button"
					role="switch"
					aria-checked={state.notSeenYet}
					whileTap={TAP}
					onClick={() => onChange({ ...state, notSeenYet: !state.notSeenYet })}
					className={`mt-3 flex h-12 w-full items-center gap-3 rounded-2xl px-3.5 ring-1 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${state.notSeenYet ? "bg-blue-900/40 ring-blue-400/30" : "bg-white/[0.05] ring-white/10"}`}
				>
					{state.notSeenYet ? (
						<EyeSlashIcon className="h-5 w-5 text-blue-400" />
					) : (
						<EyeIcon className="h-5 w-5 text-gray-400" />
					)}
					<span className="flex-1 text-left">
						<span className="block text-sm font-bold text-white">
							Not seen yet
						</span>
						<span className="block text-[11px] text-gray-400">
							{state.notSeenYet
								? `Hiding ${seenHidden.toLocaleString("en")} you watched, rated, or skipped`
								: "Showing titles you've seen too"}
						</span>
					</span>
					<Knob
						on={state.notSeenYet}
						onClass="bg-blue-600 shadow-[0_0_16px_rgba(37,99,235,.55)]"
					/>
				</motion.button>
			</Block>
			<Block
				title="Filters"
				right={
					props.secondaryCount > 0 && (
						<button
							type="button"
							onClick={props.onClear}
							className="text-xs text-gray-400 cursor-pointer"
						>
							Clear {props.secondaryCount}
						</button>
					)
				}
			>
				<FilterSearchField value={query} onChange={setQuery} />
				<FilterGroups data={props.groups} query={query} className="mt-5" />
			</Block>
		</div>
	)
}

/** The sheet, top to bottom in reach order: what's hidden, the sort, every other filter, then the two first controls. */
function LiveSheetBody(props: SlabProps) {
	const { state, counts, onChange, onDrop, forYou } = props
	const [query, setQuery] = useState("")
	const hides = counts?.optionCounts.notSeenYet
	const seenHidden = hides ? Math.max(0, (hides.off ?? 0) - (hides.on ?? 0)) : 0
	const mineMore = counts?.optionCounts.services
	const moreEverywhere =
		mineMore && state.onMyServices
			? Math.max(0, (mineMore.all ?? 0) - (mineMore.mine ?? 0))
			: 0
	const pickSort = (sort: SortOption) =>
		!sort.disabled && props.onSort(sort.key)
	const pick = (mine: boolean) =>
		mine && !props.hasServices
			? props.onAddServices()
			: onChange({ ...state, onMyServices: mine, services: undefined })
	return (
		<div className="pb-6">
			<h2 className="sr-only">Filters</h2>
			{counts && counts.hidden > 0 && (
				<Block
					title={`${counts.hidden.toLocaleString("en")} hidden by your filters`}
					right={<HiddenMeter counts={counts} className="w-24" />}
				>
					<div className="-mx-3">
						<RecoveryList counts={counts} state={state} onDrop={onDrop} />
					</div>
				</Block>
			)}
			<Block title="Sort">
				{forYou && !forYou.replacement && (
					<div className="mb-2">
						<ForYouRow forYou={forYou} />
					</div>
				)}
				<div
					className="grid grid-cols-2 gap-2"
					role="radiogroup"
					aria-label="Sort"
					onKeyDown={(event) =>
						radioKeys(event, (index) => pickSort(props.sorts[index]))
					}
				>
					{props.sorts.map((s) => {
						const on = s.key === props.sort
						return (
							<motion.button
								key={s.key}
								// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
								type="button"
								role="radio"
								aria-checked={on}
								aria-disabled={s.disabled || undefined}
								tabIndex={on ? 0 : -1}
								data-sort={s.key}
								whileTap={s.disabled ? undefined : TAP}
								onClick={() => pickSort(s)}
								className={`relative min-h-16 rounded-2xl bg-white/[0.03] px-3.5 py-2.5 text-left ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${s.disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
							>
								{on && (
									<motion.span
										layoutId="filter-sheet-sort"
										transition={SPRING}
										// Amber marks what taste decides: Best match.
										className={`absolute inset-0 rounded-2xl ring-1 ${s.taste ? "bg-amber-500/[0.14] ring-amber-500/45" : "bg-white/[0.08] ring-white/30"}`}
									/>
								)}
								<span
									className={`relative block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}
								>
									{s.label}
								</span>
								<span
									className={`relative block text-[11px] text-gray-500 ${s.disabled ? "leading-snug" : "truncate"}`}
								>
									{s.hint}
								</span>
							</motion.button>
						)
					})}
				</div>
				{props.sortFooter}
			</Block>
			<Block
				title="More filters"
				right={
					props.secondaryCount > 0 && (
						<button
							type="button"
							onClick={props.onClear}
							className="text-xs text-gray-400 cursor-pointer"
						>
							Clear {props.secondaryCount}
						</button>
					)
				}
			>
				<FilterSearchField value={query} onChange={setQuery} />
				<FilterGroups data={props.groups} query={query} className="mt-5" />
			</Block>
			<Block title="Show me">
				<div className="flex flex-col gap-2.5">
					<div
						role="radiogroup"
						aria-label="Where to watch"
						onKeyDown={(event) =>
							radioKeys(event, (index) => pick(index === 0))
						}
						className="relative grid h-16 grid-cols-2 rounded-2xl bg-white/[0.05] p-1 ring-1 ring-white/10"
					>
						{[true, false].map((mine) => {
							const on = state.onMyServices === mine
							return (
								<motion.button
									key={String(mine)}
									// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
									type="button"
									role="radio"
									aria-checked={on}
									tabIndex={on ? 0 : -1}
									whileTap={TAP}
									onClick={() => pick(mine)}
									className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									{on && (
										<motion.span
											layoutId="filter-sheet-services"
											transition={SPRING}
											className={`absolute inset-0 rounded-xl ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "bg-white/10 ring-1 ring-white/15"}`}
										/>
									)}
									<span
										className={`relative flex items-center gap-2 text-sm font-bold ${on ? "text-white" : "text-gray-400"}`}
									>
										{mine ? (
											props.hasServices ? (
												<ServiceStack
													providers={props.providers}
													on={on}
													size={18}
												/>
											) : (
												<PlusIcon className="h-4 w-4" />
											)
										) : (
											<GlobeAltIcon className="h-4 w-4" />
										)}
										{mine
											? props.hasServices
												? "My services"
												: "Add my services"
											: "Everywhere"}
									</span>
									<span
										className={`relative mt-0.5 text-[11px] ${on ? "text-white/70" : "text-gray-500"}`}
									>
										{mine
											? "Your saved services"
											: moreEverywhere
												? `+${moreEverywhere.toLocaleString("en")} more titles`
												: "Every service"}
									</span>
								</motion.button>
							)
						})}
					</div>
					<motion.button
						type="button"
						role="switch"
						aria-checked={state.notSeenYet}
						whileTap={TAP}
						onClick={() =>
							onChange({ ...state, notSeenYet: !state.notSeenYet })
						}
						className={`flex h-14 items-center gap-3 rounded-2xl px-4 ring-1 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${state.notSeenYet ? "bg-blue-900/40 ring-blue-400/30" : "bg-white/[0.05] ring-white/10"}`}
					>
						{state.notSeenYet ? (
							<EyeSlashIcon className="h-5 w-5 text-blue-400" />
						) : (
							<EyeIcon className="h-5 w-5 text-gray-400" />
						)}
						<span className="flex-1 text-left">
							<span className="block text-sm font-bold text-white">
								Not seen yet
							</span>
							<span className="block text-[11px] text-gray-400">
								{state.notSeenYet
									? `Hiding ${seenHidden.toLocaleString("en")} you watched, rated, or skipped`
									: "Showing titles you've seen too"}
							</span>
						</span>
						<Knob
							on={state.notSeenYet}
							size="lg"
							onClass="bg-blue-600 shadow-[0_0_16px_rgba(37,99,235,.55)]"
						/>
					</motion.button>
				</div>
			</Block>
		</div>
	)
}
