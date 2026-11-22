// The Top page: the ranking as the site's own poster cards. One control bar reads as a sentence ("The top of [Mood]
// [Genre] [Decade] [Year]", then "Leaning" and three dial pills), then the page's first three titles as leads and the
// rest as a ranked poster grid. Every title is the poster card members see everywhere (score pill, title band, award,
// hover actions); each source score is one aligned cell in a fixed order. The number on a card is always its place on
// this page; when the dials re-sort, its place on the full list shows quietly under it ("No. 46 overall").
//
// Top has no Browse row: its Movies | Shows control sits in the head, top right (above the title on a phone).
import { Link } from "@remix-run/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import { useEffect, useRef } from "react"
import type { BestRow, SourceKey } from "~/domain/browse/types"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import letterboxdLogo from "~/img/letterboxd-dots.svg?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { TopFilter, TopPage } from "~/server/top-page.server"
import { KindControl, type KindChoice } from "~/ui/browse/KindControl"
import { PANEL, WRAP } from "~/ui/browse/base"
import { Dial } from "~/ui/browse/dials/Dial"
import { type Tuner, useTuner } from "~/ui/browse/dials/Tuner"
import type { DialSpec, Settings } from "~/domain/browse/tune"
import { EASE, FOCUS, QUICK_T } from "~/ui/browse/motion"
import { CAPTION, Kicker } from "~/ui/eyebrow"
import { SHELL } from "~/ui/filter-bar/motion"
import { PageTitle } from "~/ui/heading"
import { NAV_PILL } from "~/ui/selection/selected"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { SizeRule } from "~/utils/tmdb-image"
import { assetUrl } from "~/utils/asset-url"

const LEAD_SIZES: SizeRule[] = [
	["(min-width: 640px)", "144px"],
	[null, "112px"],
]

const MOVE = { duration: 0.38, ease: [0.65, 0, 0.35, 1] as const }
/** With a dial set, how many of the page's titles come forward. */
const TUNED_SHOWN = 25

/** Every source is kept on 0-100; each cell speaks the source's own scale. Fixed order, so columns line up. */
const SOURCES: {
	key: SourceKey
	name: string
	logo: string
	wide?: boolean
	say: (v: number) => string
}[] = [
	{ key: "imdb", name: "IMDb", logo: imdbLogo, wide: true, say: (v) => (v / 10).toFixed(1) },
	{
		key: "letterboxd",
		name: "Letterboxd",
		logo: letterboxdLogo,
		wide: true,
		say: (v) => (v / 20).toFixed(1),
	},
	{
		key: "metacritic",
		name: "Metacritic",
		logo: metacriticLogo,
		say: (v) => String(Math.round(v)),
	},
	{ key: "rtCritics", name: "Rotten Tomatoes", logo: rottenLogo, say: (v) => `${Math.round(v)}%` },
]

const isMixed = (rows: BestRow[]) =>
	rows.some((r) => r.title.card.media_type === "show") &&
	rows.some((r) => r.title.card.media_type !== "show")

/**
 * With a dial set, the page's titles nearest to the dials come forward (each keeps its real rank); at rest the page
 * as ranked.
 */
export function tunedRows(
	rows: BestRow[],
	scores: Record<number, number[]>,
	dials: DialSpec[],
	settings: Settings,
): { rows: BestRow[]; tuned: boolean } {
	const active = dials.filter((d) => settings[d.id] != null)
	if (!active.length) return { rows, tuned: false }
	const norm = (d: DialSpec, x: number) =>
		d.hi > d.lo ? Math.min(1, Math.max(0, (x - d.lo) / (d.hi - d.lo))) : 0.5
	return {
		tuned: true,
		rows: rows
			.map((r, index) => ({
				r,
				cost:
					active.reduce(
						(s, d) =>
							s +
							Math.abs(
								norm(d, scores[r.title.card.key]?.[d.col] ?? 0) - (settings[d.id] as number),
							),
						0,
					) +
					(index / rows.length) * 0.05,
			}))
			.sort((a, b) => a.cost - b.cost)
			.slice(0, TUNED_SHOWN)
			.map((x) => x.r),
	}
}

