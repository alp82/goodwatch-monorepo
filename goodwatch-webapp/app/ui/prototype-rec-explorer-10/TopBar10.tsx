// PROTOTYPE - throwaway. Round 10 of the Explorer: the top bar, in three variants (?variant=tabs|menu|legend, see
// variants10.ts). Two questions: how the control that moves the map says that it moves the map ("All" said nothing),
// and how the filters look behind one Filters button, built from Discover's controls (ui/filter-bar).
// - tabs: a "Go to" row of places, each with its color; Filters opens a popover under its button.
// - menu: one "Viewing" button that opens the list of places; Filters drops a strip of controls under the bar.
// - legend: the places leave the bar for a list at the side of the map; the bar keeps Filters and what's on.
// On phones every variant opens Discover's bottom sheet for the filters.
import { MapIcon, MapPinIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	type ExplorerService,
	GROUPING_NAMES,
	type Grouping,
} from "~/domain/explorer"
import {
	ALL_TITLE_TYPES,
	ANIME_CHOICES,
	ANIME_SHORT_NAMES,
	TITLE_FORMATS,
	TITLE_FORMAT_NAMES,
	type TitleTypeFilter,
	isAllTitleTypes,
} from "~/domain/title-type"
import { SnapSheet } from "~/ui/filter-bar/SnapSheet"
import {
	FiltersButton,
	NotSeenSwitch,
	ServicesControl,
	radioKeys,
} from "~/ui/filter-bar/controls"
import { MENU } from "~/ui/filter-bar/motion"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import { REGION_COLORS } from "./world10"

interface Place {
	id: string
	name: string
	/** The region's color; none for the whole map and the middle. */
	color?: string
	sub?: string
}

interface TopBarProps {
	/** The selection, when it lives in the bar. */
	selection?: ReactNode
	phone: boolean
	/** The groupings this viewer has, each with how many islands it holds. */
	groupings: { id: Grouping; islands: number }[]
	/** The place in the middle of the view: "all" out at the world, "hub" on the middle, or a grouping. */
	at: string
	onGo: (place: string) => void
	/** Islands are picked: the middle is a place worth going to. */
	picked: number
	onMyServices: boolean
	notSeenYet: boolean
	services: ExplorerService[]
	onServices: (on: boolean) => void
	onUnseen: (on: boolean) => void
	titleType: TitleTypeFilter
	onTitleType: (type: TitleTypeFilter) => void
}

const FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
const GLASS = "bg-[#0a0e1a]/60 ring-1 ring-inset ring-white/10 backdrop-blur-xl"
const CAPTION = "text-xs font-semibold uppercase tracking-wide text-gray-400"

const Dot = ({ color }: { color?: string }) =>
	color ? (
		<span
			aria-hidden
			className="h-2.5 w-2.5 shrink-0 rounded-full"
			style={{ background: color, boxShadow: `0 0 10px ${color}` }}
		/>
	) : null

// ------------------------------------------------------------ the filters

/** A radio group as a row of segments, as the type filter's panel draws them. */
function Segmented<K extends string>({
	label,
	options,
	names,
	value,
	onPick,
}: {
	label: string
	options: readonly K[]
	names: Record<K, string>
	value: K
	onPick: (key: K) => void
}) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			onKeyDown={(event) => radioKeys(event, (index) => onPick(options[index]))}
			className={`flex gap-0.5 rounded-[14px] p-1 ${GLASS}`}
		>
			{options.map((key) => {
				const on = key === value
				return (
					<button
						key={key}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a segmented control; the buttons carry the radio role and arrow keys
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						onClick={() => onPick(key)}
						className={`h-9 flex-1 rounded-[10px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors ${FOCUS} ${on ? "bg-[#f4f6ff] text-[#0b0f1c] shadow-[0_4px_18px_rgba(160,190,255,.3)]" : "text-indigo-100/60 hover:bg-white/[0.06] hover:text-white"}`}
					>
						{names[key]}
					</button>
				)
			})}
		</div>
	)
}

type FilterProps = Pick<
	TopBarProps,
	| "onMyServices"
	| "notSeenYet"
	| "services"
	| "onServices"
	| "onUnseen"
	| "titleType"
	| "onTitleType"
>

const activeCount = (p: FilterProps) =>
	(p.titleType.format !== "all" ? 1 : 0) +
	(p.titleType.anime !== "any" ? 1 : 0) +
	(p.onMyServices ? 1 : 0) +
	(p.notSeenYet ? 1 : 0)

