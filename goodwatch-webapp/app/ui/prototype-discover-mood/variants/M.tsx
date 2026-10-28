// PROTOTYPE - throwaway. Variant M, "Expanding bar": today's bar row is the closed state, with a Mood segment at its
// start. Mood or Filters expands the bar in place into one wide panel under the row, over a lightly dimmed grid (no
// push): left "Vibe" (moods, About, Style with counts), right the essentials and the real card stack, each column with
// its own scroll, and a sticky footer with Clear all and "Show N titles". Closed, the count line shows the active
// chips. Phones: the same panel, full width, rises from the slab (Mood, services, Not seen, Sort, Filters).
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, PlusIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import {
	FilterGroups,
	FilterSearchField,
	SLAB_CLEARANCE,
	SLAB_SEGMENT,
	ShowTitlesButton,
	SnapSheet,
	discoverSorts,
} from "~/ui/filter-bar"
import { sortShown } from "~/ui/filter-bar/labels"
import { FilterInsight, OneLineChips } from "~/ui/filter-bar/ActiveFilters"
import { FiltersButton, NotSeenSwitch, ServiceStack, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { MENU, RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { PopularInline } from "~/ui/filter-bar/PopularFilters"
import { SlabShell } from "~/ui/filter-bar/Slab"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import { FoldedGroup, HueDots, MoodSection, pickedLabel } from "./M-vibe"

export const NAME = "Expanding bar"

type Pieces = ReturnType<typeof useFilterPieces>
type Focus = "vibe" | "essentials" | "filters"
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
// The panel's parts, shared by desktop (two columns) and phones (one).

function ColumnTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
	return (
		<div className="mb-4 flex items-center gap-2">
			<h2 className="text-[13px] font-bold tracking-wide text-gray-400 uppercase">{children}</h2>
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

function Vibe({ d }: { d: ProtoDiscover }) {
	return (
		<div id="m-vibe" className="flex flex-col gap-6">
			<MoodSection d={d} />
			<FoldedGroup d={d} group="themes" few={5} />
			<FoldedGroup d={d} group="styles" few={5} />
		</div>
	)
}

function SortChips({ d }: { d: ProtoDiscover }) {
	const sort = useSort(d)
	return (
		<div role="radiogroup" aria-label="Sort" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
			{sort.options.map((s) => {
				const on = s.key === sort.value
				return (
					<motion.button
						key={s.key}
						// biome-ignore lint/a11y/useSemanticElements: chips as a radio group
						type="button"
						role="radio"
						aria-checked={on}
						aria-disabled={s.disabled || undefined}
						whileTap={s.disabled ? undefined : TAP}
						onClick={() => !s.disabled && sort.onChange(s.key)}
						className={`flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							s.disabled
								? "cursor-default text-gray-600 ring-1 ring-white/5"
								: on
									? "bg-white font-semibold text-gray-950 cursor-pointer"
									: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] cursor-pointer"
						}`}
					>
						{s.label}
					</motion.button>
				)
			})}
		</div>
	)
}

function Essentials({ d, pieces, withSort }: { d: ProtoDiscover; pieces: Pieces; withSort: boolean }) {
	const navigate = useNavigate()
	return (
		<section id="m-essentials" aria-label="Essentials" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2.5">
				<ServicesControl {...pieces.servicesProps} size="sm" onAddServices={() => navigate(SERVICES_PATH)} />
				<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
			</div>
			{withSort && <SortChips d={d} />}
		</section>
	)
}

function DeepFilters({ pieces }: { pieces: Pieces }) {
	const [query, setQuery] = useState("")
	return (
		<section id="m-filters" aria-label="Filters">
			<FilterSearchField value={query} onChange={setQuery} />
			<FilterGroups data={pieces.groups} query={query} className="mt-4" />
		</section>
	)
}

function Footer({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
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
						<RollingNumber value={d.counts.hidden} className="font-semibold text-gray-200" /> hidden
					</span>
				)}
			</span>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto min-w-48" />
		</div>
	)
}

/** Scrolls the panel (its own scroller, never the page) to where the key that opened it points. */
function useFocusOn(focus: Focus | null, open: boolean) {
	useEffect(() => {
		if (!open || !focus) return
		const id = setTimeout(() => {
			for (const el of document.querySelectorAll<HTMLElement>(`#m-${focus}`)) {
				const scroller = el.closest<HTMLElement>(".overflow-y-auto")
				if (!scroller || !el.offsetParent) continue
				const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8
				scroller.scrollTo({ top, behavior: "smooth" })
			}
		}, 260)
		return () => clearTimeout(id)
	}, [focus, open])
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop.

function MoodSegment({ d, open, onClick }: { d: ProtoDiscover; open: boolean; onClick: () => void }) {
	const label = pickedLabel(d.picked)
	return (
		<motion.button
			type="button"
			data-m-trigger
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={open}
			className={`flex h-12 max-w-[18rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${
				open ? "bg-white/[0.09] text-white ring-white/25" : label ? "text-white hover:ring-white/25" : "text-gray-200 hover:ring-white/25"
			}`}
		>
			<HueDots tags={d.picked} size={14} idle />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

function DesktopPanel({
	d,
	pieces,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (ref.current?.contains(t) || t.closest("[data-m-trigger], [data-m-row]")) return
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
			className={`absolute inset-x-0 top-[calc(3rem+10px)] z-40 flex h-[min(720px,calc(100vh-230px))] flex-col overflow-hidden ${MENU}`}
		>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
				<div className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 pt-5 pb-6">
					<ColumnTitle>Vibe</ColumnTitle>
					<Vibe d={d} />
				</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-6">
					<ColumnTitle>Filters</ColumnTitle>
					<Essentials d={d} pieces={pieces} withSort={false} />
					<div className="mt-5">
						<DeepFilters pieces={pieces} />
					</div>
				</div>
			</div>
			<Footer d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function DesktopBar({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const [open, setOpen] = useState<Focus | null>(null)
	const [sortOpen, setSortOpen] = useState(false)
	const sort = useSort(d)
	const close = useCallback(() => setOpen(null), [])
	const toggle = (f: Focus) => setOpen((o) => (o ? null : f))
	const chips = pieces.chips.filter((c) => c.key !== "services")
	return (
		<>
			<div className="relative mt-4 hidden lg:block">
				<div data-m-row className="flex flex-wrap items-center gap-2.5">
					<MoodSegment d={d} open={open !== null} onClick={() => toggle("vibe")} />
					<ServicesControl {...pieces.servicesProps} onAddServices={() => navigate(SERVICES_PATH)} />
					<NotSeenSwitch {...pieces.notSeenProps} compact />
					<SortControl {...sort} open={sortOpen} onOpenChange={setSortOpen} />
					<div className="ml-auto">
						<FiltersButton
							count={pieces.secondaryCount}
							expanded={open !== null}
							onClick={() => toggle("filters")}
							compact
						/>
					</div>
				</div>
				<FilterInsight
					counts={d.counts}
					chips={[]}
					state={d.filters.state}
					onChange={pieces.onChange}
					onDrop={d.filters.drop}
					onClear={d.filters.clearSecondary}
					searching={d.filters.searching}
					idle={
						chips.length ? (
							<div className="flex min-w-0 flex-1 items-center gap-3">
								<OneLineChips
									chips={chips}
									state={d.filters.state}
									onChange={pieces.onChange}
									onGoTo={() => setOpen("filters")}
									className="min-w-0 flex-1"
								/>
								<button
									type="button"
									onClick={d.filters.clearSecondary}
									className="shrink-0 rounded-md text-sm text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									Clear all
								</button>
							</div>
						) : (
							<PopularInline data={pieces.groups} />
						)
					}
					className="mt-5 min-h-8"
				/>
				<AnimatePresence>{open && <DesktopPanel d={d} pieces={pieces} onClose={close} />}</AnimatePresence>
			</div>
			<div className="relative mt-4">
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
							onClick={close}
							className="absolute inset-0 z-30 hidden cursor-default bg-gray-950/45 lg:block"
						/>
					)}
				</AnimatePresence>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: the slab, and the panel rising from it.

function PhoneSlab({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const [sheet, setSheet] = useState(-1)
	const [focus, setFocus] = useState<Focus>("vibe")
	useFocusOn(focus, sheet >= 0)
	const openAt = (f: Focus) => {
		setFocus(f)
		setSheet(0)
	}
	const { state } = d.filters
	const mine = state.onMyServices
	const sort = useSort(d)
	const sortLabel = sort.options.find((s) => s.key === sort.value)?.label ?? ""
	const label = pickedLabel(d.picked)
	const chips = pieces.chips.filter((c) => c.key !== "services")
	const total = d.counts?.total
	const line = (
		<div className="flex h-11 items-center gap-2.5 px-3 pt-2 text-xs">
			<HiddenMeter counts={d.counts} className="w-10 shrink-0" />
			<span className="shrink-0 whitespace-nowrap text-gray-400">
				{total != null ? <RollingNumber value={total} className="font-bold text-white" /> : "…"}{" "}
				{d.filters.searching ? "matches" : "showing"}
			</span>
			{chips.length > 0 && (
				<div className="-mr-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-3 [scrollbar-width:none]">
					{chips.map((c) => (
						<button
							key={c.key}
							type="button"
							onClick={() => pieces.onChange(c.remove(state))}
							aria-label={`Remove ${c.label}`}
							className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.07] pr-2 pl-2.5 text-[12px] text-gray-100 cursor-pointer"
						>
							{c.label}
							<span aria-hidden className="text-gray-500">
								×
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
	return (
		<div className="lg:hidden">
			<SlabShell
				line={line}
				strip={
					<>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => openAt("vibe")}
							aria-label={label ? `Mood: ${label}` : "Mood"}
							className={`${SLAB_SEGMENT} ${label ? "bg-white/10 text-white" : "text-gray-200"}`}
						>
							<span className="flex h-4 items-center">
								<HueDots tags={d.picked} size={12} idle />
							</span>
							<span className="w-full truncate px-1 text-center">{label ?? "Mood"}</span>
						</motion.button>
						<motion.button
							type="button"
							role="switch"
							aria-checked={mine}
							aria-label="On my services"
							whileTap={TAP}
							onClick={() =>
								pieces.hasServices ? pieces.servicesProps.onChange(!mine) : navigate(SERVICES_PATH)
							}
							className={`${SLAB_SEGMENT} ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 text-white" : "text-gray-400"}`}
						>
							{mine ? (
								<ServiceStack providers={pieces.services.providers} on size={16} />
							) : pieces.hasServices ? (
								<GlobeAltIcon className="h-4 w-4" />
							) : (
								<PlusIcon className="h-4 w-4" />
							)}
							<span className="w-full truncate px-0.5 text-center">
								{mine ? "My services" : pieces.hasServices ? "Everywhere" : "Add services"}
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
							{state.notSeenYet ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
							<span className="w-full truncate px-0.5 text-center">{state.notSeenYet ? "Not seen" : "Seen too"}</span>
						</motion.button>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => openAt("essentials")}
							aria-label={`Sort: ${sortLabel}`}
							className={`${SLAB_SEGMENT} text-gray-200`}
						>
							<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
							<span className="w-full truncate px-1 text-center">{sortLabel}</span>
						</motion.button>
					</>
				}
				trailing={
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onClick={() => openAt("filters")}
						aria-haspopup="dialog"
						aria-expanded={sheet >= 0}
						aria-label={pieces.secondaryCount ? `Filters, ${pieces.secondaryCount} active` : "Filters"}
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
				<div className="flex flex-col gap-8 px-5 pt-2 pb-6">
					<div>
						<ColumnTitle>Vibe</ColumnTitle>
						<Vibe d={d} />
					</div>
					<div>
						<ColumnTitle>Filters</ColumnTitle>
						<Essentials d={d} pieces={pieces} withSort />
						<div className="mt-5">
							<DeepFilters pieces={pieces} />
						</div>
					</div>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantM({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			<DiscoverHeading
				q={d.q}
				onSearch={(text) => d.setQ(text)}
				onClear={() => d.setQ(null)}
				explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
			/>
			<DesktopBar d={d} pieces={pieces} />
			<PhoneSlab d={d} pieces={pieces} />
		</div>
	)
}
