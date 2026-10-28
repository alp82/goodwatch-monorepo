// PROTOTYPE - throwaway. Variant U, "Bar, tiers": M's expanding bar with no tabs, the filters tiered by size. Closed: a
// static title, one bar (a wide mood search field you type into, then Mood, Streaming, Not seen yet, Sort, Filters)
// and one status line (count, the mood search as a removable value with its Read as, every active filter, Clear all).
// Mood or Filters expands the bar into one wide panel over the dimmed grid: the left two thirds are the common filters
// as big blocks (M's mood filter across the top), the right third the niche ones as a compact index whose rows open
// in place, one at a time. Sticky footer: Clear all and Show N. Phones: the search field leads the page, the slab
// sits at the bottom, and its sheet has the common blocks first and the niche index after.
import {
	AdjustmentsHorizontalIcon,
	ArrowsUpDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import {
	SLAB_CLEARANCE,
	SLAB_SEGMENT,
	ShowTitlesButton,
	SnapSheet,
	discoverSorts,
} from "~/ui/filter-bar"
import {
	FiltersButton,
	NotSeenSwitch,
	ServiceStack,
	ServicesControl,
	SortControl,
} from "~/ui/filter-bar/controls"
import { sortShown } from "~/ui/filter-bar/labels"
import { MENU, RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SlabShell } from "~/ui/filter-bar/Slab"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CommonBlocks,
	HueDots,
	NicheIndex,
	type Open,
	PRIVATE,
	type Pieces,
	StaticTitle,
	StatusLine,
	moodLabel,
} from "./Q-tiers"

export const NAME = "Bar, tiers"

type Focus = "mood" | "more"
const TASTE = "signUp" as const

function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, TASTE),
		value: sortShown(d.filters.sort, searching, TASTE),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The mood search field: you type into it; Enter makes it a filter value, × removes it.

