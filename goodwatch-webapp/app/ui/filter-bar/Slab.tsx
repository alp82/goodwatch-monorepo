// The phone slab: one fixed panel at the bottom that merges the filter strip with the site navigation. Top to
// bottom: the hidden line, the strip (On my services, Not seen yet, For you on Discover, Sort) with the 52 px Filters
// key, and the navigation dock. Scrolling down folds the hidden line and the dock away; the strip stays.
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
import { Link, useLocation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import {
	BOTTOM_NAV_ITEMS,
	SLAB_NAV_ATTRIBUTE,
	isBottomNavActive,
} from "~/ui/nav/BottomNav"
import { ServiceStack, SortItems, radioKeys, useMenu } from "./controls"
import {
	FilterGroups,
	type FilterGroupsData,
	FilterSearchField,
} from "./FilterGroups"
import { ShowTitlesButton } from "./FiltersSheet"
import { ForYouRow } from "./ForYou"
import { type SortOption, recoveryLabel } from "./labels"
import { Knob, MENU, RollingNumber, SPRING, TAP } from "./motion"
import { SnapSheet } from "./SnapSheet"
import { HiddenMeter, RecoveryList } from "./SubBar"
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

/** The site navigation as the slab's dock row, with Taste as the round key in the middle. */
export function SlabNav() {
	const { pathname } = useLocation()
	const [home, discover, movies, shows] = BOTTOM_NAV_ITEMS
	const tasteActive = pathname.startsWith("/taste")
	const item = ({ title, Icon, url }: (typeof BOTTOM_NAV_ITEMS)[number]) => {
		const active = isBottomNavActive(pathname, url)
		return (
			<Link
				key={url}
				to={url}
				prefetch="render"
				aria-current={active ? "page" : undefined}
				className="flex flex-col items-center justify-center pt-2 pb-3"
			>
				<Icon
					className={`mb-1 h-5 w-5 ${active ? "text-amber-500" : "text-gray-400"}`}
				/>
				<span className="text-xs text-gray-200">{title}</span>
			</Link>
		)
	}
	return (
		<nav aria-label="Main" className="grid h-16 grid-cols-5">
			{item(home)}
			{item(discover)}
			<Link
				to="/taste"
				prefetch="render"
				aria-label="Taste"
				aria-current={tasteActive ? "page" : undefined}
				className="flex items-center justify-center"
			>
				<span
					className={`grid h-11 w-11 place-items-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40 ${tasteActive ? "ring-4 ring-amber-600/30" : ""}`}
				>
					<FingerPrintIcon className="h-6 w-6 text-white" />
				</span>
			</Link>
			{item(movies)}
			{item(shows)}
		</nav>
	)
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
						{forYou.movedUp}
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
 * The slab's frame, for any surface: a fixed panel at the bottom with an optional line on top, the strip of segments
 * with a trailing key, anything anchored above the strip (menus), and the dock row. Scrolling down folds the line and
 * the dock away; the strip stays. While it's mounted, the site's own bottom navigation steps aside.
 */
export function SlabShell({
	line,
	strip,
	trailing,
	nav,
	children,
}: {
	line?: ReactNode
	/** The strip's segments; SLAB_SEGMENT styles one. */
	strip: ReactNode
	/** The key after the strip, for example Filters. */
	trailing?: ReactNode
	/** The dock row; the site navigation by default. */
	nav?: ReactNode
	/** Anchored above the strip, for example its menus. */
	children?: ReactNode
}) {
	const folded = useScrollFold()
	useEffect(() => {
		document.documentElement.setAttribute(SLAB_NAV_ATTRIBUTE, "")
		return () => document.documentElement.removeAttribute(SLAB_NAV_ATTRIBUTE)
	}, [])
	return (
		<div className="fixed inset-x-0 bottom-0 z-[60] lg:hidden">
			<motion.div
				layout
				transition={SPRING}
				className="relative rounded-t-[26px] bg-gray-950/90 ring-1 ring-white/10 backdrop-blur-2xl shadow-[0_-20px_50px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]"
			>
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
				<div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5">
					<div className="flex h-[52px] min-w-0 flex-1 items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10">
						{strip}
					</div>
					{trailing}
				</div>
				{children}
				<AnimatePresence initial={false}>
					{!folded && (
						<motion.div
							initial={{ height: 0 }}
							animate={{ height: "auto" }}
							exit={{ height: 0 }}
							transition={SPRING}
							className="overflow-hidden border-t border-white/5"
						>
							{nav ?? <SlabNav />}
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
		</div>
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
	forYou?: ForYouControl
	searching: boolean
	groups: FilterGroupsData
	/** Replaces the hidden line, always shown (for example a search's own line). */
	line?: ReactNode
	/** Replaces the dock row; the site navigation by default. */
	nav?: ReactNode
}

export function Slab(props: SlabProps) {
	const {
		state,
		counts,
		onChange,
		onDrop,
		forYou,
		searching,
		hasServices,
		providers,
	} = props
	const [sheet, setSheet] = useState(-1)
	const [menu, setMenu] = useState<"sort" | "explain" | null>(null)
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
		"[data-slab-trigger]",
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
	const sortLabel = props.sorts.find((s) => s.key === props.sort)?.label ?? ""
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
							<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
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
				nav={props.nav}
			>
				<div ref={sortMenu}>
					<SlabMenu open={menu === "sort"} label="Sort" width={272} id={sortId}>
						<div className="p-1.5">
							<SortItems
								options={props.sorts}
								value={props.sort}
								dense
								footnote={props.sortFootnote}
								onPick={(key) => {
									props.onSort(key)
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
				<SheetBody {...props} />
			</SnapSheet>
		</>
	)
}

/** The sheet, top to bottom in reach order: what's hidden, the sort, every other filter, then the two first controls. */
function SheetBody(props: SlabProps) {
	const { state, counts, onChange, onDrop, forYou } = props
	const [query, setQuery] = useState("")
	const hides = counts?.optionCounts.notSeenYet
	const seenHidden = hides ? Math.max(0, (hides.off ?? 0) - (hides.on ?? 0)) : 0
	const mineMore = counts?.optionCounts.services
	const moreEverywhere =
		mineMore && state.onMyServices
			? Math.max(0, (mineMore.all ?? 0) - (mineMore.mine ?? 0))
			: 0
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
				<div
					className="grid grid-cols-2 gap-2"
					role="radiogroup"
					aria-label="Sort"
					onKeyDown={(event) =>
						radioKeys(event, (index) => props.onSort(props.sorts[index].key))
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
								tabIndex={on ? 0 : -1}
								whileTap={TAP}
								onClick={() => props.onSort(s.key)}
								className="relative h-16 rounded-2xl bg-white/[0.03] px-3.5 text-left ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{on && (
									<motion.span
										layoutId="filter-sheet-sort"
										transition={SPRING}
										className="absolute inset-0 rounded-2xl bg-white/[0.08] ring-1 ring-white/30"
									/>
								)}
								<span
									className={`relative block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}
								>
									{s.label}
								</span>
								<span className="relative block truncate text-[11px] text-gray-500">
									{s.hint}
								</span>
							</motion.button>
						)
					})}
				</div>
				{forYou && !forYou.replacement && (
					<div className="mt-2">
						<ForYouRow forYou={forYou} />
					</div>
				)}
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
