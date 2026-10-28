// PROTOTYPE - throwaway. Variant N, "Dock": today's phone slab becomes the one control on every screen size. A floating
// dock at the bottom (desktop: centered, 720 px, above the prototype switcher; phones: the slab's place above the site
// dock) holds Mood (the picks' hue dots), My services / Everywhere, Not seen yet, Sort and Filters (count). Mood,
// services, Sort and Filters each open a panel that rises from the dock: mood, about and style chips with counts; the
// real streaming card; the sorts; the real card stack. The page top keeps only the search heading, Read as and the
// count line, so the grid gets the full width.
import {
	AdjustmentsHorizontalIcon,
	ArrowsUpDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, FilterSearchField, ShowTitlesButton } from "~/ui/filter-bar"
import { FilterInsight } from "~/ui/filter-bar/ActiveFilters"
import { ServiceStack, ServicesControl, SortItems } from "~/ui/filter-bar/controls"
import { discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { MENU, SPRING, TAP } from "~/ui/filter-bar/motion"
import { PopularInline } from "~/ui/filter-bar/PopularFilters"
import { ChipList, type Option } from "~/ui/filter-bar/SheetControls"
import { DockStrip } from "~/ui/navigation/MobileDock"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, type TagGroup, useFilterPieces } from "../kit"

export const NAME = "Dock"

type Panel = "mood" | "services" | "sort" | "filters"
type Pieces = ReturnType<typeof useFilterPieces>

function useDesktop() {
	const [desktop, setDesktop] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)")
		const update = () => setDesktop(mq.matches)
		update()
		mq.addEventListener("change", update)
		return () => mq.removeEventListener("change", update)
	}, [])
	return desktop
}

export function VariantN({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const desktop = useDesktop()
	const [panel, setPanel] = useState<Panel | null>(null)
	useEffect(() => {
		if (!panel) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null)
		document.addEventListener("keydown", key)
		return () => document.removeEventListener("keydown", key)
	}, [panel])

	const dock = <Dock d={d} pieces={pieces} panel={panel} setPanel={setPanel} desktop={desktop} />
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-28 lg:px-8 lg:pb-48">
				<DiscoverHeading
					q={d.q}
					onSearch={(text) => d.setQ(text)}
					onClear={() => d.setQ(null)}
					explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
				/>
				<FilterInsight
					counts={d.counts}
					chips={pieces.chips.filter((c) => c.key !== "services")}
					state={d.filters.state}
					onChange={pieces.onChange}
					onDrop={d.filters.drop}
					onClear={d.filters.clearSecondary}
					searching={d.filters.searching}
					idle={desktop ? <PopularInline data={pieces.groups} /> : undefined}
					className="mt-4 min-h-8 lg:mt-5"
				/>
				<div className="mt-4">
					<ProtoGrid d={d} />
				</div>
			</div>
			<AnimatePresence>
				{panel && (
					<motion.div
						key="scrim"
						aria-hidden
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onPointerDown={() => setPanel(null)}
						className="fixed inset-0 z-40 bg-gray-950/60"
					/>
				)}
			</AnimatePresence>
			{desktop ? (
				<div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-6">
					<div className="pointer-events-auto relative w-full max-w-[720px]">{dock}</div>
				</div>
			) : (
				<DockStrip>
					<div className="relative min-w-0 flex-1">{dock}</div>
				</DockStrip>
			)}
		</MotionConfig>
	)
}

// ---------------------------------------------------------------------------------------------------------------

const SEG =
	"relative flex h-full min-w-0 flex-1 items-center justify-center rounded-[14px] font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 max-lg:flex-col max-lg:gap-0.5 max-lg:text-[11px] lg:gap-2 lg:px-3 lg:text-[13px]"