/** The filters, built from Discover's controls: stacked (a popover, a sheet) or in a row (the strip). */
function FilterControls({
	p,
	row = false,
}: {
	p: FilterProps
	row?: boolean
}) {
	const mine = p.services
		.filter((s) => s.mine && s.logo)
		.map((s) => ({ id: s.id, logo_path: s.logo as string }))
	const group = row ? "flex flex-col gap-1.5" : "flex flex-col gap-1.5"
	return (
		<div
			className={
				row ? "flex flex-wrap items-end gap-x-4 gap-y-3" : "flex flex-col gap-4"
			}
		>
			<div className={group}>
				<span aria-hidden className={CAPTION}>
					Type
				</span>
				<Segmented
					label="Type"
					options={TITLE_FORMATS}
					names={TITLE_FORMAT_NAMES}
					value={p.titleType.format}
					onPick={(format) => p.onTitleType({ ...p.titleType, format })}
				/>
			</div>
			<div className={group}>
				<span aria-hidden className={CAPTION}>
					Anime
				</span>
				<Segmented
					label="Anime"
					options={ANIME_CHOICES}
					names={ANIME_SHORT_NAMES}
					value={p.titleType.anime}
					onPick={(anime) => p.onTitleType({ ...p.titleType, anime })}
				/>
			</div>
			<div className={group}>
				<span aria-hidden className={CAPTION}>
					Where to watch
				</span>
				<ServicesControl
					on={p.onMyServices}
					hasServices={p.services.some((s) => s.mine)}
					providers={mine}
					onChange={p.onServices}
					onAddServices={() => {
						window.location.href = "/settings/streaming"
					}}
					size="sm"
				/>
			</div>
			<div className={group}>
				<span aria-hidden className={CAPTION}>
					Seen
				</span>
				<NotSeenSwitch on={p.notSeenYet} onChange={p.onUnseen} size="sm" />
			</div>
		</div>
	)
}

const clearAll = (p: FilterProps) => {
	if (!isAllTitleTypes(p.titleType)) p.onTitleType(ALL_TITLE_TYPES)
	if (p.onMyServices) p.onServices(false)
	if (p.notSeenYet) p.onUnseen(false)
}

const PanelHead = ({ p }: { p: FilterProps }) => (
	<div className="flex items-baseline justify-between gap-3">
		<div>
			<h2 className="text-base font-bold text-white">Filters</h2>
			<p className="text-sm text-gray-400">Hide titles on every island</p>
		</div>
		{activeCount(p) > 0 && (
			<button
				type="button"
				onClick={() => clearAll(p)}
				className={`-m-2 rounded-lg p-2 text-sm font-semibold text-amber-300 hover:text-amber-200 ${FOCUS}`}
			>
				Clear
			</button>
		)}
	</div>
)

/**
 * The Filters button and what it opens. On phones Discover's bottom sheet; from there up a popover under the button
 * ("popover"), or nothing here ("strip": the bar shows the controls in a row of its own, see `open`).
 */
