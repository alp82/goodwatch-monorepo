// The "Go deeper" doors under a member's start (doors.ts has the rules): four fixed-size doors, the open one filled
// amber with a notch into its section; the section links to its page from its header and from a last tile. The open
// door is decided from the data alone, so the server's HTML has its section. The order is kept from the first render:
// a list that arrives later fills its door in place.
import { ArrowRightIcon, PlusIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useRef, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { DISPLAY, EASE, WRAP, posterUrl } from "~/ui/watch-next/style"
import {
	type Cta,
	type Door,
	type DoorKey,
	type DoorTitle,
	GRID_CELLS,
	GRID_COLUMNS,
	type Reserve,
	type Strip as StripData,
	doorsOf,
	filtersOf,
	gridPlan,
	orderDoors,
	reserveOf,
	tileText,
} from "./doors"
import { type MemberStartData, PERSONAL_AT } from "./member-data"

const TEXT_LINK =
	"group inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-amber-400 underline-offset-4 outline-none hover:text-amber-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

const DOOR =
	"relative flex h-[6.5rem] w-full cursor-pointer flex-col justify-between gap-2 rounded-xl p-3 text-left outline-none transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:scale-[0.98] sm:h-28 sm:p-4"
/** The open door: an amber fill and a strong amber ring. */
const DOOR_OPEN =
	"bg-amber-400/[0.16] shadow-lg shadow-amber-950/40 ring-2 ring-amber-400"
/** The closed doors: quieter while another is open, full strength on hover or focus. */
const DOOR_SHUT =
	"bg-white/[0.05] opacity-60 ring-1 ring-white/5 hover:bg-white/10 hover:opacity-100 hover:ring-white/20 focus-visible:opacity-100"

const CHIP =
	"inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
const chipTone = (on: boolean) =>
	on
		? "bg-amber-400 text-gray-950"
		: "bg-white/[0.06] text-gray-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"

const PANEL_ID = "start-door-section"

export function Doors({ data }: { data: MemberStartData }) {
	const all = doorsOf(data)
	const [order] = useState(() => orderDoors(all).map((door) => door.key))
	const doors = order.flatMap((key) => all.filter((door) => door.key === key))
	// A door whose list ever came later than the page, on load or after a revalidation, keeps its room for good
	// (doors.ts, `reserveOf`). Adding during render is safe: the set only grows, and a repeat add changes nothing.
	const deferred = useRef(new Set<DoorKey>()).current
	for (const door of all) if (door.pending) deferred.add(door.key)
	const [open, setOpen] = useState<DoorKey>(order[0])
	const [filter, setFilter] = useState("all")
	// The section on load is the server's; a section opened later fades in.
	const [opened, setOpened] = useState(false)
	const current = doors.find((door) => door.key === open) ?? doors[0]
	const reserve =
		current.pending || deferred.has(current.key)
			? reserveOf(data, current.key)
			: null

	return (
		<section
			className={`${WRAP} pt-8 pb-28 lg:pt-2`}
			aria-labelledby="start-doors"
		>
			<h2
				id="start-doors"
				className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400"
			>
				Go deeper
			</h2>
			<ul
				className={`grid grid-cols-2 gap-2 sm:gap-3 ${doors.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
			>
				{doors.map((door) => {
					const on = door.key === current.key
					return (
						<li key={door.key} className="relative min-w-0">
							<button
								type="button"
								aria-expanded={on}
								aria-controls={PANEL_ID}
								onClick={() => {
									if (on) return
									setOpen(door.key)
									setFilter("all")
									setOpened(true)
								}}
								className={`${DOOR} ${on ? DOOR_OPEN : DOOR_SHUT}`}
							>
								<span
									className={`shrink-0 truncate text-base font-bold ${on ? "text-amber-100" : "text-white"}`}
								>
									{door.label}
								</span>
								<span className="flex items-end justify-between gap-2">
									<span
										className={`line-clamp-1 text-xs ${on ? "font-semibold text-amber-300" : "text-gray-400"}`}
									>
										{door.line}
									</span>
									<FewPosters titles={door.titles} />
								</span>
							</button>
							{/* The notch from the open door into its section (one row of doors on desktops only). */}
							{on ? (
								<motion.span
									layoutId="start-door-notch"
									aria-hidden
									transition={{ duration: 0.25, ease: EASE }}
									className="pointer-events-none absolute left-1/2 top-full z-10 mt-[41px] hidden h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-amber-400 bg-gray-900 lg:block"
								/>
							) : null}
						</li>
					)
				})}
			</ul>

			{/* The open section: a gray-900 panel whose amber top edge meets the notch. */}
			<div
				id={PANEL_ID}
				className="-mx-4 mt-10 border-t-2 border-amber-400 bg-gray-900 px-4 pt-5 pb-6 ring-1 ring-white/5 sm:mx-0 sm:rounded-2xl sm:px-6 lg:mt-12"
			>
				{/* A new section swaps in at once and fades up, so the panel never collapses between sections. */}
				<motion.div
					key={current.key}
					initial={opened ? { opacity: 0, y: 8 } : false}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2, ease: EASE }}
				>
					<DoorSection
						door={current}
						reserve={reserve}
						filter={filter}
						onFilter={setFilter}
					/>
				</motion.div>
			</div>
		</section>
	)
}

/**
 * An open door's section: its heading and page link, then its strip, filter chips and grid. A section with a reserve
 * (its list came later than the page) lays its content over that reserve's room, so it is never shorter than a full
 * grid, from the skeleton on, and its caption line keeps its place even when the list couldn't be read.
 */
export function DoorSection({
	door,
	reserve,
	filter,
	onFilter,
}: {
	door: Door
	reserve: Reserve | null
	filter: string
	onFilter: (key: string) => void
}) {
	const filters = filtersOf(door)
	const active = filters?.find((f) => f.key === filter) ?? null
	const shown = active
		? door.titles.filter((t) => active.keep(t.card))
		: door.titles
	const has = door.titles.length > 0 || door.pending
	const body =
		door.pending && reserve ? (
			<ReservedRoom reserve={reserve} />
		) : (
			<>
				{door.strip ? <Strip strip={door.strip} /> : null}

				{filters ? (
					<fieldset className="-mx-4 mb-4 flex min-w-0 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
						<legend className="sr-only">Filter</legend>
						{filters.map((f) => {
							const on = (active?.key ?? "all") === f.key
							return (
								<button
									key={f.key}
									type="button"
									aria-pressed={on}
									onClick={() => onFilter(f.key)}
									className={`${CHIP} ${chipTone(on)}`}
								>
									{f.label}
									<span
										className={`ml-1.5 tabular-nums ${on ? "text-gray-950/60" : "text-gray-500"}`}
									>
										{door.titles.filter((t) => f.keep(t.card)).length}
									</span>
								</button>
							)
						})}
					</fieldset>
				) : null}

				{door.pending ? (
					<PendingGrid lines={false} />
				) : has ? (
					<DoorGrid
						door={door}
						titles={shown}
						filtered={!!active && active.key !== "all"}
					/>
				) : null}
			</>
		)
	return (
		<>
			<div className="mb-4">
				<div className="flex items-baseline justify-between gap-3">
					<h3
						className={`${DISPLAY} min-w-0 truncate text-2xl leading-tight text-white sm:text-3xl`}
					>
						{door.label}
					</h3>
					{has ? (
						<Link to={door.href} prefetch="intent" className={TEXT_LINK}>
							<span>
								<span className="max-sm:hidden">Open </span>
								{door.pageName}
							</span>
							<ArrowRightIcon
								aria-hidden
								className="h-4 w-4 self-center transition-transform duration-200 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1"
							/>
						</Link>
					) : null}
				</div>
				{has ? (
					<p className="mt-0.5 text-sm text-gray-400">{door.note}</p>
				) : reserve ? (
					<p aria-hidden className="invisible mt-0.5 text-sm">
						{door.note}
					</p>
				) : null}
			</div>
			{reserve && !door.pending ? (
				// The reserve's room, unseen, and the list's content over it in the same grid cell.
				<div className="grid grid-cols-1 grid-rows-1">
					<div
						aria-hidden
						data-door-reserve
						className="invisible col-start-1 row-start-1 min-w-0"
					>
						<ReservedRoom reserve={reserve} />
					</div>
					<div className="col-start-1 row-start-1 min-w-0">{body}</div>
				</div>
			) : (
				body
			)}
		</>
	)
}

/** A reserve's room, drawn as the skeleton of a list on its way: its strip, the chips' row and a full grid. */
export function ReservedRoom({ reserve }: { reserve: Reserve }) {
	return (
		<div data-door-room>
			{reserve.strip ? <Strip strip={reserve.strip} /> : null}
			{reserve.filters ? (
				<div aria-hidden className="mb-4 flex h-9 gap-2 overflow-hidden">
					{["w-14", "w-20", "w-[4.5rem]"].map((width) => (
						<span
							key={width}
							className={`h-9 ${width} shrink-0 rounded-full bg-white/[0.04]`}
						/>
					))}
				</div>
			) : null}
			<PendingGrid lines={reserve.lines} />
		</div>
	)
}

/** Shown or hidden at each of the grid's widths, as literal classes so Tailwind keeps them. */
const shownAt = ([base, sm, lg]: boolean[]) =>
	`${base ? "" : "hidden"} ${sm ? "sm:block" : "sm:hidden"} ${lg ? "lg:block" : "lg:hidden"}`

/** Ghosts fade as they go, so a short row reads as room for more, not as missing posters. */
const GHOST_FADE = [
	"",
	"opacity-70",
	"opacity-50",
	"opacity-40",
	"opacity-30",
	"opacity-25",
]

function DoorGrid({
	door,
	titles,
	filtered,
}: {
	door: Door
	titles: DoorTitle[]
	filtered: boolean
}) {
	// A filtered view isn't the member's whole list, so it never asks for more; it only keeps whole rows.
	const ghost = filtered ? null : door.ghost
	const plans = GRID_COLUMNS.map((columns) =>
		gridPlan(titles.length, columns, !!ghost),
	)
	const posters = Math.max(...plans.map((p) => p.posters))
	const ghosts = Math.max(...plans.map((p) => p.ghosts))
	const blanks = Math.max(...plans.map((p) => p.blanks))
	const tile = tileText(door, Math.min(...plans.map((p) => p.posters)))
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
			{titles.slice(0, posters).map((title, i) => (
				<li
					key={title.card.key}
					className={`min-w-0 ${shownAt(plans.map((p) => i < p.posters))}`}
				>
					<TitlePosterCard card={title.card} actions={false} />
					{title.line ? <PosterLine line={title.line} /> : null}
				</li>
			))}
			{ghost
				? Array.from({ length: ghosts }, (_, i) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: the ghosts are interchangeable
							key={`ghost${i}`}
							className={`min-w-0 ${shownAt(plans.map((p) => i < p.ghosts))} ${GHOST_FADE[i] ?? "opacity-25"}`}
						>
							<Ghost cta={ghost} labeled={i === 0} />
						</li>
					))
				: null}
			{Array.from({ length: blanks }, (_, i) => (
				<li
					// biome-ignore lint/suspicious/noArrayIndexKey: the blanks are interchangeable
					key={`blank${i}`}
					aria-hidden
					className={`min-w-0 ${shownAt(plans.map((p) => i < p.blanks))}`}
				>
					<div className="aspect-[2/3] w-full rounded-lg border-2 border-dashed border-gray-800/70" />
				</li>
			))}
			{plans.some((p) => p.tile) ? (
				<li className={`min-w-0 ${shownAt(plans.map((p) => p.tile))}`}>
					<Link
						to={door.href}
						prefetch="intent"
						className="group flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-gray-800 bg-gray-950/60 p-2 text-center outline-none hover:border-amber-400/70 hover:bg-amber-400/[0.08] focus-visible:border-amber-300"
					>
						<span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40 group-hover:bg-amber-400 group-hover:text-gray-950 sm:h-12 sm:w-12">
							<ArrowRightIcon
								aria-hidden
								className="h-5 w-5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
							/>
						</span>
						<span className="text-sm font-bold leading-tight text-white">
							{tile.top}
						</span>
						<span className="text-xs leading-tight text-gray-400">
							{tile.sub}
						</span>
					</Link>
				</li>
			) : null}
		</ul>
	)
}

/**
 * A list on its way: a full grid of quiet poster slots, so the section has its size before the titles arrive; with
 * `lines`, each slot keeps room for two lines under its poster (Hot on socials' why).
 */
function PendingGrid({ lines }: { lines: boolean }) {
	return (
		<ul
			aria-busy
			aria-label="Loading"
			className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6"
		>
			{Array.from({ length: GRID_CELLS }, (_, i) => (
				<li
					// biome-ignore lint/suspicious/noArrayIndexKey: the slots are interchangeable
					key={i}
					className="min-w-0"
				>
					<div className="aspect-[2/3] w-full rounded-lg bg-white/[0.04]" />
					{lines ? (
						<div className={`mt-1.5 ${TWO_LINES} space-y-1.5 pt-0.5`}>
							<div className="h-2.5 rounded bg-white/[0.04]" />
							<div className="h-2.5 w-2/3 rounded bg-white/[0.04]" />
						</div>
					) : null}
				</li>
			))}
		</ul>
	)
}

/** Two lines of a poster's line under it (`text-xs leading-snug`), so a slot is as tall as a poster with its why. */
const TWO_LINES = "h-[calc(2*1.375*0.75rem)]"

/** The line under a poster: the next episode, or a hot title's place and why it's talked about. */
function PosterLine({ line }: { line: NonNullable<DoorTitle["line"]> }) {
	if (line.rank === undefined)
		return (
			<p
				className="mt-1.5 truncate text-xs font-semibold text-amber-300"
				title={line.text}
			>
				{line.text}
			</p>
		)
	return (
		<p
			className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-xs"
			title={line.text}
		>
			<span className="shrink-0 font-black tabular-nums text-amber-400">
				{line.rank}
			</span>
			<span className="line-clamp-2 leading-snug text-gray-300">
				{line.text}
			</span>
		</p>
	)
}

/** The "add more" placeholder: a dashed poster-shaped slot; the first carries the label and is the link. */
function Ghost({ cta, labeled }: { cta: Cta; labeled: boolean }) {
	const box =
		"flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-800 p-2 text-center"
	const plus = (
		<span className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 ring-1 ring-gray-700 group-hover:text-amber-400 group-hover:ring-amber-400/50 sm:h-10 sm:w-10">
			<PlusIcon aria-hidden className="h-5 w-5" />
		</span>
	)
	if (!labeled)
		return (
			<div aria-hidden className={box}>
				{plus}
			</div>
		)
	return (
		<Link
			to={cta.href}
			prefetch="intent"
			className={`group ${box} outline-none hover:border-amber-400/50 hover:bg-amber-400/[0.05] focus-visible:border-amber-300`}
		>
			{plus}
			<span className="text-xs font-semibold leading-tight text-gray-400 group-hover:text-gray-200">
				{cta.label}
			</span>
		</Link>
	)
}

const PILL =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-black text-gray-950 outline-none hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
const PILL_QUIET =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-gray-200 outline-none ring-1 ring-inset ring-white/15 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

/** Why a section is empty or still forming, and the way forward: the message on the left, the links on the right. */
function Strip({ strip }: { strip: StripData }) {
	return (
		<div className="mb-5 flex flex-col gap-3 rounded-xl bg-white/[0.035] px-4 py-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
			<div className="min-w-0 flex-1">
				<p className="text-sm font-bold text-white sm:text-[15px]">
					{strip.title}
				</p>
				{strip.body ? (
					<p className="mt-0.5 text-sm text-gray-400">{strip.body}</p>
				) : null}
				{strip.progress !== undefined ? (
					<RatingsBar have={strip.progress} className="mt-1.5" />
				) : null}
			</div>
			{strip.ctas.length ? (
				<div className="flex gap-2">
					{strip.ctas.map((cta, i) => (
						<Link
							key={cta.href}
							to={cta.href}
							prefetch="intent"
							className={`${i === 0 ? PILL : PILL_QUIET} max-sm:flex-1 max-sm:px-2`}
						>
							{cta.label}
							{i === 0 ? (
								<ArrowRightIcon aria-hidden className="h-4 w-4 max-sm:hidden" />
							) : null}
						</Link>
					))}
				</div>
			) : null}
		</div>
	)
}

/** "4 of 10 ratings" with a thin amber bar (a fixed width, nothing animates). */
export function RatingsBar({
	have,
	className = "",
}: { have: number; className?: string }) {
	const n = Math.min(have, PERSONAL_AT)
	return (
		<span className={`flex items-center gap-2.5 ${className}`}>
			<span
				className="block h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-white/10"
				aria-hidden
			>
				<span
					className="block h-full origin-left rounded-full bg-amber-400"
					style={{ transform: `scaleX(${n / PERSONAL_AT})` }}
				/>
			</span>
			<span className="shrink-0 text-xs font-semibold tabular-nums text-amber-300">
				{n} of {PERSONAL_AT} ratings
			</span>
		</span>
	)
}

/** A door's three first posters, small. */
function FewPosters({ titles }: { titles: DoorTitle[] }) {
	const few = titles.filter((t) => t.card.poster_path).slice(0, 3)
	if (!few.length) return null
	return (
		<span className="flex shrink-0 -space-x-2" aria-hidden>
			{few.map((t) => (
				<img
					key={t.card.key}
					src={posterUrl(t.card.poster_path, "w92")}
					alt=""
					width={32}
					height={48}
					loading="lazy"
					{...{ fetchpriority: "low" }}
					className="aspect-[2/3] w-7 rounded object-cover ring-2 ring-gray-900 sm:w-8"
				/>
			))}
		</span>
	)
}
