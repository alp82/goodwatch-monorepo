// The miniatures: each family's index page
// shrunk to a tile you can play with. Pointing at (or tapping) a place previews it in the tile; a click opens it.
//   - Tile: one miniature; its whole header row is the link to the family's index.
//   - PosterFan: a place's posters as a fan, one link to the place (never a row of separate title links).
//   - MoodLattice, EraRibbon, BestSwitcher, FlagMap (+ FlagRail), GenreShelf, ServiceRow, Occasions.
// Previews say what a place is with fingerprint words and defining tropes instead of repeating its
// name; poster groups are links to their category; the map zooms and pans; every country with a page is on it.
import type { SizeRule } from "~/utils/tmdb-image"
import { TmdbImage } from "~/ui/TmdbImage"
import { Link, useNavigate } from "@remix-run/react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { countryFlagUrl } from "~/utils/country-flag"
import type { Kind } from "~/domain/browse/address"
import type { PlaceRef, TraitWord } from "~/domain/browse/types"
import { EASE, FOCUS, poster } from "~/ui/browse/index"
import { GLIDE_T, QUICK_T } from "~/ui/browse/motion"
import { FlagShape } from "~/ui/browse/world-map/FlagShape"
import { flagBox, flagCover } from "~/ui/browse/world-map/flagBox"
import { VIEW_BOX, WORLD_SHAPES } from "~/ui/browse/world-map/shapes"
import { PhraseText } from "~/ui/browse/blend/parts"
import { phrase } from "~/domain/browse/phrase"
import type { TropeTag } from "~/server/browse/hub/hub.server"
import type { HubViewData } from "~/server/browse/hub/view-data"
import { count } from "~/domain/browse/count"
import { nice } from "~/ui/browse/hub/pieces"

const NEUTRAL = "#cbd5e1"

// ---------------------------------------------------------------------------------------------------------
// The tile

/**
 * One miniature. The whole header row (name, line, "All moods") is one link to the family's index, a shade lighter
 * than the tile so it reads as a bar you can press.
 */
export function Tile({
	title,
	href,
	line,
	children,
	className = "",
	action = "See all",
}: {
	title: string
	/** The family's index. Without it the header is a plain heading (a section with no index of its own). */
	href?: string
	line?: ReactNode
	children: ReactNode
	className?: string
	action?: string
}) {
	const inner = (
		<>
			<h2 className="font-display text-xl leading-tight font-bold tracking-tight text-white sm:text-2xl">
				{title}
				{href && (
					<span
						aria-hidden
						className={`ml-1.5 inline-block text-base text-amber-300 ${QUICK_T} group-hover/head:translate-x-0.5`}
					>
						›
					</span>
				)}
			</h2>
			{line && <p className="min-w-0 truncate text-sm text-gray-400 max-sm:hidden">{line}</p>}
			{href && (
				<span
					className={`ml-auto shrink-0 text-sm font-bold whitespace-nowrap text-amber-300 ${QUICK_T} group-hover/head:text-amber-200`}
				>
					{action}
				</span>
			)}
		</>
	)
	const head =
		"flex items-baseline gap-3 rounded-t-[1.75rem] border-b border-white/[0.06] bg-white/[0.022] px-4 py-3.5 sm:px-6 sm:py-4"
	return (
		<section
			className={`relative flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] bg-white/[0.028] ring-1 ring-white/[0.08] ${className}`}
		>
			{href ? (
				<Link
					to={href}
					prefetch="intent"
					className={`group/head ${head} ${QUICK_T} outline-none hover:bg-white/[0.055] focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset`}
				>
					{inner}
				</Link>
			) : (
				<header className={head}>{inner}</header>
			)}
			<div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">{children}</div>
		</section>
	)
}

/** Fades the new preview in (no exit: the swap keeps up with a pointer moving fast). */
function Swap({
	id,
	children,
	className = "",
}: {
	id: string
	children: ReactNode
	className?: string
}) {
	const reduce = useReducedMotion()
	// The server's first preview is shown as it is: only a change fades in.
	const first = useRef(id)
	return (
		<motion.div
			key={id}
			initial={reduce || id === first.current ? false : { opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.22, ease: EASE }}
			className={className}
		>
			{children}
		</motion.div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What a place is: words, tropes, posters

/** The fingerprint words that set a place apart, each in its family's color. */
export function Words({
	traits,
	className = "",
}: {
	traits: Pick<TraitWord, "key" | "word" | "color">[]
	className?: string
}) {
	if (!traits.length) return null
	return (
		<p className={`text-[15px] leading-snug font-semibold ${className}`}>
			{traits.map((t, i) => (
				<span key={t.key}>
					{i > 0 && <span className="text-gray-600"> · </span>}
					<span style={{ color: t.color }}>{t.word}</span>
				</span>
			))}
		</p>
	)
}

/** The tropes a place has far more often than the catalog does, each a link to its trope page. */
export function Tropes({
	tropes,
	href,
	className = "",
}: {
	tropes: TropeTag[]
	href: (slug: string) => string
	className?: string
}) {
	if (!tropes.length) return null
	return (
		<div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
			<span className="mr-0.5 text-[11px] font-bold tracking-[0.12em] text-gray-500 uppercase">
				Known for
			</span>
			{tropes.map((t) => (
				<Link
					key={t.slug}
					to={href(t.slug)}
					prefetch="intent"
					className={`rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[13px] font-semibold text-gray-100 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/[0.09] hover:ring-white/25 ${FOCUS}`}
				>
					<span
						aria-hidden
						className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full"
						style={{ background: t.hue }}
					/>
					{t.label}
				</Link>
			))}
		</div>
	)
}

const FAN = {
	sm: "w-[7.5rem]",
	md: "w-[11rem]",
	lg: "w-[14.5rem]",
	xl: "w-[17rem]",
} as const

/**
 * A place's posters as a fan: one link to the place, named for it. Pointing at it spreads the fan a little. The
 * middle poster sits on top.
 */
export function PosterFan({
	titles,
	href,
	label,
	size = "md",
	sizes,
	className = "",
}: {
	titles: HubViewData["moods"][number]["titles"]
	href: string
	label: string
	size?: keyof typeof FAN
	/** Each poster occupies 46% of this fan. */
	sizes: SizeRule[]
	className?: string
}) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, 3)
	if (!shown.length) return null
	const mid = (shown.length - 1) / 2
	return (
		<Link
			to={href}
			prefetch="intent"
			aria-label={label}
			className={`group/fan relative block aspect-[4/3] shrink-0 rounded-xl [--spread:1] hover:[--spread:1.3] focus-visible:[--spread:1.3] ${FAN[size]} ${FOCUS} ${className}`}
		>
			{shown.map((t, i) => {
				const o = i - mid
				const style: CSSProperties = {
					transform: `translateX(calc(-50% + ${o * 42}% * var(--spread))) translateY(${Math.abs(o) * 5}%) rotate(calc(${o * 7}deg * var(--spread)))`,
					zIndex: 10 - Math.abs(o) * 2,
				}
				return (
					<span
						key={t.card.key}
						className="absolute top-[4%] left-1/2 block w-[46%] origin-bottom overflow-hidden rounded-lg bg-gray-800 shadow-xl ring-1 shadow-black/50 ring-black/40 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
						style={style}
					>
						<TmdbImage
							kind="poster"
							path={t.card.poster_path}
							sizes={sizes}
							maxWidth={126}
							alt=""
							className="block aspect-[2/3] w-full object-cover"
						/>
					</span>
				)
			})}
		</Link>
	)
}