function MoodSearchField({
	d,
	className = "",
	inputRef,
}: {
	d: ProtoDiscover
	className?: string
	inputRef?: React.RefObject<HTMLInputElement>
}) {
	const [draft, setDraft] = useState(d.q ?? "")
	const [focused, setFocused] = useState(false)
	useEffect(() => {
		if (!focused) setDraft(d.q ?? "")
	}, [d.q, focused])
	const set = d.q !== null
	const dirty = draft.trim() !== (d.q ?? "")
	return (
		<div
			className={`group relative flex h-12 min-w-0 items-center gap-3 rounded-2xl pr-1.5 pl-4 ring-1 transition-colors ${PRIVATE} ${
				focused
					? "bg-white/[0.08] ring-amber-400/70"
					: set
						? "bg-amber-400/[0.08] ring-amber-400/45"
						: "bg-white/[0.06] ring-white/15 hover:ring-white/30"
			} ${className}`}
		>
			<MagnifyingGlassIcon
				className={`h-5 w-5 shrink-0 ${set || focused ? "text-amber-400" : "text-gray-400"}`}
				aria-hidden
			/>
			<input
				ref={inputRef}
				type="search"
				value={draft}
				maxLength={SEARCH_MAX_CHARS}
				autoComplete="off"
				enterKeyHint="search"
				data-ph-no-capture
				aria-label="Mood search"
				placeholder="What’s the mood?"
				onChange={(e) => setDraft(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault()
						d.setQ(draft.trim() || null)
						e.currentTarget.blur()
					}
					if (e.key === "Escape") {
						setDraft(d.q ?? "")
						e.currentTarget.blur()
					}
				}}
				className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[19px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{focused && dirty && draft.trim() ? (
				<kbd className="hidden shrink-0 rounded-md bg-white/10 px-2 py-1 font-sans text-xs font-semibold text-gray-300 sm:block">
					Enter
				</kbd>
			) : set ? (
				<button
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => {
						setDraft("")
						d.setQ(null)
					}}
					aria-label="Remove the mood search"
					className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-amber-300/80 cursor-pointer outline-none hover:bg-amber-400/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			) : null}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The panel's footer, shared by desktop and phones.

function Footer({
	d,
	pieces,
	onDone,
}: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const n = pieces.secondaryCount
	return (
		<div className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5 py-3">
			<button
				type="button"
				onClick={d.filters.clearSecondary}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			<span className="hidden items-center gap-2.5 text-sm text-gray-400 lg:flex">
				<HiddenMeter counts={d.counts} className="w-24" />
				{d.counts && d.counts.hidden > 0 && (
					<span>
						<RollingNumber
							value={d.counts.hidden}
							className="font-semibold text-gray-200"
						/>{" "}
						hidden
					</span>
				)}
			</span>
			<ShowTitlesButton
				counts={d.counts}
				onClick={onDone}
				className="ml-auto min-w-48"
			/>
		</div>
	)
}

/** Scrolls the panel's own scroller to where the key that opened it points. */
function useFocusOn(focus: Focus | null, open: boolean) {
	useEffect(() => {
		if (!open || !focus) return
		const id = setTimeout(() => {
			for (const el of document.querySelectorAll<HTMLElement>(`#u-${focus}`)) {
				const scroller = el.closest<HTMLElement>(".overflow-y-auto")
				if (!scroller || !el.offsetParent) continue
				const top =
					el.getBoundingClientRect().top -
					scroller.getBoundingClientRect().top +
					scroller.scrollTop -
					8
				scroller.scrollTo({ top, behavior: "smooth" })
			}
		}, 260)
		return () => clearTimeout(id)
	}, [focus, open])
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop.

function MoodSegment({
	d,
	open,
	onClick,
}: { d: ProtoDiscover; open: boolean; onClick: () => void }) {
	const label = moodLabel(d)
	return (
		<motion.button
			type="button"
			data-u-trigger
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={open}
			className={`flex h-12 max-w-[15rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${
				open
					? "bg-white/[0.09] text-white ring-white/25"
					: label
						? "text-white hover:ring-white/25"
						: "text-gray-200 hover:ring-white/25"
			}`}
		>
			<HueDots tags={d.picked.filter((t) => t.group === "moods")} size={14} />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

function DesktopPanel({
	d,
	pieces,
	focus,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; focus: Focus; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const [card, setCard] = useState<Open>(null)
	useFocusOn(focus, true)
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (
				ref.current?.contains(t) ||
				t.closest("[data-u-trigger], [data-u-row]")
			)
				return
			if (t.closest("[role=dialog], [role=menu], [role=listbox]")) return
			onClose()
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [onClose])
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Mood and filters"
			initial={{ opacity: 0, scaleY: 0.96, y: -6 }}
			animate={{ opacity: 1, scaleY: 1, y: 0 }}
			exit={{ opacity: 0, scaleY: 0.97, y: -4 }}
			transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
			style={{ transformOrigin: "top center" }}
			className={`absolute inset-x-0 top-[calc(3rem+10px)] z-40 flex h-[min(760px,calc(100vh-200px))] flex-col overflow-hidden ${MENU}`}
		>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<div className="min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-6">
					<CommonBlocks
						d={d}
						pieces={pieces}
						open={card}
						setOpen={setCard}
						moodId="u-mood"
						className="grid-cols-2 2xl:grid-cols-3"
					/>
				</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain border-l border-white/[0.06] bg-black/15 px-5 pt-5 pb-6">
					<NicheIndex
						d={d}
						pieces={pieces}
						open={card}
						setOpen={setCard}
						id="u-more"
					/>
				</div>
			</div>
			<Footer d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function DesktopBar({
	d,
	pieces,
	open,
	setOpen,
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: Focus | null
	setOpen: React.Dispatch<React.SetStateAction<Focus | null>>
}) {
	const navigate = useNavigate()
	const [sortOpen, setSortOpen] = useState(false)
	const sort = useSort(d)
	const input = useRef<HTMLInputElement>(null)
	const close = useCallback(() => setOpen(null), [setOpen])
	const toggle = (f: Focus) => setOpen((o) => (o === f ? null : f))
	return (
		<div className="relative mt-4 hidden lg:block">
			<div data-u-row className="flex items-center gap-2.5">
				<MoodSearchField
					d={d}
					inputRef={input}
					className="min-w-[320px] flex-1"
				/>
				<MoodSegment
					d={d}
					open={open === "mood"}
					onClick={() => toggle("mood")}
				/>
				{/* Sized to their labels, so the mood search keeps the room. */}
				<div className="shrink-0 [&_[role=radio]]:w-auto">
					<ServicesControl
						{...pieces.servicesProps}
						labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
						onAddServices={() => navigate(SERVICES_PATH)}
					/>
				</div>
				<div className="shrink-0 [&>button]:w-auto">
					<NotSeenSwitch {...pieces.notSeenProps} compact />
				</div>
				<SortControl
					{...sort}
					open={sortOpen}
					onOpenChange={setSortOpen}
					align="right"
				/>
				<span data-u-trigger>
					<FiltersButton
						count={pieces.secondaryCount}
						expanded={open !== null}
						onClick={() => toggle("more")}
						compact
					/>
				</span>
			</div>
			<StatusLine
				d={d}
				pieces={pieces}
				onEditQuery={() => input.current?.focus()}
				className="mt-3"
			/>
			<AnimatePresence>
				{open && (
					<DesktopPanel
						key="panel"
						d={d}
						pieces={pieces}
						focus={open}
						onClose={close}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: the search field and status line at the top, the slab at the bottom, its sheet with both tiers.

function PhoneSlab({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const [sheet, setSheet] = useState(-1)
	const [focus, setFocus] = useState<Focus>("mood")
	const [card, setCard] = useState<Open>(null)
	useFocusOn(focus, sheet >= 0)
	const openAt = (f: Focus) => {
		setFocus(f)
		setCard(null)
		setSheet(0)
	}
	const { state } = d.filters
	const mine = state.onMyServices
	const sort = useSort(d)
	const sortLabel = sort.options.find((s) => s.key === sort.value)?.label ?? ""
	const label = moodLabel(d)
	const total = d.counts?.total
	const line = (
		<div className="flex h-9 items-center gap-2.5 px-3 pt-2 text-xs">
			<HiddenMeter counts={d.counts} className="w-10 shrink-0" />
			<span className="shrink-0 whitespace-nowrap text-gray-400">
				{total != null ? (
					<RollingNumber value={total} className="font-bold text-white" />
				) : (
					"…"
				)}{" "}
				{d.filters.searching ? "matches" : "showing"}
			</span>
		</div>
	)
	return (
		<div className="lg:hidden">
			<MoodSearchField d={d} className="mt-3" />
			<StatusLine d={d} pieces={pieces} className="mt-1.5" />
			<SlabShell
				line={line}
				strip={
					<>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => openAt("mood")}
							aria-label={label ? `Mood: ${label}` : "Mood"}
							className={`${SLAB_SEGMENT} ${label ? "bg-white/10 text-white" : "text-gray-200"}`}
						>
							<span className="flex h-4 items-center">
								<HueDots
									tags={d.picked.filter((t) => t.group === "moods")}
									size={12}
								/>
							</span>
							<span className="w-full truncate px-1 text-center">
								{label ?? "Mood"}
							</span>
						</motion.button>
						<motion.button
							type="button"
							role="switch"
							aria-checked={mine}
							aria-label="On my services"
							whileTap={TAP}
							onClick={() =>
								pieces.hasServices
									? pieces.servicesProps.onChange(!mine)
									: navigate(SERVICES_PATH)
							}
							className={`${SLAB_SEGMENT} ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 text-white" : "text-gray-400"}`}
						>
							{mine ? (
								<ServiceStack
									providers={pieces.services.providers}
									on
									size={16}
								/>
							) : pieces.hasServices ? (
								<GlobeAltIcon className="h-4 w-4" />
							) : (
								<PlusIcon className="h-4 w-4" />
							)}
							<span className="w-full truncate px-0.5 text-center">
								{mine
									? "My services"
									: pieces.hasServices
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
							onClick={() => pieces.notSeenProps.onChange(!state.notSeenYet)}
							className={`${SLAB_SEGMENT} ${state.notSeenYet ? "bg-linear-to-b from-blue-600 to-blue-800 text-white" : "text-gray-400"}`}
						>
							{state.notSeenYet ? (
								<EyeSlashIcon className="h-4 w-4" />
							) : (
								<EyeIcon className="h-4 w-4" />
							)}
							<span className="w-full truncate px-0.5 text-center">
								{state.notSeenYet ? "Not seen" : "Seen too"}
							</span>
						</motion.button>
						<div className={`${SLAB_SEGMENT} relative text-gray-200`}>
							<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
							<span className="w-full truncate px-1 text-center">
								{sortLabel}
							</span>
							<select
								aria-label="Sort"
								value={sort.value}
								onChange={(e) => sort.onChange(e.target.value)}
								className="absolute inset-0 cursor-pointer opacity-0"
							>
								{sort.options.map((s) => (
									<option key={s.key} value={s.key} disabled={s.disabled}>
										{s.label}
									</option>
								))}
							</select>
						</div>
					</>
				}
				trailing={
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onClick={() => openAt("more")}
						aria-haspopup="dialog"
						aria-expanded={sheet >= 0}
						aria-label={
							pieces.secondaryCount
								? `Filters, ${pieces.secondaryCount} active`
								: "Filters"
						}
						className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<AdjustmentsHorizontalIcon className="h-5 w-5" />
						{pieces.secondaryCount > 0 && (
							<span
								aria-hidden
								className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950"
							>
								{pieces.secondaryCount}
							</span>
						)}
					</motion.button>
				}
			/>
			<SnapSheet
				index={sheet}
				onIndex={setSheet}
				snaps={[0.94]}
				label="Mood and filters"
				footer={<Footer d={d} pieces={pieces} onDone={() => setSheet(-1)} />}
			>
				<div className="flex flex-col gap-7 px-4 pt-2 pb-6">
					<CommonBlocks
						d={d}
						pieces={pieces}
						open={card}
						setOpen={setCard}
						moodId="u-mood"
						className="grid-cols-1"
					/>
					<NicheIndex
						d={d}
						pieces={pieces}
						open={card}
						setOpen={setCard}
						id="u-more"
					/>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantU({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [open, setOpen] = useState<Focus | null>(null)
	return (
		<MotionConfig reducedMotion="user">
			<div
				className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}
			>
				<StaticTitle />
				<DesktopBar d={d} pieces={pieces} open={open} setOpen={setOpen} />
				<PhoneSlab d={d} pieces={pieces} />
				<div className="relative mt-2 lg:mt-3">
					<ProtoGrid d={d} />
					<AnimatePresence>
						{open && (
							<motion.button
								type="button"
								aria-label="Close the filters"
								tabIndex={-1}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.18 }}
								onClick={() => setOpen(null)}
								className="absolute inset-0 z-30 hidden cursor-default bg-gray-950/45 lg:block"
							/>
						)}
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	)
}