function Dock({
	d,
	pieces,
	panel,
	setPanel,
	desktop,
}: {
	d: ProtoDiscover
	pieces: Pieces
	panel: Panel | null
	setPanel: (p: Panel | null) => void
	desktop: boolean
}) {
	const { state } = d.filters
	const navigate = useNavigate()
	const taste = "signUp" as const
	const sorts = discoverSorts(d.filters.searching, taste)
	const sort = sortShown(d.filters.sort, d.filters.searching, taste)
	const sortLabel = sorts.find((s) => s.key === sort)?.label ?? ""
	const mineOn = state.onMyServices
	const { hasServices } = pieces
	const toggle = (p: Panel) => setPanel(panel === p ? null : p)
	const moodLabel =
		d.picked.length === 0
			? "Mood"
			: desktop
				? d.picked.map((t) => t.name).join(", ")
				: d.picked.length > 1
					? `${d.picked[0].name} +${d.picked.length - 1}`
					: d.picked[0].name
	const lit = (on: boolean) => (on ? "text-white" : "text-gray-400 hover:text-gray-200")

	return (
		<>
			<div className="flex items-center gap-2">
				<div
					className={`flex h-[52px] min-w-0 flex-1 items-stretch gap-1 rounded-[18px] p-1 ring-1 ring-white/10 lg:h-14 lg:rounded-[20px] ${desktop ? "bg-gray-900/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)]" : "bg-white/[0.05]"}`}
				>
					{/* Mood */}
					<motion.button
						type="button"
						whileTap={TAP}
						aria-haspopup="dialog"
						aria-expanded={panel === "mood"}
						onClick={() => toggle("mood")}
						className={`${SEG} lg:!flex-[1.5] ${panel === "mood" || d.picked.length ? "bg-white/10 text-white" : lit(false)}`}
					>
						<HueDots tags={d.picked} />
						<span className="w-full truncate px-0.5 text-center lg:w-auto lg:px-0">{moodLabel}</span>
					</motion.button>
					{/* Services */}
					<motion.button
						type="button"
						whileTap={TAP}
						aria-haspopup="dialog"
						aria-expanded={panel === "services"}
						onClick={() => toggle("services")}
						className={`${SEG} ${lit(mineOn || panel === "services")}`}
					>
						{mineOn && (
							<motion.span
								layoutId="n-dock-mine"
								transition={SPRING}
								className="absolute inset-0 rounded-[14px] bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
							/>
						)}
						{!mineOn && panel === "services" && <span className="absolute inset-0 rounded-[14px] bg-white/10" />}
						<span className="relative">
							{mineOn ? (
								<ServiceStack providers={pieces.services.providers} on size={16} />
							) : hasServices ? (
								<GlobeAltIcon className="h-4 w-4" />
							) : (
								<PlusIcon className="h-4 w-4" />
							)}
						</span>
						<span className="relative w-full truncate px-0.5 text-center lg:w-auto lg:px-0">
							{mineOn ? "My services" : hasServices ? pieces.servicesProps.labels.everywhere : "Everywhere"}
						</span>
					</motion.button>
					{/* Not seen yet: a switch, right on the dock */}
					<motion.button
						type="button"
						role="switch"
						aria-checked={state.notSeenYet}
						aria-label="Not seen yet"
						whileTap={TAP}
						onClick={() => d.filters.set({ notSeenYet: !state.notSeenYet })}
						className={`${SEG} ${lit(state.notSeenYet)}`}
					>
						{state.notSeenYet && (
							<motion.span
								layoutId="n-dock-seen"
								transition={SPRING}
								className="absolute inset-0 rounded-[14px] bg-linear-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]"
							/>
						)}
						<span className="relative">
							{state.notSeenYet ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
						</span>
						<span className="relative w-full truncate px-0.5 text-center lg:w-auto lg:px-0">
							{state.notSeenYet ? "Not seen" : "Seen too"}
						</span>
					</motion.button>
					{/* Sort */}
					<motion.button
						type="button"
						whileTap={TAP}
						aria-haspopup="menu"
						aria-expanded={panel === "sort"}
						aria-label={`Sort: ${sortLabel}`}
						onClick={() => toggle("sort")}
						className={`${SEG} ${panel === "sort" ? "bg-white/10 text-white" : "text-gray-200 hover:text-white"}`}
					>
						<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
						<span className="w-full truncate px-0.5 text-center lg:w-auto lg:px-0">{sortLabel}</span>
					</motion.button>
				</div>
				{/* Filters */}
				<motion.button
					type="button"
					whileTap={{ scale: 0.9 }}
					onClick={() => toggle("filters")}
					aria-haspopup="dialog"
					aria-expanded={panel === "filters"}
					aria-label={pieces.secondaryCount ? `Filters, ${pieces.secondaryCount} active` : "Filters"}
					className={`relative flex h-[52px] w-[52px] shrink-0 items-center justify-center gap-2 rounded-[18px] text-white ring-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:h-14 lg:w-auto lg:rounded-[20px] lg:px-5 ${panel === "filters" ? "bg-white/15 ring-white/25" : desktop ? "bg-gray-900/95 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.95)] hover:ring-white/25" : "bg-white/[0.08] ring-white/10"}`}
				>
					<AdjustmentsHorizontalIcon className="h-5 w-5" />
					<span className="hidden text-sm font-bold lg:inline">Filters</span>
					{pieces.secondaryCount > 0 && (
						<span
							aria-hidden
							className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950 lg:static lg:ring-0"
						>
							{pieces.secondaryCount}
						</span>
					)}
				</motion.button>
			</div>

			<AnimatePresence>
				{panel && (
					<motion.div
						key={panel}
						role={panel === "sort" ? "menu" : "dialog"}
						aria-label={PANEL_TITLE[panel]}
						initial={{ opacity: 0, y: 12, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.98 }}
						transition={SPRING}
						className={`absolute bottom-full mb-2 flex flex-col overflow-hidden ${MENU} ${
							panel === "sort"
								? "right-14 w-72 origin-bottom-right lg:right-32"
								: "inset-x-0 origin-bottom"
						}`}
						style={{
							maxHeight: desktop
								? "min(72vh, calc(100vh - 12rem))"
								: "calc(100dvh - var(--nav-dock-height, 140px) - 5rem)",
						}}
					>
						{panel === "sort" ? (
							<div className="p-1.5">
								<SortItems
									options={sorts}
									value={sort}
									dense
									footnote={d.filters.searching ? undefined : "Relevance joins once you search."}
									onPick={(key) => {
										d.filters.setSort(key as typeof d.filters.sort)
										setPanel(null)
									}}
								/>
							</div>
						) : (
							<PanelFrame
								title={PANEL_TITLE[panel]}
								onClose={() => setPanel(null)}
								clear={
									panel === "mood" && d.picked.length
										? { label: `Clear ${d.picked.length}`, onClick: d.clearTags }
										: panel === "filters" && pieces.secondaryCount
											? { label: `Clear ${pieces.secondaryCount}`, onClick: d.filters.clearSecondary }
											: undefined
								}
								footer={<ShowTitlesButton counts={d.counts} onClick={() => setPanel(null)} className="w-full" />}
							>
								{panel === "mood" && <MoodPanel d={d} />}
								{panel === "services" && (
									<div className="flex flex-col gap-5">
										<ServicesControl
											{...pieces.servicesProps}
											onAddServices={() => navigate(SERVICES_PATH)}
											labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
										/>
										<FilterGroups data={pieces.groups} query="streaming services" />
									</div>
								)}
								{panel === "filters" && <FiltersPanel pieces={pieces} />}
							</PanelFrame>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}

const PANEL_TITLE: Record<Panel, string> = {
	mood: "Mood",
	services: "Where to watch",
	sort: "Sort",
	filters: "Filters",
}

function HueDots({ tags }: { tags: Tag[] }) {
	// Without picks: three quiet mood hues, so the segment reads as color before it reads as a word.
	const shown = tags.length ? tags.slice(0, 4) : TAGS.filter((t) => t.group === "moods").slice(0, 3)
	return (
		<span aria-hidden className="relative flex h-4 items-center">
			{shown.map((t, i) => (
				<span
					key={`${t.group}:${t.key}`}
					className={`h-3 w-3 rounded-full ring-2 ring-gray-950 ${tags.length ? "" : "opacity-50"}`}
					style={{ background: t.color, marginLeft: i ? -4 : 0, zIndex: 4 - i }}
				/>
			))}
		</span>
	)
}

function PanelFrame({
	title,
	onClose,
	clear,
	footer,
	children,
}: {
	title: string
	onClose: () => void
	clear?: { label: string; onClick: () => void }
	footer: ReactNode
	children: ReactNode
}) {
	return (
		<>
			<header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
				<h2 className="text-[17px] font-bold text-white">{title}</h2>
				{clear && (
					<button
						type="button"
						onClick={clear.onClick}
						className="ml-auto text-xs text-gray-400 cursor-pointer hover:text-white"
					>
						{clear.label}
					</button>
				)}
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className={`${clear ? "" : "ml-auto"} grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-gray-300 cursor-pointer hover:bg-white/10 hover:text-white`}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-5">{children}</div>
			<div className="shrink-0 border-t border-white/5 px-4 pt-3 pb-3">{footer}</div>
		</>
	)
}

function tagOptions(d: ProtoDiscover, group: TagGroup): Option[] {
	return TAGS.filter((t) => t.group === group).map((t) => ({
		id: t.key,
		label: t.name,
		active: d.isOn(t),
		count: d.countFor(t),
		toggle: () => d.toggle(t),
		swatch: <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />,
	}))
}

function MoodPanel({ d }: { d: ProtoDiscover }) {
	return (
		<div className="flex flex-col gap-6">
			<PanelBlock title="Mood" note="Up to three">
				<ChipList options={tagOptions(d, "moods")} />
			</PanelBlock>
			<PanelBlock title="About">
				<ChipList options={tagOptions(d, "themes")} limit={8} sort />
			</PanelBlock>
			<PanelBlock title="Style">
				<ChipList options={tagOptions(d, "styles")} limit={8} sort />
			</PanelBlock>
		</div>
	)
}

function PanelBlock({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
	return (
		<section>
			<div className="mb-2.5 flex items-baseline justify-between">
				<h3 className="text-[15px] font-bold text-white">{title}</h3>
				{note && <span className="text-xs text-gray-500">{note}</span>}
			</div>
			{children}
		</section>
	)
}

function FiltersPanel({ pieces }: { pieces: Pieces }) {
	const [query, setQuery] = useState("")
	return (
		<>
			<FilterSearchField value={query} onChange={setQuery} />
			<FilterGroups data={pieces.groups} query={query} className="mt-5" />
		</>
	)
}