function Filters({
	p,
	phone,
	form,
	open,
	onOpen,
}: {
	p: FilterProps
	phone: boolean
	form: "popover" | "strip"
	open: boolean
	onOpen: (open: boolean) => void
}) {
	const root = useRef<HTMLDivElement>(null)
	const popover = useRef<HTMLDivElement>(null)
	const pop = open && !phone && form === "popover"
	useModalDialog({ open: pop, onClose: () => onOpen(false), container: popover })
	useEffect(() => {
		if (!pop) return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) onOpen(false)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [pop, onOpen])
	// The sheet mounts in the body after the first render, clear of the map's stacking.
	const [body, setBody] = useState(false)
	useEffect(() => setBody(true), [])
	return (
		<div ref={root} className="relative shrink-0">
			<FiltersButton
				count={activeCount(p)}
				expanded={open}
				onClick={() => onOpen(!open)}
			/>
			<AnimatePresence>
				{pop && (
					<motion.div
						// biome-ignore lint/a11y/useSemanticElements: an animated popover with its own focus trap; <dialog> can't animate out
						ref={popover}
						role="dialog"
						aria-modal="true"
						aria-label="Filters"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute right-0 z-40 mt-2 flex w-96 max-w-[calc(100vw-1.5rem)] origin-top-right flex-col gap-4 p-4 ${MENU}`}
					>
						<PanelHead p={p} />
						<FilterControls p={p} />
					</motion.div>
				)}
			</AnimatePresence>
			{body &&
				phone &&
				createPortal(
					<SnapSheet
						index={open ? 0 : -1}
						onIndex={(index) => onOpen(index >= 0)}
						label="Filters"
						snaps={[0.62]}
						header={
							<div className="px-4 pb-3">
								<PanelHead p={p} />
							</div>
						}
					>
						<div className="px-4 pt-1 pb-6">
							<FilterControls p={p} />
						</div>
					</SnapSheet>,
					document.body,
				)}
		</div>
	)
}

/** What's on, as chips that turn it off (legend). */
function ActiveChips({ p }: { p: FilterProps }) {
	const chips: { key: string; label: string; off: () => void }[] = []
	if (p.titleType.format !== "all")
		chips.push({
			key: "format",
			label: TITLE_FORMAT_NAMES[p.titleType.format],
			off: () => p.onTitleType({ ...p.titleType, format: "all" }),
		})
	if (p.titleType.anime !== "any")
		chips.push({
			key: "anime",
			label: p.titleType.anime === "only" ? "Anime only" : "No anime",
			off: () => p.onTitleType({ ...p.titleType, anime: "any" }),
		})
	if (p.onMyServices)
		chips.push({
			key: "services",
			label: "On my services",
			off: () => p.onServices(false),
		})
	if (p.notSeenYet)
		chips.push({
			key: "unseen",
			label: "Not seen yet",
			off: () => p.onUnseen(false),
		})
	if (!chips.length) return null
	return (
		<ul aria-label="Active filters" className="flex min-w-0 items-center gap-2">
			{chips.map((chip) => (
				<li key={chip.key}>
					<button
						type="button"
						onClick={chip.off}
						aria-label={`Remove ${chip.label}`}
						className={`group flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] pl-3 pr-2 text-sm whitespace-nowrap text-gray-100 ring-1 ring-white/10 hover:bg-white/10 ${FOCUS}`}
					>
						{chip.label}
						<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
					</button>
				</li>
			))}
		</ul>
	)
}

// ------------------------------------------------------------ the places

/** One place as a button: its color, its name, lit when the map is there. */
function PlaceButton({
	place,
	on,
	onGo,
	className = "",
	children,
}: {
	place: Place
	on: boolean
	onGo: (id: string) => void
	className?: string
	children?: ReactNode
}) {
	return (
		<button
			type="button"
			aria-current={on ? "location" : undefined}
			onClick={() => onGo(place.id)}
			className={`flex shrink-0 items-center gap-2 rounded-[11px] text-[15px] font-semibold whitespace-nowrap transition-colors ${FOCUS} ${on ? "bg-[#f4f6ff] text-[#0b0f1c] shadow-[0_4px_18px_rgba(160,190,255,.3)]" : "text-indigo-100/70 hover:bg-white/[0.08] hover:text-white"} ${className}`}
		>
			{place.id === "all" ? (
				<MapIcon aria-hidden className="h-4 w-4 shrink-0" />
			) : place.id === "hub" ? (
				<MapPinIcon aria-hidden className="h-4 w-4 shrink-0" />
			) : (
				<Dot color={place.color} />
			)}
			{children ?? place.name}
		</button>
	)
}

/** The places as one button that opens their list (menu). */
function PlaceMenu({
	places,
	at,
	onGo,
	compact = false,
}: {
	places: Place[]
	at: string
	onGo: (id: string) => void
	/** Without its icon, where the bar is short of room. */
	compact?: boolean
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const menu = useRef<HTMLDivElement>(null)
	useModalDialog({ open, onClose: () => setOpen(false), container: menu })
	useEffect(() => {
		if (!open) return
		const down = (event: Event) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [open])
	const here = places.find((x) => x.id === at) ?? places[0]
	return (
		<div ref={root} className="relative min-w-0 shrink">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={`flex h-12 max-w-full items-center gap-2.5 rounded-2xl px-3.5 text-left ${GLASS} hover:ring-white/25 ${FOCUS}`}
			>
				{!compact && (
					<MapIcon aria-hidden className="h-5 w-5 shrink-0 text-amber-300" />
				)}
				<span className="flex min-w-0 flex-col leading-tight">
					<span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
						Viewing
					</span>
					<span className="flex items-center gap-2 truncate text-[15px] font-bold text-white">
						<Dot color={here.color} />
						{here.name}
					</span>
				</span>
				<svg viewBox="0 0 12 8" aria-hidden="true" className="ml-1 h-2 w-3">
					<path
						d="M1 1.5l5 5 5-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						// biome-ignore lint/a11y/useSemanticElements: an animated popover with its own focus trap; <dialog> can't animate out
						ref={menu}
						role="dialog"
						aria-modal="true"
						aria-label="Go to"
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						className={`absolute left-0 z-40 mt-2 flex w-72 max-w-[calc(100vw-1.5rem)] origin-top-left flex-col gap-0.5 p-2 ${MENU}`}
					>
						<p className={`px-2.5 pt-1.5 pb-1 ${CAPTION}`}>Go to</p>
						{places.map((place) => (
							<PlaceButton
								key={place.id}
								place={place}
								on={place.id === at}
								onGo={(id) => {
									onGo(id)
									setOpen(false)
								}}
								className="h-11 w-full px-2.5"
							>
								<span className="flex-1 text-left">{place.name}</span>
								{place.sub && (
									<span className="text-xs font-medium opacity-60">
										{place.sub}
									</span>
								)}
							</PlaceButton>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ------------------------------------------------------------ the bar

export function TopBar10(props: TopBarProps) {
	const { phone, groupings, at, onGo, picked, selection } = props
	// The owner chose the menu (2026-10-13); the other two forms are still here to compare.
	const bar = "menu" as "tabs" | "menu" | "legend"
	const [open, setOpen] = useState(false)
	const places: Place[] = [
		{ id: "all", name: "Whole map", sub: `${groupings.length} groups` },
		...(picked
			? [
					{
						id: "hub",
						name: "Combined",
						sub: `${picked} ${picked === 1 ? "island" : "islands"}`,
					},
				]
			: []),
		...groupings.map((g) => ({
			id: g.id,
			name: GROUPING_NAMES[g.id],
			color: REGION_COLORS[g.id],
			sub: `${g.islands} islands`,
		})),
	]
	const filters = (
		<Filters
			p={props}
			phone={phone}
			form={bar === "menu" ? "strip" : "popover"}
			open={open}
			onOpen={setOpen}
		/>
	)
	/** The places in a row: a caption that says what they do, then one button each. On phones the row scrolls. */
	const row = (
		<nav
			aria-label="Go to"
			className={`flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-[15px] p-1 [scrollbar-width:none] ${GLASS}`}
		>
			<span className={`shrink-0 px-2.5 ${CAPTION}`}>Go to</span>
			{places.map((place) => (
				<PlaceButton
					key={place.id}
					place={place}
					on={place.id === at}
					onGo={onGo}
					className="h-10 px-3"
				/>
			))}
		</nav>
	)
	return (
		<header className="ex-top">
			<div className="ex-row">
				<h1 className="ex-brand">Explorer</h1>
				{bar === "tabs" && !phone && row}
				{bar === "menu" && (
					<PlaceMenu
						places={places}
						at={at}
						onGo={onGo}
						compact={phone && !!selection}
					/>
				)}
				{selection}
				{bar === "legend" && !phone && <ActiveChips p={props} />}
				<span className="flex-1" />
				{filters}
			</div>
			{/* On phones the row of places takes a line of its own. */}
			{bar !== "menu" && phone && <div className="ex-row mt-2">{row}</div>}
			{/* The strip: the filters in a row under the bar, as Discover's row shows them. */}
			<AnimatePresence initial={false}>
				{bar === "menu" && open && !phone && (
					<motion.div
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: 0.16 }}
						className={`ex-row mt-3 w-fit max-w-full rounded-2xl p-4 ${MENU}`}
					>
						<FilterControls p={props} row />
						{activeCount(props) > 0 && (
							<button
								type="button"
								onClick={() => clearAll(props)}
								className={`self-end rounded-lg px-2 py-2 text-sm font-semibold text-amber-300 hover:text-amber-200 ${FOCUS}`}
							>
								Clear
							</button>
						)}
					</motion.div>
				)}
			</AnimatePresence>
			{/* The legend: the places at the side of the map, where the map is. */}
			{bar === "legend" && !phone && (
				<nav
					aria-label="Go to"
					className={`pointer-events-auto absolute top-[calc(50vh-11rem)] left-6 flex w-44 flex-col gap-0.5 rounded-2xl p-2 ${GLASS}`}
				>
					<p className={`px-2.5 pt-1 pb-1 ${CAPTION}`}>Go to</p>
					{places.map((place) => (
						<PlaceButton
							key={place.id}
							place={place}
							on={place.id === at}
							onGo={onGo}
							className="h-9 w-full px-2.5"
						/>
					))}
				</nav>
			)}
		</header>
	)
}