/**
 * Hover and keyboard focus make a place hot. On touch the first tap previews it in the tile and the second opens it,
 * so a phone gets the preview too.
 */
let lastPointer = "mouse"
const hot = (set: () => void, on = false) => ({
	onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && set(),
	onPointerDown: (e: React.PointerEvent) => {
		lastPointer = e.pointerType
	},
	onFocus: () => lastPointer === "mouse" && set(),
	onClick: (e: React.MouseEvent) => {
		if (lastPointer !== "mouse" && !on) {
			e.preventDefault()
			set()
		}
	},
})

// ---------------------------------------------------------------------------------------------------------
// Moods: the lattice

/** Columns from lightest to darkest, each from its calmest mood down to its most intense (no empty cells). */
function cellsOf(moods: HubViewData["moods"], cols: number) {
	const n = moods.length
	const byTone = [...moods].sort((a, b) => a.tone - b.tone || a.pace - b.pace)
	const out: { mood: HubViewData["moods"][number]; row: number; col: number }[] = []
	for (let c = 0; c < cols; c++)
		byTone
			.slice(Math.round((c * n) / cols), Math.round(((c + 1) * n) / cols))
			.sort((a, b) => a.pace - b.pace)
			.forEach((mood, row) => out.push({ mood, row, col: c }))
	return out
}

