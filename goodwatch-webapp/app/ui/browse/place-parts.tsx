// The pieces every place page shares (moods, genres, eras, countries, services). Each one says in its comment what it means to someone choosing a thing to watch.
import { PeekCard } from "~/ui/browse/cards/PeekCard"
import {
	ArrowTrendingDownIcon,
	ArrowTrendingUpIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/20/solid"
import { Link, useNavigate } from "@remix-run/react"
import { motion } from "framer-motion"
import {
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { CAPTION, Kicker } from "~/ui/eyebrow"
import { useMenu } from "~/ui/filter-bar/controls"
import { MENU, SHELL, TAP } from "~/ui/filter-bar/motion"
import { PageTitle, SectionHeading } from "~/ui/heading"
import { RowArrows, StepButton, useStepRow } from "~/ui/row-arrows"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { PlaceRef, ShowTitle, TraitWord as Trait } from "~/domain/browse/types"
import {
	PANEL,
	PlaceMark,
	PosterTrio,
	ShowMark,
	Thumb,
	TraitWord,
	WRAP,
	isMixed,
	poster,
} from "~/ui/browse/index"
import type { EraCard, KindLink } from "~/server/browse/place-data.server"

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** A genre's or mood's name inside a sentence: "science fiction", "TV movies". */
export const lower = (label: string) => (label === "TV Movie" ? "TV movies" : label.toLowerCase())

const RING = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** A module's heading. With `to` the heading is the link to the room it previews. */
export function ModuleHead({
	title,
	to,
	line,
	aside,
	id,
}: {
	title: string
	to?: string
	line?: ReactNode
	aside?: ReactNode
	id?: string
}) {
	const head = (
		<>
			<SectionHeading id={id} className={to ? "transition-colors group-hover:text-amber-200" : ""}>
				{title}
				{to && (
					<span
						aria-hidden
						className="ml-1.5 inline-block text-amber-300 transition-transform duration-200 group-hover:translate-x-1"
					>
						›
					</span>
				)}
			</SectionHeading>
			{line && <p className="mt-1 max-w-2xl text-[15px] leading-snug text-gray-400">{line}</p>}
		</>
	)
	return (
		<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
			{to ? (
				<Link to={to} prefetch="intent" className={`group min-w-0 flex-1 rounded-sm ${RING}`}>
					{head}
				</Link>
			) : (
				<div className="min-w-0 flex-1">{head}</div>
			)}
			{aside}
		</div>
	)
}

/** A quiet link onward: "All 19 genres". */
export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group inline-flex items-center gap-1 rounded-sm text-sm font-bold text-amber-300 transition-colors hover:text-amber-200 ${RING}`}
		>
			{children}
			<span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
				›
			</span>
		</Link>
	)
}

/** A sideways row of cards with the shelves' arrows: every card of a family reachable without a wall of them. */
export function CardRail({
	label,
	head,
	children,
}: {
	label: string
	head: (arrows: ReactNode) => ReactNode
	children: ReactNode[]
}) {
	const row = useStepRow<HTMLUListElement>([children.length])
	return (
		<div className="min-w-0 space-y-4">
			{head(<RowArrows row={row} label={label} />)}
			<ul
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-1 [scrollbar-width:none] sm:-mx-6 sm:gap-4 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
			>
				{children.map((child, i) => (
					<li
						// oxlint-disable-next-line react/no-array-index-key -- a fixed list
						key={i}
						className="flex w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2.2)] lg:w-[calc((100%-3rem)/4)] [&>*]:w-full"
					>
						{child}
					</li>
				))}
			</ul>
		</div>
	)
}

/**
 * The kinds inside a place as links: each opens the place's list narrowed to that kind. Navigation, so plain words
 * in a short list, never chips.
 */
export function KindLinks({
	kinds,
	to,
	className = "",
}: {
	kinds: KindLink[]
	to: (id: string) => string
	className?: string
}) {
	if (!kinds.length) return null
	return (
		<ul className={`grid gap-x-5 gap-y-0.5 ${className}`}>
			{kinds.map((k) => (
				<li key={k.id} className="min-w-0">
					<Link
						to={to(k.id)}
						prefetch="intent"
						className={`group/kind flex items-center gap-1.5 rounded-sm py-1 text-[15px] font-semibold text-gray-200 transition-colors hover:text-amber-200 ${RING}`}
					>
						<span
							aria-hidden
							className="text-gray-600 transition-[color,transform] duration-200 group-hover/kind:translate-x-0.5 group-hover/kind:text-amber-300"
						>
							›
						</span>
						<span className="truncate">{k.name}</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * How much of each trait a place has, in five steps, against what is usual (the small notch). The word is the
 * message; the steps say how strongly. Exact values wait behind the word (hover, focus or tap).
 */
export function TraitMeters({
	more,
	less,
	noun,
	title = "What sets it apart",
}: {
	more: Trait[]
	less: Trait[]
	noun: string
	title?: string
}) {
	if (!more.length) return null
	const row = (t: Trait, i: number) => {
		const steps = Math.max(0, Math.min(5, Math.round(t.value / 2)))
		const usual = Math.max(0, Math.min(5, t.base / 2))
		return (
			<div key={t.key} className="flex items-center gap-3 py-[5px]">
				<dt className="min-w-0 flex-1 text-[15px] font-semibold">
					<TraitWord trait={t} noun={noun}>
						{cap(t.word)}
					</TraitWord>
				</dt>
				<dd className="relative flex shrink-0 gap-[3px]" aria-label={`${steps} of 5`}>
					{[1, 2, 3, 4, 5].map((n) => (
						<motion.span
							key={n}
							initial={{ scaleY: 0.4, opacity: 0 }}
							animate={{ scaleY: 1, opacity: 1 }}
							transition={{ duration: 0.3, delay: 0.05 * i + 0.03 * n, ease: [0.22, 1, 0.36, 1] }}
							className="h-3.5 w-[18px] origin-bottom rounded-[3px]"
							style={{ background: n <= steps ? t.color : "rgba(255,255,255,0.1)" }}
						/>
					))}
					<span
						aria-hidden
						title="What's usual"
						className="absolute -bottom-[5px] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white/60"
						style={{ left: `${(usual / 5) * 100}%` }}
					/>
				</dd>
			</div>
		)
	}
	return (
		<div className={`${PANEL} px-5 py-4`}>
			<p className={CAPTION}>{title}</p>
			<dl className="mt-2">{more.map(row)}</dl>
			{less.length > 0 && (
				<>
					<p className={`${CAPTION} mt-3 border-t border-white/[0.07] pt-3`}>Rarely</p>
					<dl className="mt-1">{less.map((t, i) => row(t, i + more.length))}</dl>
				</>
			)}
			<p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
				<span aria-hidden className="h-[3px] w-[3px] rounded-full bg-white/60" />
				the dot marks what's usual
			</p>
		</div>
	)
}

/**
 * The titles that define a place, each with one sentence from GoodWatch's title analysis as a caption under its real
 * poster card. A contact sheet with captions, not a list of quotes.
 */
export function Essentials({ titles, eager = true }: { titles: ShowTitle[]; eager?: boolean }) {
	if (!titles.length) return null
	const mixed = isMixed(titles)
	return (
		<ul className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
			{titles.map((t, i) => (
				<li key={t.card.key} className="relative w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-auto">
					<ShowMark title={t} mixed={mixed} />
					<TitlePosterCard card={t.card} posterPriority={eager && i === 0 ? "high" : "lazy"} />
					{t.line && (
						<p
							title={t.line}
							className="mt-2.5 line-clamp-5 text-sm leading-snug text-pretty text-gray-300"
						>
							{t.line}
						</p>
					)}
				</li>
			))}
		</ul>
	)
}

/** A kind inside a place, as a card that is one link to the place's list narrowed to it. */
export function KindCard({ kind, to, on }: { kind: KindLink; to: string; on: boolean }) {
	return (
		<Link
			to={to}
			prefetch="intent"
			aria-current={on ? "true" : undefined}
			className={`group flex flex-col rounded-2xl px-4 pt-3.5 pb-4 ring-1 transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${RING} ${
				on
					? "bg-amber-400/[0.08] ring-amber-400/50"
					: "bg-white/[0.04] ring-white/10 hover:ring-white/25"
			}`}
		>
			<span className="flex items-center gap-2">
				<span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-white">
					{kind.name}
				</span>
				{on ? (
					<CheckIcon aria-hidden className="h-4 w-4 shrink-0 text-amber-300" />
				) : (
					<span
						aria-hidden
						className="text-lg leading-none text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
					>
						›
					</span>
				)}
			</span>
			<PosterTrio titles={kind.titles.slice(0, 4)} className="mt-3" />
		</Link>
	)
}

/**
 * The eras as a timeline you move along. From `sm` it runs left to right from the 1930s to today and opens at today's
 * end; a decade's place on the line is its place in time. On a phone it runs down the page, newest first. Each decade
 * says what it was about in a line, shows the traits that mark it, and four of its best-loved titles.
 */
export function EraTimeline({
	eras,
	to,
	label = "decades",
	phone = "column",
	rich = false,
}: {
	/** The Eras room's own cards: three across, with the decade's story in full. */
	rich?: boolean
	/** Newest first. */
	eras: EraCard[]
	to: (place: PlaceRef) => string
	label?: string
	/** On a phone: the line runs down the page (the Eras room), or stays a sideways row (a module on the hub). */
	phone?: "column" | "row"
}) {
	const row = useRef<HTMLOListElement>(null)
	const [edges, setEdges] = useState({ later: true, earlier: false })
	// Before the page runs, the newest four count as in view: that is where the row opens.
	const [seen, setSeen] = useState<Set<string>>(
		() => new Set(eras.slice(0, rich ? 3 : 4).map((e) => e.place.slug)),
	)
	// The row is reversed, so its scroll starts at the right end (0) and runs negative toward the earliest decade.
	const measure = useCallback(() => {
		const el = row.current
		if (!el) return
		const max = el.scrollWidth - el.clientWidth
		setEdges({ later: Math.abs(el.scrollLeft) <= 4, earlier: Math.abs(el.scrollLeft) >= max - 4 })
	}, [])
	useEffect(() => {
		const el = row.current
		if (!el) return
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		const io = new IntersectionObserver(
			(entries) =>
				setSeen((prev) => {
					const next = new Set(prev)
					for (const e of entries) {
						const slug = (e.target as HTMLElement).dataset.era ?? ""
						if (e.isIntersecting) next.add(slug)
						else next.delete(slug)
					}
					return next
				}),
			{ root: el, threshold: 0.6 },
		)
		for (const li of el.querySelectorAll("[data-era]")) io.observe(li)
		return () => {
			ro.disconnect()
			io.disconnect()
		}
	}, [measure])
	const smooth = () =>
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
	const step = (d: -1 | 1) =>
		row.current?.scrollBy({ left: d * row.current.clientWidth * 0.75, behavior: smooth() })
	const goTo = (slug: string) =>
		row.current
			?.querySelector(`[data-era="${slug}"]`)
			?.scrollIntoView({ behavior: smooth(), inline: "center", block: "nearest" })
	const scrolls = !(edges.later && edges.earlier)
	const Over: typeof PeekCard | null = PeekCard

	// The span is a handle too: drag it and the decades follow, as far along the row as the pointer went along the
	// span. Let go and it keeps a little of its speed, then settles on a decade. A press without a drag is a click.
	const strip = useRef<HTMLDivElement>(null)
	const drag = useRef<{
		x: number
		left: number
		moved: boolean
		trail: [number, number][]
	} | null>(null)
	const glide = useRef(0)
	const dragged = useRef(false)
	const [grabbing, setGrabbing] = useState(false)
	const ratio = () =>
		row.current && strip.current ? row.current.scrollWidth / strip.current.clientWidth : 1
	const settle = (wanted: number) => {
		const el = row.current
		if (!el) return
		const box = el.getBoundingClientRect()
		const pad = Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0
		const max = el.scrollWidth - el.clientWidth
		// The scroll positions that put a decade's card at the row's start (the row is reversed: 0 is today's end).
		const stops = [...el.querySelectorAll<HTMLElement>("[data-era]")].map((li) =>
			Math.max(-max, Math.min(0, el.scrollLeft + li.getBoundingClientRect().left - box.left - pad)),
		)
		const target = stops.reduce(
			(best, s) => (Math.abs(s - wanted) < Math.abs(best - wanted) ? s : best),
			stops[0] ?? 0,
		)
		const from = el.scrollLeft
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const ms = still ? 0 : Math.min(520, 220 + Math.abs(target - from) * 0.5)
		const start = performance.now()
		cancelAnimationFrame(glide.current)
		const tick = (now: number) => {
			const t = ms ? Math.min(1, (now - start) / ms) : 1
			el.scrollLeft = from + (target - from) * (1 - (1 - t) ** 3)
			if (t < 1) glide.current = requestAnimationFrame(tick)
			else el.style.scrollSnapType = ""
		}
		glide.current = requestAnimationFrame(tick)
	}
	const stripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.button !== 0 || !row.current) return
		cancelAnimationFrame(glide.current)
		dragged.current = false
		drag.current = { x: e.clientX, left: row.current.scrollLeft, moved: false, trail: [] }
	}
	const stripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		const d = drag.current
		const el = row.current
		if (!d || !el) return
		const dx = e.clientX - d.x
		if (!d.moved && Math.abs(dx) < 5) return
		if (!d.moved) {
			d.moved = true
			e.currentTarget.setPointerCapture(e.pointerId)
			// The row follows the pointer exactly while it is held; it snaps to a decade when let go.
			el.style.scrollSnapType = "none"
			setGrabbing(true)
		}
		el.scrollLeft = d.left + dx * ratio()
		d.trail.push([e.clientX, e.timeStamp])
		if (d.trail.length > 5) d.trail.shift()
	}
	const stripUp = () => {
		const d = drag.current
		drag.current = null
		if (!d?.moved || !row.current) return
		dragged.current = true
		setGrabbing(false)
		const [first, last] = [d.trail[0], d.trail[d.trail.length - 1]]
		const speed =
			first && last && last[1] > first[1] ? (last[0] - first[0]) / (last[1] - first[1]) : 0
		settle(row.current.scrollLeft + speed * 140 * ratio())
	}
	return (
		<div className="min-w-0">
			{/* The whole span at a glance: the lit decades are the ones in view. Click one to travel there. */}
			<div className="mb-5 hidden items-center gap-3 sm:flex">
				<div
					ref={strip}
					role="toolbar"
					tabIndex={-1}
					aria-label="Decades. Drag, click or use the arrow keys to travel."
					data-era-strip=""
					onPointerDown={stripDown}
					onPointerMove={stripMove}
					onPointerUp={stripUp}
					onPointerCancel={stripUp}
					// A drag that ends over a decade must not also count as a click on it.
					onClickCapture={(e) => {
						if (!dragged.current) return
						dragged.current = false
						e.stopPropagation()
						e.preventDefault()
					}}
					onKeyDown={(e) => {
						if (e.key === "ArrowLeft") step(-1)
						else if (e.key === "ArrowRight") step(1)
					}}
					className={`flex min-w-0 flex-1 touch-pan-y items-center select-none ${scrolls ? (grabbing ? "cursor-grabbing" : "cursor-grab") : ""}`}
				>
					{[...eras].reverse().map((e, i) => {
						const on = seen.has(e.place.slug)
						return (
							<button
								key={e.place.slug}
								type="button"
								onClick={() => goTo(e.place.slug)}
								aria-label={`Show the ${e.place.label}`}
								className={`group/tick relative flex h-9 min-w-0 flex-1 flex-col justify-end rounded-sm ${grabbing ? "cursor-grabbing" : scrolls ? "cursor-grab" : "cursor-pointer"} ${RING}`}
							>
								<span
									className={`pb-1.5 text-left text-[13px] font-bold tabular-nums transition-colors duration-200 ${on ? "text-white" : "text-gray-500 group-hover/tick:text-gray-300"}`}
								>
									{e.place.label}
								</span>
								<span
									className={`block h-[3px] w-full transition-colors duration-300 ${on ? "bg-amber-400" : "bg-white/15 group-hover/tick:bg-white/30"} ${i === 0 ? "rounded-l-full" : ""} ${i === eras.length - 1 ? "rounded-r-full" : ""}`}
								/>
							</button>
						)
					})}
				</div>
				{scrolls && (
					<div className="hidden shrink-0 items-center gap-1 lg:flex">
						<StepButton
							label={`Earlier ${label}`}
							disabled={edges.earlier}
							onClick={() => step(-1)}
						>
							<ChevronLeftIcon className="h-5 w-5" />
						</StepButton>
						<StepButton label={`Later ${label}`} disabled={edges.later} onClick={() => step(1)}>
							<ChevronRightIcon className="h-5 w-5" />
						</StepButton>
					</div>
				)}
			</div>
			<ol
				ref={row}
				onScroll={measure}
				// Newest first in the document, earliest on the left: a card that lays the row out itself keeps that.
				data-cards="reverse"
				className={`flex sm:-mx-6 sm:snap-x sm:flex-row-reverse sm:gap-4 sm:overflow-x-auto sm:scroll-px-6 sm:px-6 sm:pt-1 sm:pb-1 sm:[scrollbar-width:none] lg:mx-0 lg:scroll-px-0 lg:px-0 ${
					phone === "column"
						? "max-sm:flex-col max-sm:border-l max-sm:border-white/15"
						: "max-sm:-mx-4 max-sm:snap-x max-sm:gap-3 max-sm:overflow-x-auto max-sm:scroll-px-4 max-sm:px-4 max-sm:pt-1 max-sm:pb-1 max-sm:[scrollbar-width:none]"
				}`}
			>
				{eras.map((e) => {
					return (
						<li
							key={e.place.slug}
							data-era={e.place.slug}
							className={`relative sm:w-[19rem] sm:shrink-0 sm:snap-start ${rich ? "lg:w-[calc((100%-2rem)/3)]" : "lg:w-[calc((100%-3rem)/4)]"} ${
								phone === "column"
									? "max-sm:pb-7 max-sm:pl-5 max-sm:last:pb-0"
									: "max-sm:w-[78%] max-sm:shrink-0 max-sm:snap-start"
							}`}
						>
							{phone === "column" && (
								<span
									aria-hidden
									className="absolute top-2.5 -left-[4.5px] h-2 w-2 rounded-full bg-gray-400 ring-4 ring-gray-900 sm:hidden"
								/>
							)}
							{Over ? (
								<Over
									place={e.place}
									href={to(e.place)}
									copy={e.line ? { short: e.line, lede: e.lede ?? "" } : null}
									titles={e.titles}
									traits={e.words ?? []}
									rose={e.rose}
									size={rich ? "l" : "m"}
								/>
							) : (
								<EraCardPlain era={e} to={to(e.place)} rich={rich} />
							)}
						</li>
					)
				})}
			</ol>
		</div>
	)
}

/** A decade as one link: its numerals, what it was about in a line, what was on the rise, and its best-loved titles. */
export function EraCardPlain({
	era: e,
	to,
	rich = false,
}: {
	era: EraCard
	to: string
	rich?: boolean
}) {
	const rose = e.rose.slice(0, rich ? 3 : 2)
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group flex h-full flex-col rounded-2xl bg-white/[0.04] px-4 pt-3.5 pb-4 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${RING}`}
		>
			<span className="flex items-baseline gap-2">
				<span className="font-display text-3xl leading-none font-bold tracking-tight text-white tabular-nums">
					{e.place.label}
				</span>
				<span
					aria-hidden
					className="ml-auto text-lg leading-none text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
				>
					›
				</span>
			</span>
			{e.line && (
				<span
					className={`mt-2 block leading-snug text-gray-200 ${rich ? "text-[17px] font-semibold" : "text-[15px] sm:min-h-[2.6rem]"}`}
				>
					{e.line}
				</span>
			)}
			{rich && e.lede && (
				<span className="mt-2 block text-[15px] leading-relaxed text-gray-400 lg:min-h-[7.5rem]">
					{e.lede}
				</span>
			)}
			{rose.length > 0 && (
				<span className={`mt-2 block text-sm text-gray-400 ${rich ? "" : "truncate"}`}>
					On the rise:{" "}
					{rose.map((w, i) => (
						<span key={w.label}>
							{i > 0 && (i === rose.length - 1 ? " and " : ", ")}
							<span className="font-semibold" style={{ color: w.hue ?? "#e5e7eb" }}>
								{lower(w.label)}
							</span>
						</span>
					))}
				</span>
			)}
			<PosterTrio titles={e.titles.slice(0, 4)} className="mt-auto pt-3.5" />
		</Link>
	)
}