function Scores({
	sources,
	max,
	cols = max,
	big = false,
}: {
	sources: Partial<Record<SourceKey, number>>
	max: number
	cols?: number
	big?: boolean
}) {
	const known = SOURCES.filter((s) => sources[s.key] != null).slice(0, max)
	if (!known.length) return null
	return (
		<ul
			className={`grid ${big ? "gap-x-5 gap-y-2" : "gap-x-2.5"}`}
			style={{ gridTemplateColumns: `repeat(${cols}, max-content)` }}
		>
			{known.map((s) => (
				<li
					key={s.key}
					title={`${s.name}: ${s.say(sources[s.key] as number)}`}
					className={`flex items-center gap-1.5 font-semibold whitespace-nowrap text-gray-200 tabular-nums ${big ? "text-sm" : "text-[12px]"}`}
				>
					<img
						src={assetUrl(s.logo)}
						alt={s.name}
						className={`shrink-0 ${s.wide ? (big ? "h-3.5" : "h-3") : big ? "h-4" : "h-3.5"} w-auto rounded-[2px]`}
					/>
					{s.say(sources[s.key] as number)}
				</li>
			))}
		</ul>
	)
}

const metaOf = (row: BestRow, mixed: boolean) =>
	[
		row.title.card.release_year,
		mixed ? (row.title.card.media_type === "show" ? "Show" : "Movie") : null,
		row.genres.slice(0, 2).join(", ") || null,
	]
		.filter(Boolean)
		.join(" · ")

function Lead({
	row,
	place,
	tuned,
	mixed,
}: {
	row: BestRow
	place: number
	tuned: boolean
	mixed: boolean
}) {
	const first = place === 1
	const t = row.title
	return (
		<div
			className={`${PANEL} flex h-full gap-4 p-3 sm:p-4 ${first ? "bg-amber-400/[0.05] ring-amber-400/25" : ""}`}
		>
			<div className="w-28 shrink-0 sm:w-36">
				<TitlePosterCard card={t.card} posterSizes={LEAD_SIZES} posterPriority="eager" />
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="flex items-baseline gap-2">
					<span
						className={`font-display text-5xl leading-none font-black tracking-tight tabular-nums ${first ? "text-amber-400" : "text-white/85"}`}
					>
						{place}
					</span>
					{tuned && row.rank !== place && (
						<span className="text-xs font-semibold text-gray-500">No. {row.rank} overall</span>
					)}
				</span>
				<h3 className="mt-2 text-lg leading-snug font-bold text-balance text-white">
					<Link to={t.to} prefetch="intent" className={`rounded-sm hover:text-amber-200 ${FOCUS}`}>
						{t.card.title}
					</Link>
				</h3>
				<p className="mt-0.5 text-sm text-gray-400">{metaOf(row, mixed)}</p>
				<div className="mt-auto pt-4">
					<Scores sources={row.sources} max={4} cols={2} big />
				</div>
			</div>
		</div>
	)
}

function Tile({
	row,
	place,
	tuned,
	mixed,
	eager,
}: {
	row: BestRow
	place: number
	tuned: boolean
	mixed: boolean
	eager: boolean
}) {
	const show = mixed && row.title.card.media_type === "show"
	return (
		<>
			<div className="relative">
				<span className="pointer-events-none absolute -top-2 -left-2 z-20 flex h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-gray-950 px-2 font-display text-sm font-bold text-white tabular-nums shadow-lg shadow-black/50 ring-1 ring-white/20">
					{place}
					{show && (
						<span className="text-[9px] font-bold tracking-wide text-gray-400 uppercase">Show</span>
					)}
				</span>
				<TitlePosterCard
					card={row.title.card}
					posterPriority={eager ? "eager" : "lazy"}
					skipOffscreen={!eager}
				/>
			</div>
			<div className="mt-2 flex min-h-5 items-center justify-between gap-2">
				<Scores sources={row.sources} max={3} />
			</div>
			{tuned && row.rank !== place && (
				<p className="mt-0.5 text-[11px] font-semibold text-gray-500">No. {row.rank} overall</p>
			)}
		</>
	)
}