export function MoodLattice({
	moods,
	start,
	href,
	tropeHref,
}: {
	moods: HubViewData["moods"]
	start: string
	href: (p: PlaceRef) => string
	tropeHref: (slug: string) => string
}) {
	const cells = useMemo(() => cellsOf(moods, 4), [moods])
	const [slug, setSlug] = useState(start)
	const at = cells.find((c) => c.mood.place.slug === slug) ?? cells[0]
	if (!at) return null
	const m = at.mood
	const hue = m.place.hue ?? NEUTRAL
	const rows = Math.max(...cells.map((c) => c.row)) + 1
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-10">
			<div className="min-w-0">
				<div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
					<span>Lighter</span>
					<span aria-hidden className="h-px flex-1 bg-white/10" />
					<span>Darker</span>
				</div>
				<div className="flex gap-2">
					<div
						aria-hidden
						className="flex w-3 shrink-0 flex-col items-center justify-between py-1 text-[10px] font-bold tracking-[0.14em] text-gray-500 uppercase max-sm:hidden"
					>
						<span className="[writing-mode:vertical-rl] rotate-180">Calmer</span>
						<span className="w-px flex-1 bg-white/10" />
						<span className="[writing-mode:vertical-rl] rotate-180">Intense</span>
					</div>
					<ul
						aria-label="Moods, lighter to darker and calmer to more intense"
						className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 sm:gap-2"
						style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
					>
						{cells.map(({ mood, row, col }) => {
							const h = mood.place.hue ?? NEUTRAL
							const on = mood.place.slug === m.place.slug
							// How far the cell is from the one in view, 0 (it) to 1 (the far corner).
							const far = Math.min(1, Math.hypot(col - at.col, row - at.row) / 3.6)
							return (
								<li
									key={mood.place.slug}
									style={{ gridColumn: col + 1, gridRow: row + 1 }}
									className="min-w-0"
								>
									<Link
										to={href(mood.place)}
										prefetch="intent"
										{...hot(() => setSlug(mood.place.slug), on)}
										aria-current={on ? "true" : undefined}
										className={`relative flex h-full min-h-12 items-center gap-2 overflow-hidden rounded-xl px-2.5 py-2 sm:min-h-14 sm:px-3 ${GLIDE_T} ${FOCUS}`}
										style={{
											background: on
												? `color-mix(in oklab, ${h} 30%, #151b28)`
												: `color-mix(in oklab, ${h} ${Math.round(14 - far * 8)}%, #131926)`,
											boxShadow: on
												? `inset 0 0 0 1.5px ${h}`
												: `inset 0 0 0 1px color-mix(in oklab, ${h} ${Math.round(24 - far * 16)}%, transparent)`,
											opacity: on ? 1 : 1 - far * 0.5,
											filter: on ? "none" : `saturate(${1 - far * 0.6})`,
										}}
									>
										<span
											aria-hidden
											className="h-2.5 w-2.5 shrink-0 rounded-full max-sm:hidden"
											style={{ background: h }}
										/>
										<span
											className={`min-w-0 text-[12.5px] leading-[1.15] font-bold text-balance sm:text-sm ${on ? "text-white" : "text-gray-200"}`}
										>
											{mood.place.label}
										</span>
									</Link>
								</li>
							)
						})}
					</ul>
				</div>
			</div>
			<Swap id={m.place.slug} className="flex min-w-0 items-center gap-5 sm:gap-7">
				<div className="min-w-0 flex-1">
					<p className="text-[11px] font-bold tracking-[0.14em] uppercase" style={{ color: hue }}>
						{m.place.label}
					</p>
					<p className="mt-1.5 font-display text-2xl leading-tight font-bold tracking-tight text-pretty text-white sm:text-[1.7rem]">
						{m.copy?.short ?? ""}
					</p>
					<Words traits={m.traits} className="mt-3" />
					<Tropes tropes={m.tropes} href={tropeHref} className="mt-3" />
				</div>
				<PosterFan
					titles={m.titles}
					href={href(m.place)}
					label={`Open ${m.place.label}`}
					size="lg"
					sizes={[
						["(min-width: 640px)", "107px"],
						[null, "70px"],
					]}
					className="max-sm:w-[9.5rem]"
				/>
			</Swap>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Eras: a ribbon you drag

export function EraRibbon({
	decades,
	href,
	tropeHref,
}: {
	decades: HubViewData["decades"]
	href: (p: PlaceRef) => string
	tropeHref: (slug: string) => string
}) {
	const n = decades.length
	// Opens on the decade a person most often starts from: the 1990s when there is one, else the one before last.
	const first = Math.max(
		0,
		decades.findIndex((d) => d.place.slug === "1990s"),
	)
	const [i, setI] = useState(first || Math.max(0, n - 2))
	const [dragging, setDragging] = useState(false)
	const track = useRef<HTMLDivElement>(null)
	if (!n) return null
	const d = decades[i]
	const pick = (x: number) => {
		const el = track.current
		if (!el) return
		const r = el.getBoundingClientRect()
		setI(Math.max(0, Math.min(n - 1, Math.floor(((x - r.left) / r.width) * n))))
	}
	return (
		<div className="flex flex-1 flex-col">
			{/* The ribbon leads: it is the control, the decade under it follows the window. */}
			<div>
				<div
					ref={track}
					// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a drag ribbon, not a range input
					role="slider"
					tabIndex={0}
					aria-label="Decade"
					aria-valuemin={0}
					aria-valuemax={n - 1}
					aria-valuenow={i}
					aria-valuetext={d.place.label}
					onPointerDown={(e) => {
						e.currentTarget.setPointerCapture(e.pointerId)
						setDragging(true)
						pick(e.clientX)
					}}
					onPointerMove={(e) => dragging && pick(e.clientX)}
					onPointerUp={() => setDragging(false)}
					onPointerCancel={() => setDragging(false)}
					onKeyDown={(e) => {
						if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1))
						else if (e.key === "ArrowRight") setI((v) => Math.min(n - 1, v + 1))
						else return
						e.preventDefault()
					}}
					className={`relative h-12 cursor-grab touch-none rounded-2xl bg-white/[0.04] ring-1 ring-white/10 select-none active:cursor-grabbing ${FOCUS}`}
				>
					{/* The window: one decade wide, it travels to where the pointer is. */}
					<span
						aria-hidden
						className={`absolute inset-y-1 left-0 rounded-xl bg-amber-300/15 ring-2 ring-amber-300 ${dragging ? "transition-transform duration-100 ease-out" : "transition-transform duration-[380ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"}`}
						style={{ width: `${100 / n}%`, transform: `translateX(${i * 100}%)` }}
					/>
					<div
						className="relative grid h-full"
						style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
					>
						{decades.map((x, k) => (
							<span
								key={x.place.slug}
								className={`grid place-items-center font-display text-sm font-bold tabular-nums sm:text-base ${QUICK_T} ${k === i ? "text-amber-200" : "text-gray-500"}`}
							>
								<span>
									<span className="max-sm:hidden">’</span>
									{x.place.label.slice(2, 4)}
								</span>
							</span>
						))}
					</div>
				</div>
			</div>
			{/* the decade fills the tile's height, centred, with room around it. */}
			<Swap
				id={d.place.slug}
				className="flex min-w-0 flex-1 items-center gap-5 py-6 sm:gap-10 sm:px-3 sm:py-10"
			>
				<div className="min-w-0 flex-1">
					<Link
						to={href(d.place)}
						prefetch="intent"
						className={`inline-block rounded-md font-display text-6xl leading-none font-bold tracking-tight text-white tabular-nums ${QUICK_T} hover:text-amber-100 sm:text-7xl ${FOCUS}`}
					>
						{d.place.label}
					</Link>
					<p className="mt-4 line-clamp-2 text-base leading-snug text-pretty text-gray-300">
						{d.copy?.short ?? ""}
					</p>
					<Words traits={d.traits} className="mt-3" />
					{d.rose && d.rose.length > 0 && (
						<p className="mt-3 text-sm text-gray-400">
							More{" "}
							{d.rose.slice(0, 2).map((r, k) => (
								<span key={r.label}>
									{k > 0 && " and "}
									<span className="font-semibold" style={{ color: r.hue ?? "#e5e7eb" }}>
										{r.label.toLowerCase()}
									</span>
								</span>
							))}{" "}
							than the decade before
						</p>
					)}
					<Tropes tropes={d.tropes} href={tropeHref} className="mt-4" />
				</div>
				<PosterFan
					titles={d.titles}
					href={href(d.place)}
					label={`Open the ${d.place.label}`}
					size="xl"
					sizes={[
						["(min-width: 1024px)", "125px"],
						["(min-width: 640px)", "81px"],
						[null, "63px"],
					]}
					className="max-sm:w-[8.5rem] sm:max-lg:w-[11rem]"
				/>
			</Swap>
			<p className="text-sm text-gray-500 max-sm:hidden">
				Drag the window along the years, or use the arrow keys
			</p>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Best: several best-of lists, one after another

const DWELL_MS = 7000

/**
 * the list's own title is the only row. Its key word ("cozy", "’70s") is underlined by the progress line,
 * which starts filling at once; when it's full the next list from a large pool slides in, and it keeps going. Pointing
 * at the tile (or focusing into it) pauses it; nothing else does, and there's no pause button. The fill runs in one
 * frame loop that writes the line's scale, so nothing re-renders while it fills.
 */
export function BestSwitcher({
	lists,
	href,
}: {
	lists: HubViewData["lists"]
	href: (l: HubViewData["lists"][number]) => string
}) {
	const reduce = useReducedMotion()
	const [i, setI] = useState(0)
	const [hovered, setHovered] = useState(false)
	const fill = useRef<HTMLSpanElement>(null)
	const elapsed = useRef(0)
	// it always runs from the first frame and on through every list; only a mouse resting on it pauses it.
	const running = lists.length > 1 && !hovered
	useEffect(() => {
		if (!running) return
		let last = performance.now()
		let frame = 0
		const tick = (now: number) => {
			// A hidden tab doesn't count down.
			if (document.visibilityState === "visible") elapsed.current += Math.min(100, now - last)
			last = now
			const p = Math.min(1, elapsed.current / DWELL_MS)
			// The ref follows the list in view (the next one mounts after the old one fades out).
			if (fill.current) fill.current.style.transform = `scaleX(${p})`
			if (p >= 1) {
				elapsed.current = 0
				setI((v) => (v + 1) % lists.length)
			}
			frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [running, lists.length])
	// the underlined key word is the "next" control: a click (or Enter/Space) moves on at once and the line
	// starts over.
	const next = () => {
		elapsed.current = 0
		if (fill.current) fill.current.style.transform = "scaleX(0)"
		setI((v) => (v + 1) % lists.length)
	}
	const l = lists[i] ?? lists[0]
	if (!l) return null
	const following = lists[(i + 1) % lists.length]
	const at = l.q.indexOf(l.key)
	const before = at >= 0 ? l.q.slice(0, at) : l.q
	const after = at >= 0 ? l.q.slice(at + l.key.length) : ""
	return (
		<div
			className="flex flex-1 flex-col"
			onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
			onPointerLeave={() => setHovered(false)}
		>
			<div className="relative flex-1">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={l.id}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={{ duration: reduce ? 0 : 0.28, ease: EASE }}
					>
						<div className="flex items-baseline justify-between gap-3">
							<p
								className="font-display text-lg leading-snug font-bold text-white sm:text-xl"
								aria-live="polite"
							>
								{before}
								{at >= 0 && (
									<button
										type="button"
										onClick={next}
										disabled={lists.length < 2}
										title={following ? `Next: ${following.q}` : undefined}
										aria-label={following ? `${l.key}. Next list: ${following.q}` : l.key}
										className={`relative inline-block cursor-pointer rounded-sm text-amber-200 enabled:hover:text-amber-100 disabled:cursor-default ${QUICK_T} ${FOCUS}`}
									>
										{l.key}
										<span
											aria-hidden
											className="absolute inset-x-0 -bottom-1 block h-[3px] overflow-hidden rounded-full bg-white/15"
										>
											<span
												ref={fill}
												className="absolute inset-0 origin-left rounded-full bg-amber-300"
												style={{ transform: lists.length > 1 ? "scaleX(0)" : "scaleX(1)" }}
											/>
										</span>
										<span
											aria-hidden
											className="ml-1 inline-block align-middle text-xs text-amber-300/60"
										>
											›
										</span>
									</button>
								)}
								{after}
							</p>
							<Link
								to={href(l)}
								prefetch="intent"
								className={`shrink-0 rounded-sm text-sm font-bold whitespace-nowrap text-amber-300 hover:text-amber-200 ${FOCUS}`}
							>
								The list ›
							</Link>
						</div>
						<ol className="mt-4 space-y-1">
							{l.rows.map((r, k) => (
								<BestLine key={r.title.card.key} row={r} place={k + 1} lead={k === 0} />
							))}
						</ol>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}

function BestLine({
	row,
	place,
	lead,
}: {
	row: HubViewData["lists"][number]["rows"][number]
	place: number
	lead: boolean
}) {
	const c = row.title.card
	return (
		<li>
			<Link
				to={row.title.to}
				prefetch="intent"
				className={`group flex items-center gap-3 rounded-xl py-1.5 pr-2 ${QUICK_T} hover:bg-white/[0.04] ${FOCUS}`}
			>
				<span
					className={`w-7 shrink-0 text-right font-display leading-none font-bold tabular-nums ${lead ? "text-3xl text-amber-200" : "text-2xl text-white/30"}`}
				>
					{place}
				</span>
				<span
					className={`block shrink-0 overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10 ${QUICK_T} group-hover:-translate-y-0.5 ${lead ? "w-14" : "w-9"}`}
				>
					{c.poster_path && (
						<TmdbImage
							kind="poster"
							path={c.poster_path}
							width={lead ? 56 : 36}
							alt=""
							className="block aspect-[2/3] w-full object-cover"
						/>
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span
						className={`line-clamp-1 block font-bold text-gray-100 group-hover:text-amber-200 ${lead ? "text-lg" : ""}`}
					>
						{c.title}
					</span>
					<span className="block text-xs text-gray-500 tabular-nums">
						{c.release_year}
						{row.genres.length > 0 && ` · ${row.genres.slice(0, 2).join(", ")}`}
					</span>
				</span>
			</Link>
		</li>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Places: the map, every country with a page wearing its flag; zoom and pan

const SHAPES = new Map(WORLD_SHAPES.filter((s) => s.code).map((s) => [s.code, s]))
const [VX0, VY0, VX1, VY1] = VIEW_BOX.world
// The whole world (the map is taller and its box never changes size; the frame's aspect is this view's).
const FULL = { x: VX0, y: VY0, w: VX1 - VX0, h: VY1 - VY0 }
const MAX_ZOOM = 8
type View = typeof FULL

const clampView = (v: View): View => {
	const w = Math.min(FULL.w, Math.max(FULL.w / MAX_ZOOM, v.w))
	const h = (w / FULL.w) * FULL.h
	return {
		w,
		h,
		x: Math.min(FULL.x + FULL.w - w, Math.max(FULL.x, v.x)),
		y: Math.min(FULL.y + FULL.h - h, Math.max(FULL.y, v.y)),
	}
}
/** The view scaled by `k` (below 1 zooms in) around a point in map units. */
const zoomAt = (v: View, k: number, px: number, py: number): View =>
	clampView({ x: px - (px - v.x) * k, y: py - (py - v.y) * k, w: v.w * k, h: v.h * k })

const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * panning and zooming never re-render React. The live view sits in a ref and is written straight to the
 * svg's viewBox in the next frame; React's state catches up once, when a gesture or glide ends (for the zoom buttons'
 * state and the marker's size). Before, every pointer move re-rendered all the shapes and flags, which lagged.
 */
function useMapView(svg: React.RefObject<SVGSVGElement>) {
	const [view, setView] = useState<View>(FULL)
	const live = useRef(view)
	const anim = useRef(0)
	const paint = useRef(0)
	const settle = useRef<ReturnType<typeof setTimeout>>()
	const reduce = useReducedMotion()
	const write = useCallback(
		(v: View) => {
			live.current = v
			cancelAnimationFrame(paint.current)
			paint.current = requestAnimationFrame(() => {
				svg.current?.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`)
			})
		},
		[svg],
	)
	/** React's copy catches up a moment after the last move. */
	const commit = useCallback((delay = 120) => {
		clearTimeout(settle.current)
		settle.current = setTimeout(() => setView({ ...live.current }), delay)
	}, [])
	/** Glides to a view (buttons, double-click, reset, the rail). */
	const glide = useCallback(
		(to: View) => {
			cancelAnimationFrame(anim.current)
			aim.current = null
			const from = live.current
			const target = clampView(to)
			if (reduce) {
				write(target)
				return commit(0)
			}
			const t0 = performance.now()
			const step = (now: number) => {
				const t = Math.min(1, (now - t0) / 420)
				const e = easeOut(t)
				write({
					x: from.x + (target.x - from.x) * e,
					y: from.y + (target.y - from.y) * e,
					w: from.w + (target.w - from.w) * e,
					h: from.h + (target.h - from.h) * e,
				})
				if (t < 1) anim.current = requestAnimationFrame(step)
				else commit(0)
			}
			anim.current = requestAnimationFrame(step)
		},
		[reduce, write, commit],
	)
	/** Follows a finger exactly. */
	const jump = useCallback(
		(to: View) => {
			cancelAnimationFrame(anim.current)
			aim.current = null
			write(clampView(to))
			commit()
		},
		[write, commit],
	)
	// the wheel eases toward where it's heading (about 180 ms to settle) instead of stepping. Each wheel event
	// moves the aim; one frame loop chases it, so fast notches pile up into one smooth zoom.
	const aim = useRef<View | null>(null)
	const chase = useCallback(
		(to: View) => {
			const target = clampView(to)
			if (reduce) {
				aim.current = null
				write(target)
				return commit()
			}
			const running = aim.current !== null
			aim.current = target
			if (running) return
			cancelAnimationFrame(anim.current)
			let last = performance.now()
			const step = (now: number) => {
				const goal = aim.current
				if (!goal) return
				// Frame-rate independent smoothing: ~95% of the way in 180 ms.
				const k = 1 - Math.exp(-(now - last) / 60)
				last = now
				const v = live.current
				const next = {
					x: v.x + (goal.x - v.x) * k,
					y: v.y + (goal.y - v.y) * k,
					w: v.w + (goal.w - v.w) * k,
					h: v.h + (goal.h - v.h) * k,
				}
				if (
					Math.abs(goal.w - next.w) < goal.w * 0.002 &&
					Math.abs(goal.x - next.x) < goal.w * 0.002
				) {
					write(goal)
					aim.current = null
					commit()
					return
				}
				write(next)
				anim.current = requestAnimationFrame(step)
			}
			anim.current = requestAnimationFrame(step)
		},
		[reduce, write, commit],
	)
	/** Where the wheel is heading (the aim while a zoom is still easing in). */
	const heading = useCallback(() => aim.current ?? live.current, [])
	useEffect(
		() => () => {
			cancelAnimationFrame(anim.current)
			cancelAnimationFrame(paint.current)
			clearTimeout(settle.current)
		},
		[],
	)
	return { view, live, glide, jump, chase, heading }
}

export function FlagMap({
	countries,
	mapped,
	href,
	tropeHref,
}: {
	countries: HubViewData["countries"]
	mapped: string[]
	href: (p: PlaceRef) => string
	tropeHref: (slug: string) => string
}) {
	const navigate = useNavigate()
	const [code, setCode] = useState(countries[0]?.place.code ?? "")
	const c = countries.find((x) => x.place.code === code) ?? countries[0]
	const lit = useMemo(() => new Set(mapped), [mapped])
	const svg = useRef<SVGSVGElement>(null)
	const { view, live, glide, jump, chase, heading } = useMapView(svg)
	// once the map is engaged (pressed, or its zoom used), the plain wheel zooms it too, like a maps embed.
	// Ctrl, ⌘ or Alt with the wheel zoom any time; some browsers keep Ctrl+wheel for their own page zoom.
	const engaged = useRef(false)
	const pointers = useRef(new Map<number, { x: number; y: number }>())
	const gesture = useRef<{ moved: boolean; pinch?: number } | null>(null)
	const [hint, setHint] = useState(false)
	const hintTimer = useRef<ReturnType<typeof setTimeout>>()
	const zoomed = view.w < FULL.w - 0.5

	/** A screen point in map units. */
	const toMap = (cx: number, cy: number) => {
		const el = svg.current
		const v = live.current
		if (!el) return { x: v.x + v.w / 2, y: v.y + v.h / 2 }
		const r = el.getBoundingClientRect()
		return { x: v.x + ((cx - r.left) / r.width) * v.w, y: v.y + ((cy - r.top) / r.height) * v.h }
	}

	// The wheel zooms only with Ctrl or Cmd held (a trackpad pinch sends that too): plain scrolling scrolls the page.
	useEffect(() => {
		const el = svg.current
		if (!el) return
		const onWheel = (e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey && !e.altKey && !engaged.current) {
				clearTimeout(hintTimer.current)
				setHint(true)
				hintTimer.current = setTimeout(() => setHint(false), 1400)
				return
			}
			e.preventDefault()
			const p = toMap(e.clientX, e.clientY)
			chase(zoomAt(heading(), Math.exp(e.deltaY * 0.0045), p.x, p.y))
		}
		// Leaving the map lets the wheel scroll the page again.
		const onLeave = () => {
			engaged.current = false
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		el.addEventListener("pointerleave", onLeave)
		return () => {
			el.removeEventListener("wheel", onWheel)
			el.removeEventListener("pointerleave", onLeave)
			clearTimeout(hintTimer.current)
		}
	})

	const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
		engaged.current = true
		setHint(false)
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
		if (pointers.current.size === 1) gesture.current = { moved: false }
		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()]
			gesture.current = { moved: true, pinch: Math.hypot(a.x - b.x, a.y - b.y) }
			e.currentTarget.setPointerCapture(e.pointerId)
		}
	}
	const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
		const before = pointers.current.get(e.pointerId)
		if (!before || !gesture.current) return
		const el = svg.current
		if (!el) return
		const r = el.getBoundingClientRect()
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
		if (pointers.current.size === 2 && gesture.current.pinch) {
			const [a, b] = [...pointers.current.values()]
			const dist = Math.hypot(a.x - b.x, a.y - b.y)
			const mid = toMap((a.x + b.x) / 2, (a.y + b.y) / 2)
			jump(zoomAt(live.current, gesture.current.pinch / Math.max(1, dist), mid.x, mid.y))
			gesture.current.pinch = dist
			return
		}
		const dx = e.clientX - before.x
		const dy = e.clientY - before.y
		if (!gesture.current.moved && Math.hypot(dx, dy) < 4) return
		if (!gesture.current.moved) {
			gesture.current.moved = true
			e.currentTarget.setPointerCapture(e.pointerId)
		}
		const v = live.current
		jump({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h })
	}
	const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
		pointers.current.delete(e.pointerId)
		if (pointers.current.size === 0) {
			// Clear after the click that follows this pointerup has seen whether it was a drag.
			const g = gesture.current
			setTimeout(() => {
				if (gesture.current === g) gesture.current = null
			}, 0)
		}
	}
	const pressCountry = (k: string) => {
		if (gesture.current?.moved) return
		const hit = countries.find((x) => x.place.code === k)
		if (!hit) return
		// Mouse: the hover already previewed it, a click opens. Touch: the first tap previews, the second opens.
		if (lastPointer === "mouse" || k === code) navigate(href(hit.place))
		else setCode(k)
	}
	const zoomBy = (k: number) => {
		engaged.current = true
		const v = live.current
		glide(zoomAt(v, k, v.x + v.w / 2, v.y + v.h / 2))
	}
	/**
	 * a country picked or pointed at in the rail flies the map to its region: the country with its
	 * surroundings (about four times its size, never closer than a sixth of the world).
	 */
	const reveal = (k: string) => {
		const sh = SHAPES.get(k)
		if (!sh) return
		const [x0, y0, x1, y1] = sh.box
		const w = Math.max(
			FULL.w / 6,
			Math.min(FULL.w, Math.max(x1 - x0, ((y1 - y0) * FULL.w) / FULL.h) * 4),
		)
		const h = (w / FULL.w) * FULL.h
		glide({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h })
	}
	if (!c) return null
	const scale = view.w / FULL.w
	const s = c.place.code ? SHAPES.get(c.place.code) : undefined
	return (
		<div className="min-w-0">
			{/* no layout shift. The map's frame takes its height from its width (the view's aspect), and the preview
			    beside it is laid over its cell, so what it shows never changes the tile's height. */}
			<div className="grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)] lg:gap-8">
				<div
					className="relative min-w-0 overflow-hidden rounded-2xl bg-[#0f1420] ring-1 ring-white/[0.06]"
					style={{ aspectRatio: `${FULL.w} / ${FULL.h}` }}
				>
					{/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a pan and zoom surface; the + and - buttons and the rail do the same by keyboard */}
					<svg
						ref={svg}
						viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
						className={`absolute inset-0 block h-full w-full select-none ${zoomed ? "cursor-grab touch-none active:cursor-grabbing" : "touch-pan-y"}`}
						role="application"
						aria-roledescription="map"
						aria-label="World map: every country with a page wears its flag. Drag to pan, double-click to zoom."
						onPointerDown={onDown}
						onPointerMove={onMove}
						onPointerUp={onUp}
						onPointerCancel={onUp}
						onDoubleClick={(e) => {
							const p = toMap(e.clientX, e.clientY)
							glide(zoomAt(live.current, 0.5, p.x, p.y))
						}}
					>
						<defs>
							{mapped.map((k) => {
								const sh = SHAPES.get(k)
								if (!sh) return null
								return (
									<g key={k}>
										<path id={`mini-outline-${k}`} d={sh.d} vectorEffect="non-scaling-stroke" />
										<clipPath id={`mini-land-${k}`}>
											<use href={`#mini-outline-${k}`} />
										</clipPath>
									</g>
								)
							})}
						</defs>
						{WORLD_SHAPES.map((sh, k) =>
							sh.d && !lit.has(sh.code) ? (
								<path
									key={sh.code || k}
									d={sh.d}
									fill="#232b3a"
									stroke="#0f1420"
									strokeWidth={0.6}
									vectorEffect="non-scaling-stroke"
								/>
							) : null,
						)}
						{mapped.map((k) => {
							const sh = SHAPES.get(k)
							if (!sh) return null
							const on = k === c.place.code
							const fb = flagBox(sh)
							return (
								// oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- the rail under the map is the keyboard way in
								<g
									key={k}
									onPointerEnter={(e) => e.pointerType === "mouse" && setCode(k)}
									onClick={() => pressCountry(k)}
									className="group cursor-pointer"
								>
									<g clipPath={`url(#mini-land-${k})`}>
										{/* Far-off parts outside the flag's box (Alaska) stay land-colored, not a repeat of the flag. */}
										<use href={`#mini-outline-${k}`} fill="#3a4354" />
										{/* hinted at rest, almost full under the pointer, full when picked. */}
										<image
											href={countryFlagUrl(k)}
											{...flagCover(fb[0], fb[1], fb[2] - fb[0], fb[3] - fb[1])}
											preserveAspectRatio="none"
											className={`${GLIDE_T} ${on ? "opacity-100" : "opacity-40 saturate-[0.25] group-hover:opacity-90 group-hover:saturate-[0.9]"}`}
										/>
									</g>
									<use
										href={`#mini-outline-${k}`}
										fill="none"
										stroke={on ? "#fff" : "#0f1420"}
										strokeWidth={on ? 1.6 : 0.6}
										vectorEffect="non-scaling-stroke"
									/>
								</g>
							)
						})}
						{/* Where the country in view is, even when it is small on the map. */}
						{s && (
							<g pointerEvents="none">
								<circle
									cx={s.at[0]}
									cy={s.at[1]}
									r={8 * scale}
									fill="none"
									stroke="#fcd34d"
									strokeWidth={1.2}
									vectorEffect="non-scaling-stroke"
									className="animate-ping motion-reduce:animate-none"
									style={{
										transformBox: "fill-box",
										transformOrigin: "center",
										animationDuration: "1.8s",
									}}
								/>
								<circle
									cx={s.at[0]}
									cy={s.at[1]}
									r={2.6 * scale}
									fill="#fcd34d"
									stroke="#131926"
									strokeWidth={0.8}
									vectorEffect="non-scaling-stroke"
								/>
							</g>
						)}
					</svg>
					<div className="absolute right-2.5 bottom-2.5 flex flex-col overflow-hidden rounded-xl bg-[#131926]/90 ring-1 ring-white/10 backdrop-blur">
						{[
							{
								label: "Zoom in",
								text: "+",
								on: () => zoomBy(0.6),
								off: view.w <= FULL.w / MAX_ZOOM + 0.5,
							},
							{ label: "Zoom out", text: "−", on: () => zoomBy(1 / 0.6), off: !zoomed },
						].map((b) => (
							<button
								key={b.label}
								type="button"
								aria-label={b.label}
								disabled={b.off}
								onClick={b.on}
								className={`grid h-9 w-9 place-items-center text-lg font-bold text-gray-200 ${QUICK_T} hover:bg-white/10 disabled:text-gray-600 disabled:hover:bg-transparent ${FOCUS}`}
							>
								{b.text}
							</button>
						))}
					</div>
					<div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
						{zoomed ? (
							<button
								type="button"
								onClick={() => glide(FULL)}
								className={`pointer-events-auto rounded-full bg-[#131926]/90 px-3 py-1.5 text-xs font-bold text-gray-200 ring-1 ring-white/10 backdrop-blur ${QUICK_T} hover:bg-white/10 ${FOCUS}`}
							>
								Whole world
							</button>
						) : (
							<span
								className={`rounded-full bg-[#131926]/80 px-3 py-1.5 text-xs text-gray-400 ${QUICK_T}`}
							>
								<span className="max-sm:hidden">Click the map, then scroll to zoom</span>
								<span className="sm:hidden">Pinch or tap + to zoom</span>
							</span>
						)}
					</div>
					<div
						aria-hidden
						className={`pointer-events-none absolute inset-0 grid place-items-center ${QUICK_T} ${hint ? "opacity-100" : "opacity-0"}`}
					>
						<span className="rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white">
							Click the map first, then scroll to zoom
						</span>
					</div>
				</div>
				<div className="relative min-w-0 max-lg:min-h-[23rem]">
					<Swap
						id={c.place.slug}
						className="flex min-w-0 flex-col justify-center overflow-hidden lg:absolute lg:inset-0"
					>
						<div className="flex items-center gap-4">
							<span className="grid h-16 w-16 shrink-0 place-items-center">
								<FlagShape code={c.place.code ?? ""} size={60} />
							</span>
							<Link
								to={href(c.place)}
								prefetch="intent"
								className={`min-w-0 rounded-md font-display text-3xl leading-none font-bold tracking-tight text-white ${QUICK_T} hover:text-amber-100 ${FOCUS}`}
							>
								{nice(c.place)}
							</Link>
						</div>
						<p className="mt-3 line-clamp-2 text-[15px] leading-snug text-pretty text-gray-300">
							{c.copy?.short ?? ""}
						</p>
						<Words traits={c.traits} className="mt-3" />
						<Tropes tropes={c.tropes.slice(0, 2)} href={tropeHref} className="mt-3" />
						<PosterFan
							titles={c.titles}
							href={href(c.place)}
							label={`Open ${nice(c.place)}`}
							size="lg"
							sizes={[
								["(min-width: 640px)", "107px"],
								[null, "81px"],
							]}
							className="mt-4 max-sm:w-[11rem]"
						/>
					</Swap>
				</div>
			</div>
			<FlagRail
				countries={countries}
				code={c.place.code ?? ""}
				href={href}
				onPick={(k) => {
					setCode(k)
					reveal(k)
				}}
			/>
		</div>
	)
}

/** Every country with a page as its flag shape, the full width of the tile, with arrows you can see. */
function FlagRail({
	countries,
	code,
	href,
	onPick,
}: {
	countries: HubViewData["countries"]
	code: string
	href: (p: PlaceRef) => string
	onPick: (code: string) => void
}) {
	const ref = useRef<HTMLDivElement>(null)
	const [edges, setEdges] = useState({ start: true, end: false })
	const measure = useCallback(() => {
		const el = ref.current
		if (!el) return
		setEdges({
			start: el.scrollLeft <= 2,
			end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
		})
	}, [])
	useEffect(() => {
		measure()
		const el = ref.current
		if (!el) return
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [measure])
	const by = (dir: number) => {
		const el = ref.current
		if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" })
	}
	const arrow = (dir: -1 | 1, off: boolean) => (
		<button
			type="button"
			aria-label={dir < 0 ? "Earlier countries" : "More countries"}
			disabled={off}
			onClick={() => by(dir)}
			className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg font-bold text-gray-100 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/[0.12] disabled:opacity-30 disabled:hover:bg-white/[0.06] ${FOCUS}`}
		>
			<span aria-hidden>{dir < 0 ? "‹" : "›"}</span>
		</button>
	)
	return (
		<div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4">
			{arrow(-1, edges.start)}
			<div
				ref={ref}
				onScroll={measure}
				className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto scroll-smooth [scrollbar-width:none]"
			>
				{countries.map((x) => {
					const k = x.place.code ?? ""
					const on = k === code
					return (
						<Link
							key={x.place.slug}
							to={href(x.place)}
							prefetch="intent"
							{...hot(() => onPick(k), on)}
							aria-current={on ? "true" : undefined}
							className={`group flex w-[5rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center ${QUICK_T} ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"} ${FOCUS}`}
						>
							<span className="grid h-9 place-items-center">
								<FlagShape code={k} size={34} state={on ? "on" : "hint"} />
							</span>
							<span
								className={`line-clamp-2 text-[11.5px] leading-tight font-semibold ${on ? "text-white" : "text-gray-400"}`}
							>
								{nice(x.place)}
							</span>
						</Link>
					)
				})}
			</div>
			{arrow(1, edges.end)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Genres: pick a genre, see the kinds inside it

export function GenreShelf({
	genres,
	kind,
	href,
	kindHref,
	tropeHref,
}: {
	genres: HubViewData["genres"]
	kind: Kind
	href: (p: PlaceRef) => string
	kindHref: (p: PlaceRef, id: string) => string
	tropeHref: (slug: string) => string
}) {
	const [slug, setSlug] = useState(genres[0]?.place.slug ?? "")
	const intent = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(intent.current), [])
	const g = genres.find((x) => x.place.slug === slug) ?? genres[0]
	if (!g) return null
	const noun = kind === "show" ? "shows" : kind === "all" ? "titles" : "movies"
	const pick = (s: string) => {
		clearTimeout(intent.current)
		setSlug(s)
	}
	return (
		<div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-8">
			{/* The genres: a sideways row of pills on a phone, a two-column list beside the kinds on a wide screen. */}
			<div
				role="tablist"
				aria-label="Genres"
				className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-x-2 lg:gap-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
			>
				{genres.map((x) => {
					const on = x.place.slug === g.place.slug
					return (
						<button
							key={x.place.slug}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => pick(x.place.slug)}
							onPointerEnter={(e) => {
								if (e.pointerType !== "mouse") return
								clearTimeout(intent.current)
								intent.current = setTimeout(() => setSlug(x.place.slug), 90)
							}}
							onPointerLeave={() => clearTimeout(intent.current)}
							className={`group/g relative flex shrink-0 items-center gap-3 rounded-full px-3.5 py-2 text-left whitespace-nowrap ${QUICK_T} lg:rounded-lg lg:px-3 lg:py-1.5 ${on ? "bg-amber-300/[0.13] text-amber-100 ring-1 ring-amber-300/40 lg:ring-0" : "bg-white/[0.04] text-gray-300 ring-1 ring-white/[0.06] hover:bg-white/[0.07] hover:text-white lg:bg-transparent lg:ring-0"} ${FOCUS}`}
						>
							<span
								aria-hidden
								className={`absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-amber-300 max-lg:hidden ${QUICK_T} ${on ? "opacity-100" : "opacity-0"}`}
							/>
							<span className="text-[14.5px] font-bold">{x.place.label}</span>
							{/* the list is names only (the colored words were too much here). */}
						</button>
					)
				})}
			</div>
			{/* a fixed frame. On a wide screen the preview fills the list's height (laid over its cell); on a phone
			    it has a fixed minimum. The kinds sit at the bottom either way, so nothing jumps between genres. */}
			<div className="relative flex min-w-0 max-lg:min-h-[36rem]">
				<Swap id={g.place.slug} className="flex min-w-0 flex-1 flex-col lg:absolute lg:inset-0">
					<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
						<Link
							to={href(g.place)}
							prefetch="intent"
							className={`rounded-md font-display text-3xl leading-none font-bold tracking-tight text-white ${QUICK_T} hover:text-amber-100 ${FOCUS}`}
						>
							{g.place.label}
						</Link>
						<Link
							to={href(g.place)}
							prefetch="intent"
							className={`rounded-sm text-sm font-bold text-amber-300 hover:text-amber-200 ${FOCUS}`}
						>
							All{" "}
							{g.place.label === "TV Movie"
								? "TV movies"
								: `${g.place.label.toLowerCase()} ${noun}`}{" "}
							›
						</Link>
					</div>
					<p className="mt-2 line-clamp-2 text-[15px] leading-snug text-pretty text-gray-300">
						{g.copy?.short ?? ""}
					</p>
					<Words traits={g.traits} className="mt-2" />
					<Tropes tropes={g.tropes.slice(0, 2)} href={tropeHref} className="mt-3" />
					{g.kindsOf.length > 0 && (
						<div className="mt-auto pt-6">
							<p className="text-[11px] font-bold tracking-[0.14em] text-gray-500 uppercase">
								The kinds inside it
							</p>
							<ul className="mt-2 grid gap-2 sm:grid-cols-2">
								{g.kindsOf.map((k) => (
									<li key={k.id}>
										<Link
											to={kindHref(g.place, k.id)}
											prefetch="intent"
											className={`group flex items-center gap-3 rounded-2xl bg-white/[0.03] p-2 pr-4 ring-1 ring-white/[0.07] ${QUICK_T} hover:bg-white/[0.06] hover:ring-white/20 ${FOCUS}`}
										>
											<KindStack titles={k.titles} />
											<span className="min-w-0 flex-1">
												<span className="block leading-tight font-bold text-gray-100 group-hover:text-white">
													{k.name}
												</span>
												<Words traits={k.traits} className="mt-1 text-[13px]" />
											</span>
											<span
												aria-hidden
												className={`text-amber-300 ${QUICK_T} group-hover:translate-x-0.5`}
											>
												›
											</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					)}
				</Swap>
			</div>
		</div>
	)
}

/** A kind's posters stacked, offset, inside its link (decoration of the kind, not links of their own). */
function KindStack({ titles }: { titles: HubViewData["moods"][number]["titles"] }) {
	const shown = titles.filter((t) => t.card.poster_path).slice(0, 3)
	return (
		<span aria-hidden className="relative block h-[4.5rem] w-[5.25rem] shrink-0">
			{shown.map((t, i) => (
				<span
					key={t.card.key}
					className={`absolute top-0 block w-12 overflow-hidden rounded-md bg-gray-800 shadow-lg ring-1 shadow-black/40 ring-black/40 ${QUICK_T}`}
					style={{
						left: `${i * 0.9}rem`,
						zIndex: 3 - i,
						transform: `rotate(${(i - 1) * 4}deg)`,
					}}
				>
					<TmdbImage
						kind="poster"
						path={t.card.poster_path}
						width={48}
						alt=""
						className="block aspect-[2/3] w-full object-cover"
					/>
				</span>
			))}
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Streaming: the services, laid out

export function ServiceRow({
	services,
	kind,
	href,
}: {
	services: HubViewData["services"]
	kind: Kind
	href: (p: PlaceRef) => string
}) {
	const noun = kind === "show" ? "shows" : kind === "all" ? "titles" : "movies"
	const many = (n: number) => `${count(n)} ${noun}`
	return (
		<ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
			{services.map((s) => (
				<li key={s.place.slug} className="min-w-0">
					<Link
						to={href(s.place)}
						prefetch="intent"
						className={`group relative isolate flex h-full items-center gap-3 overflow-hidden rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.07] ${QUICK_T} hover:bg-white/[0.06] hover:ring-white/20 sm:p-4 ${FOCUS}`}
					>
						{s.place.logo && (
							<img
								src={poster(s.place.logo, "w154")}
								alt=""
								loading="lazy"
								className={`h-12 w-12 shrink-0 rounded-[24%] ring-1 ring-white/15 ${QUICK_T} group-hover:scale-105 sm:h-14 sm:w-14`}
							/>
						)}
						<span className="min-w-0 flex-1">
							<span className="line-clamp-1 block font-bold text-gray-100 group-hover:text-white">
								{s.place.label}
							</span>
							<span className="block text-xs text-gray-500 tabular-nums">{many(s.count)}</span>
						</span>
						<KindStack titles={s.titles} />
					</Link>
				</li>
			))}
		</ul>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The night you're having

export function Occasions({
	occasions,
	kind,
	href,
}: {
	occasions: HubViewData["occasions"]
	kind: Kind
	href: (parts: PlaceRef[]) => string
}) {
	return (
		<ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
			{occasions.map((o) => {
				const hue = o.parts.find((p) => p.hue)?.hue ?? "#94a3b8"
				return (
					<li key={o.name} className="w-[80%] shrink-0 snap-start sm:w-auto">
						<Link
							to={href(o.parts)}
							prefetch="intent"
							className={`group flex h-full items-center gap-4 rounded-2xl p-4 ring-1 ring-white/[0.08] ${QUICK_T} hover:ring-white/25 sm:p-5 ${FOCUS}`}
							style={{
								background: `linear-gradient(135deg, color-mix(in oklab, ${hue} 16%, #151b28) 0%, #141a26 70%)`,
							}}
						>
							<span className="min-w-0 flex-1">
								<span className="block font-display text-xl leading-tight font-bold tracking-tight text-white">
									{o.name}
								</span>
								<span className="mt-1 block text-sm leading-snug text-pretty text-gray-300">
									{o.line}
								</span>
								<span className="mt-3 block text-[13px] font-semibold text-gray-200">
									<PhraseText segs={phrase(kind, o.parts)} />
									<span
										aria-hidden
										className={`ml-1 inline-block text-amber-300 ${QUICK_T} group-hover:translate-x-0.5`}
									>
										›
									</span>
								</span>
							</span>
							<KindStack titles={o.titles} />
						</Link>
					</li>
				)
			})}
		</ul>
	)
}