/** A streaming service as one link: its logo, what it is known for in a line, what it is strong on, three posters. */
interface ServiceCardProps {
	place: PlaceRef
	to: string
	line?: string
	goodAt: PlaceRef[]
	titles: ShowTitle[]
	/** What sets it apart, as words. */
	words?: Trait[]
}

export function ServiceCardView(props: ServiceCardProps) {
	return (
		<PeekCard
			place={props.place}
			href={props.to}
			copy={props.line ? { short: props.line, lede: "" } : null}
			titles={props.titles}
			traits={props.words ?? []}
			goodAt={props.goodAt}
			size="m"
		/>
	)
}

export function ServiceCardPlain({ place, to, line, goodAt, titles }: ServiceCardProps) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group flex flex-col rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:ring-white/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${RING}`}
		>
			<span className="flex items-center gap-3">
				{place.logo ? (
					<img
						src={poster(place.logo, "w92")}
						alt=""
						loading="lazy"
						className="h-11 w-11 shrink-0 rounded-[10px] ring-1 ring-white/10"
					/>
				) : (
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-white/10 text-lg font-bold text-gray-200 ring-1 ring-white/10">
						{place.label.charAt(0)}
					</span>
				)}
				<span className="min-w-0 flex-1">
					<span className="block truncate font-display text-xl font-bold tracking-tight text-white">
						{place.label}
					</span>
					{goodAt.length > 0 && (
						<span className="block truncate text-sm text-gray-400">
							Strong on{" "}
							{goodAt.map((g, i) => (
								<span key={`${g.family}-${g.slug}`}>
									{i > 0 && (i === goodAt.length - 1 ? " and " : ", ")}
									<span className="font-semibold" style={{ color: g.hue ?? "#e5e7eb" }}>
										{lower(g.label)}
									</span>
								</span>
							))}
						</span>
					)}
				</span>
				<span
					aria-hidden
					className="text-lg text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
				>
					›
				</span>
			</span>
			{line && <span className="mt-3 block text-sm leading-snug text-gray-300">{line}</span>}
			{titles.length > 0 && <PosterTrio titles={titles.slice(0, 3)} className="mt-3" />}
		</Link>
	)
}

export interface PickOption {
	key: string
	label: string
	/** The option's address. */
	to: string
	mark?: ReactNode
}

/**
 * A filter as a menu whose choices are links (Best's Mood, Genre, Decade, Year). It borrows the sort menu's shell,
 * surface, focus handling and motion (ui/filter-bar), so it reads as one of the site's own filter controls.
 */
export function PickMenu({
	label,
	value,
	options,
	clearTo,
	columns = 1,
}: {
	/** "Mood" */
	label: string
	/** The chosen option's key, or null for any. */
	value: string | null
	options: PickOption[]
	/** The address without this filter. */
	clearTo: string
	columns?: 1 | 2 | 3
}) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const menuId = useId()
	const navigate = useNavigate()
	useMenu(open, () => setOpen(false), root, trigger)
	const chosen = options.find((o) => o.key === value)
	const pick = (to: string) => {
		setOpen(false)
		navigate(to, { preventScrollReset: true })
	}
	const item = (key: string, text: string, to: string, on: boolean, mark?: ReactNode) => (
		<a
			key={key}
			href={to}
			role="menuitemradio"
			aria-checked={on}
			data-checked={on || undefined}
			onClick={(e) => {
				if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
				e.preventDefault()
				pick(to)
			}}
			className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-white/[0.07] text-white ring-1 ring-white/10"
					: "text-gray-300 hover:bg-white/5 hover:text-white"
			}`}
		>
			{mark}
			<span className="min-w-0 flex-1 truncate">{text}</span>
			<CheckIcon className={`h-4 w-4 shrink-0 text-white ${on ? "" : "invisible"}`} />
		</a>
	)
	return (
		<div ref={root} className="relative shrink-0">
			<motion.button
				ref={trigger}
				type="button"
				whileTap={TAP}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={() => setOpen(!open)}
				className={`flex h-9 cursor-pointer items-center gap-1.5 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}
			>
				<span className="text-gray-400">{label}</span>
				<span className={`font-bold ${chosen ? "text-white" : "text-gray-300"}`}>
					{chosen?.label ?? "Any"}
				</span>
				<ChevronDownIcon
					className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</motion.button>
			{open && (
				<motion.div
					id={menuId}
					role="menu"
					aria-label={label}
					initial={{ opacity: 0, y: -6, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.16 }}
					className={`absolute left-0 z-40 mt-2 max-h-[min(26rem,70vh)] origin-top-left overflow-y-auto p-1.5 ${columns === 3 ? "w-[30rem]" : columns === 2 ? "w-[25rem]" : "w-56"} max-w-[calc(100vw-1.5rem)] ${MENU}`}
				>
					{item("any", `Any ${low(label)}`, clearTo, !chosen)}
					<div
						className={`mt-1 grid gap-x-1 ${columns === 3 ? "grid-cols-2 sm:grid-cols-3" : columns === 2 ? "grid-cols-2" : ""}`}
					>
						{options.map((o) => item(o.key, o.label, o.to, o.key === value, o.mark))}
					</div>
				</motion.div>
			)}
		</div>
	)
}

/** A part of a blend as a link to its own page, with a way to take it out. */
export function PartLink({
	place,
	to,
	removeTo,
}: {
	place: PlaceRef
	to: string
	removeTo?: string
}) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pr-1 pl-3 ring-1 ring-white/10">
			<Link
				to={to}
				prefetch="intent"
				className={`flex items-center gap-2 rounded-full text-sm font-bold text-white transition-colors hover:text-amber-200 ${RING}`}
			>
				<PlaceMark place={place} size={14} />
				{place.label}
			</Link>
			{removeTo && (
				<Link
					to={removeTo}
					prefetch="intent"
					preventScrollReset
					aria-label={`Without ${place.label}`}
					title={`Without ${place.label}`}
					className={`grid h-6 w-6 place-items-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${RING}`}
				>
					<svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
						<path
							d="M2 2l8 8M10 2l-8 8"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>
				</Link>
			)}
		</span>
	)
}

/**
 * A place's head with a panel beside it: the atlas's PlaceLede, with the text and the panel both starting at the top
 * (a tall panel next to a short text otherwise leaves a hole above the title). A mood's hue washes the head.
 */
export function Head({
	kicker,
	title,
	lede,
	hue,
	crumbs,
	aside,
	after,
	children,
}: {
	kicker: ReactNode
	title: ReactNode
	lede?: ReactNode
	hue?: string
	crumbs?: ReactNode
	aside?: ReactNode
	/** Next to the title ("+ Add"). */
	after?: ReactNode
	children?: ReactNode
}) {
	return (
		<header className="relative isolate">
			{hue && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
					style={{
						background: `radial-gradient(120% 100% at 15% 0%, color-mix(in oklab, ${hue} 26%, transparent) 0%, transparent 62%)`,
					}}
				/>
			)}
			<div className={`${WRAP} pt-6 pb-8 sm:pt-8 sm:pb-10`}>
				{crumbs}
				<div
					className={`mt-5 grid items-start gap-x-12 gap-y-7 ${aside ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : ""}`}
				>
					<div className="min-w-0">
						<Kicker className="flex items-center gap-2">
							{hue && (
								<span
									aria-hidden
									className="h-2 w-2 rounded-full"
									style={{ background: hue, boxShadow: `0 0 12px ${hue}` }}
								/>
							)}
							{kicker}
						</Kicker>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
							<PageTitle className="text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
								{title}
							</PageTitle>
							{after}
						</div>
						{lede && (
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
								{lede}
							</p>
						)}
						{children}
					</div>
					{aside && <div className="min-w-0">{aside}</div>}
				</div>
			</div>
		</header>
	)
}

/** The places next door as one slim row: the name, and the word that says how it differs. Each cell is one link. */
export function NearRow({ items }: { items: { place: PlaceRef; to: string; differs: string }[] }) {
	return (
		<ul className="grid gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-4">
			{items.map((n) => (
				<li key={`${n.place.family}-${n.place.slug}`} className="flex">
					<Link
						to={n.to}
						prefetch="intent"
						className={`group flex w-full flex-col gap-0.5 bg-[#151b28] px-4 py-3.5 transition-colors hover:bg-[#1c2333] ${RING} focus-visible:ring-inset`}
					>
						<span className="flex items-center gap-2">
							<PlaceMark place={n.place} size={16} />
							<span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-white">
								{n.place.label}
							</span>
							<span
								aria-hidden
								className="text-lg leading-none text-white/40 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
							>
								›
							</span>
						</span>
						<span className="text-sm text-gray-400">{n.differs}</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

/**
 * A decade against the one before it: what there was more of and less of, as words. Each word opens that kind of
 * title from this decade.
 */
export function ShiftPanel({
	before,
	rose,
	fell,
}: {
	/** "1980s" */
	before: string
	rose: { label: string; to: string; place: PlaceRef | null }[]
	fell: { label: string; to: string; place: PlaceRef | null }[]
}) {
	const group = (
		title: string,
		Icon: typeof ArrowTrendingUpIcon,
		items: { label: string; to: string; place: PlaceRef | null }[],
	) =>
		items.length > 0 && (
			<div className="min-w-0">
				<p className="flex items-center gap-1.5 text-sm font-semibold text-gray-400">
					<Icon aria-hidden className="h-4 w-4" />
					{title}
				</p>
				<ul className="mt-1.5">
					{items.map((it) => (
						<li key={it.label}>
							<Link
								to={it.to}
								prefetch="intent"
								className={`group/shift flex items-center gap-2 rounded-sm py-1 text-[17px] font-semibold text-white transition-colors hover:text-amber-200 ${RING}`}
							>
								{it.place && <PlaceMark place={it.place} size={14} />}
								<span className="truncate">{it.label}</span>
								<span
									aria-hidden
									className="text-white/30 transition-[transform,color] duration-200 group-hover/shift:translate-x-0.5 group-hover/shift:text-amber-300"
								>
									›
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
		)
	return (
		<div className={`${PANEL} px-5 py-4`}>
			<p className={CAPTION}>{`After the ${before}`}</p>
			<div className="mt-3 grid grid-cols-2 gap-x-6">
				{group("More", ArrowTrendingUpIcon, rose)}
				{group("Less", ArrowTrendingDownIcon, fell)}
			</div>
		</div>
	)
}

/**
 * The Eras room: the timeline as the page itself. Each decade is a stop on the line with what it was about, what was
 * on the rise, and six of its best-loved titles. The bar on top shows the whole span and where you are; a decade in
 * it jumps to its stop.
 */
export function EraColumn({
	eras,
	to,
}: {
	/** Newest first. */
	eras: EraCard[]
	to: (place: PlaceRef) => string
}) {
	const [here, setHere] = useState<string | undefined>(eras[0]?.place.slug)
	useEffect(() => {
		const stops = [...document.querySelectorAll<HTMLElement>("[data-era-stop]")]
		const measure = () => {
			let current = stops[0]?.dataset.eraStop
			for (const el of stops)
				if (el.getBoundingClientRect().top <= 260) current = el.dataset.eraStop
			setHere(current)
		}
		measure()
		window.addEventListener("scroll", measure, { passive: true })
		return () => window.removeEventListener("scroll", measure)
	}, [])
	return (
		<div>
			<nav
				aria-label="Decades"
				className="sticky top-16 z-10 -mx-4 flex bg-gray-900/95 px-4 pt-2 pb-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[calc(4rem+93px)] lg:mx-0 lg:px-0"
			>
				{[...eras].reverse().map((e, i) => {
					const on = e.place.slug === here
					return (
						<a
							key={e.place.slug}
							href={`#era-${e.place.slug}`}
							aria-label={`Go to the ${e.place.label}`}
							aria-current={on ? "true" : undefined}
							className={`group/tick flex min-w-0 flex-1 flex-col ${RING}`}
						>
							<span
								className={`pb-1.5 text-xs font-bold tabular-nums transition-colors duration-200 sm:text-[13px] ${on ? "text-white" : "text-gray-500 group-hover/tick:text-gray-300"}`}
							>
								<span className="sm:hidden">{e.place.label.replace(/^\d\d/, "’")}</span>
								<span className="max-sm:hidden">{e.place.label}</span>
							</span>
							<span
								className={`block h-[3px] w-full transition-colors duration-300 ${on ? "bg-amber-400" : "bg-white/15 group-hover/tick:bg-white/30"} ${i === 0 ? "rounded-l-full" : ""} ${i === eras.length - 1 ? "rounded-r-full" : ""}`}
							/>
						</a>
					)
				})}
			</nav>
			<ol className="mt-2">
				{eras.map((e) => (
					<li
						key={e.place.slug}
						id={`era-${e.place.slug}`}
						data-era-stop={e.place.slug}
						className="grid scroll-mt-52 items-start gap-x-10 gap-y-5 border-t border-white/[0.07] py-8 first:border-t-0 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]"
					>
						<div className="min-w-0">
							<Link
								to={to(e.place)}
								prefetch="intent"
								className={`group inline-flex items-baseline gap-2 rounded-sm ${RING}`}
							>
								<span className="font-display text-5xl leading-none font-bold tracking-tight text-white tabular-nums transition-colors group-hover:text-amber-200">
									{e.place.label}
								</span>
								<span
									aria-hidden
									className="text-2xl text-amber-300 transition-transform duration-200 group-hover:translate-x-1"
								>
									›
								</span>
							</Link>
							{e.line && (
								<p className="mt-3 text-[17px] leading-snug font-semibold text-gray-100">
									{e.line}
								</p>
							)}
							{e.lede && (
								<p className="mt-2 text-[15px] leading-relaxed text-pretty text-gray-400">
									{e.lede}
								</p>
							)}
							{e.rose.length > 0 && (
								<p className="mt-3 text-sm text-gray-400">
									On the rise:{" "}
									{e.rose.map((w, i) => (
										<span key={w.label}>
											{i > 0 && (i === e.rose.length - 1 ? " and " : ", ")}
											<span className="font-semibold" style={{ color: w.hue ?? "#e5e7eb" }}>
												{lower(w.label)}
											</span>
										</span>
									))}
								</p>
							)}
						</div>
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3 lg:pt-1">
							{e.titles.map((t) => (
								<Thumb key={t.card.key} title={t} size="w342" />
							))}
						</div>
					</li>
				))}
			</ol>
		</div>
	)
}

/**
 * Ways onward from a place, inside its head: each cell is one link with a small label saying what kind of step it is.
 */
export function Onward({
	items,
}: {
	items: { label: string; value: string; sub?: string; to: string; hue?: string }[]
}) {
	if (!items.length) return null
	return (
		<ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-3">
			{items.map((it, i) => (
				<li key={it.label} className={`min-w-0 ${i === 2 ? "max-sm:col-span-2" : ""}`}>
					<Link to={it.to} prefetch="intent" className={`group block rounded-lg ${RING}`}>
						<span className={CAPTION}>{it.label}</span>
						<span
							className="mt-1 flex items-baseline gap-1.5 font-display text-xl leading-tight font-bold tracking-tight text-white sm:text-2xl"
							style={it.hue ? { color: it.hue } : undefined}
						>
							<span className="line-clamp-2 min-w-0 text-balance">{it.value}</span>
							<span
								aria-hidden
								className="text-lg text-white/30 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
							>
								›
							</span>
						</span>
						{it.sub && (
							<span className="mt-1 block text-sm leading-snug text-gray-400">{it.sub}</span>
						)}
					</Link>
				</li>
			))}
		</ul>
	)
}