/** One "The top of" menu: Any, then every option as a link. Closes on a pick and on a tap outside. */
function Pick({ f }: { f: TopFilter }) {
	const ref = useRef<HTMLDetailsElement>(null)
	useEffect(() => {
		const away = (e: Event) => {
			if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false
		}
		document.addEventListener("pointerdown", away)
		return () => document.removeEventListener("pointerdown", away)
	}, [])
	return (
		<details ref={ref} className="group/pick relative">
			<summary
				className={`flex h-9 cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-bold select-none [&::-webkit-details-marker]:hidden ${SHELL} ${f.value ? "text-white" : "text-gray-300"} ${FOCUS}`}
			>
				<span className="font-medium text-gray-400">{f.label}</span>
				{f.value ?? "Any"}
				<svg
					viewBox="0 0 20 20"
					className="h-4 w-4 text-gray-400 transition-transform duration-200 group-open/pick:rotate-180"
					aria-hidden
				>
					<path
						d="M5 7.5 10 12.5 15 7.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</summary>
			<div className="absolute top-full left-0 z-30 mt-2 grid w-[min(22rem,calc(100vw-2rem))] grid-cols-2 gap-0.5 rounded-xl bg-gray-900 p-2 shadow-2xl shadow-black/60 ring-1 ring-white/15">
				<Link
					to={f.clear}
					preventScrollReset
					onClick={() => ref.current?.removeAttribute("open")}
					className={`col-span-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${f.value ? "text-gray-300 hover:bg-white/10 hover:text-white" : NAV_PILL} ${FOCUS}`}
				>
					Any {f.label.toLowerCase()}
				</Link>
				{f.options.map((o) => (
					<Link
						key={o.label}
						to={o.to}
						preventScrollReset
						onClick={() => ref.current?.removeAttribute("open")}
						className={`truncate rounded-lg px-2.5 py-1.5 text-sm font-semibold ${o.on ? NAV_PILL : "text-gray-200 hover:bg-white/10 hover:text-white"} ${FOCUS}`}
					>
						{o.label}
					</Link>
				))}
			</div>
		</details>
	)
}

/** The menus and the dials as one bar that reads as a sentence; the dials are pills of the menus' family. */
function Controls({
	filters,
	dials,
	tuner,
}: {
	filters: TopFilter[]
	dials: DialSpec[]
	tuner: Tuner
}) {
	return (
		<section
			aria-label="What to rank"
			className="rounded-3xl bg-white/[0.025] p-2 ring-1 ring-white/[0.07] sm:p-2.5"
		>
			<div className="flex flex-wrap items-center gap-2 px-2 pt-1 pb-2.5">
				<span className={`${CAPTION} mr-1 w-[5.5rem] shrink-0`}>The top of</span>
				{filters.map((f) => (
					<Pick key={f.label} f={f} />
				))}
			</div>
			{dials.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-2 pt-2.5 pb-1 lg:flex-nowrap">
					<span className={`${CAPTION} mr-1 w-[5.5rem] shrink-0`}>Leaning</span>
					<div className="grid min-w-0 flex-1 gap-2 max-sm:order-last max-sm:basis-full sm:grid-cols-2 lg:grid-cols-3">
						{dials.map((d) => (
							<Dial
								key={d.id}
								spec={d}
								look="pill"
								at={tuner.settings[d.id] ?? null}
								onChange={(c) => tuner.change(d, c)}
							/>
						))}
					</div>
					<button
						type="button"
						onClick={tuner.reset}
						tabIndex={tuner.tuned ? 0 : -1}
						className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-gray-300 outline-none ${QUICK_T} hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${tuner.tuned ? "opacity-100 max-sm:ml-auto" : "pointer-events-none opacity-0 max-lg:hidden"}`}
					>
						Reset
					</button>
				</div>
			)}
		</section>
	)
}

/** The page links under the list: Prev and Next, and where this page sits. */
function Pager({ data }: { data: TopPage }) {
	if (data.pages < 2) return null
	const last = Math.min(data.first + data.rows.length - 1, data.total)
	const step = "rounded-full px-4 py-2 text-sm font-bold ring-1 ring-white/15 hover:bg-white/10"
	return (
		<nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
			<p className="text-sm text-gray-400 tabular-nums">
				{data.first.toLocaleString("en-US")}–{last.toLocaleString("en-US")} of{" "}
				{data.total.toLocaleString("en-US")}
			</p>
			<div className="flex gap-2">
				{data.prev && (
					<Link to={data.prev} prefetch="intent" className={`${step} text-gray-200 ${FOCUS}`}>
						Prev
					</Link>
				)}
				{data.next && (
					<Link to={data.next} prefetch="intent" className={`${step} text-white ${FOCUS}`}>
						Next
					</Link>
				)}
			</div>
		</nav>
	)
}

export function TopRanking({ data, kinds }: { data: TopPage; kinds: KindChoice[] }) {
	const tuner = useTuner(data.dials)
	const reduce = useReducedMotion()
	const { rows, tuned } = tunedRows(data.rows, data.scores, data.dials, tuner.settings)
	const mixed = isMixed(rows)
	// Leads only at the head of the list: the first three of page 1, or of a tuned page.
	const leads = data.page === 1 || tuned ? 3 : 0
	const lead = rows.slice(0, leads)
	const rest = rows.slice(leads)
	// A card's number is its place: on page 1 or a tuned page counted from 1, on a later page its rank.
	const placeOf = (i: number) => (tuned ? i + 1 : data.first + i)
	const move = reduce ? { duration: 0 } : MOVE
	// The same props on server and client (a reduced-motion browser would otherwise not match the server's HTML);
	// reduced motion only zeroes the timings.
	const enter = {
		initial: { opacity: 0, scale: 0.96 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.16, ease: EASE } },
	}
	return (
		<div className="pb-16">
			<header className="relative">
				<div className={`${WRAP} pt-5 pb-6 sm:pt-8 sm:pb-8`}>
					<div className="flex flex-col-reverse gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<Kicker>Top</Kicker>
							<PageTitle className="mt-2 text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
								{data.heading}
							</PageTitle>
							<p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200">
								{data.intro}
							</p>
						</div>
						<div className="w-fit shrink-0 self-start lg:pt-1">
							<KindControl kinds={kinds} />
						</div>
					</div>
				</div>
			</header>
			<div className={`${WRAP} space-y-6`}>
				<Controls filters={data.filters} dials={data.dials} tuner={tuner} />
				{rows.length ? (
					<LayoutGroup>
						{lead.length > 0 && (
							<ol className="grid gap-3 sm:gap-4 lg:grid-cols-3">
								<AnimatePresence initial={false} mode="popLayout">
									{lead.map((r, i) => (
										<motion.li
											key={r.title.card.key}
											layoutId={`top-${r.title.card.key}`}
											transition={{ layout: move }}
											{...enter}
										>
											<Lead row={r} place={placeOf(i)} tuned={tuned} mixed={mixed} />
										</motion.li>
									))}
								</AnimatePresence>
							</ol>
						)}
						{rest.length > 0 && (
							<ol
								start={placeOf(leads)}
								className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-5 xl:grid-cols-6"
							>
								<AnimatePresence initial={false} mode="popLayout">
									{rest.map((r, i) => (
										<motion.li
											key={r.title.card.key}
											layoutId={`top-${r.title.card.key}`}
											transition={{ layout: move }}
											className="min-w-0"
											{...enter}
										>
											<Tile
												row={r}
												place={placeOf(leads + i)}
												tuned={tuned}
												mixed={mixed}
												eager={!leads && i < 2}
											/>
										</motion.li>
									))}
								</AnimatePresence>
							</ol>
						)}
					</LayoutGroup>
				) : (
					<p className={`${PANEL} p-6 text-gray-300`}>
						Nothing ranked for that pick yet. Loosen one of them.
					</p>
				)}
				{!tuned && <Pager data={data} />}
			</div>
		</div>
	)
}
