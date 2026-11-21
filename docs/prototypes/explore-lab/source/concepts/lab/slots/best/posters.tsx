// PROTOTYPE - throwaway (prototype/explore-r6; round 7 rework). Best as the site's own poster cards: the Dials Best
// page (same filter menus, same dials, same ranking) whose results are the pieces members already know. Every title is
// the real poster card (score pill, title band, award, hover actions).
//
// Round 7 (owner): the dials join the "best of" menus as one sentence-like control bar, as pills of the same height
// (`Dial look="pill"`); no explanatory line and no analysis sentences; each source is one aligned cell (logo + value)
// instead of a wrap of brand chips; the number on a card is always its place on this page (1, 2, 3 ...), and when the
// dials re-sort, the place on the full list is a quiet "No. 46 overall" under it.
import { Link } from "@remix-run/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import letterboxdLogo from "~/img/letterboxd-dots.svg?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import { CAPTION } from "~/ui/eyebrow"
import { assetUrl } from "~/utils/asset-url"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { BestRow, SourceKey } from "../../../../kit/types"
import { KINDS, kindLabel, withKind } from "../../../../kit/address"
import { EASE, FOCUS, PANEL, WRAP, isMixed } from "../../../../kit/ui"
import { Head } from "../../../dials"
import { Dial } from "../../../dials/Dial"
import { type Tuner, useTuner } from "../../../dials/Tuner"
import type { DialSpec } from "../../../dials/tune"
import type { PageViewProps, SlotVariant } from "../../contract"
import { Pick } from "../../../dials"
import { Part } from "../../lab"
import type { KindProps } from "../kind/slot"
import type { PostersData } from "./posters.server"
import { bestRows } from "./rows"

const MOVE = { duration: 0.38, ease: [0.65, 0, 0.35, 1] as const }

/** The kit keeps every source on 0-100; each cell speaks the site's own scale. Fixed order, so columns line up. */
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
				<TitlePosterCard card={t.card} posterPriority="eager" />
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
				<TitlePosterCard card={row.title.card} posterPriority={eager ? "eager" : "lazy"} />
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

/**
 * One control bar that reads as a sentence: "The best of [Mood] [Genre] [Decade] [Year]" and, under a hairline,
 * "Leaning [Critics' picks ◦◦◦ Crowd favorites] [Oldest ◦◦◦ Newest] [Lightest ◦◦◦ Darkest]". The dials are pills of the
 * menus' family, a little taller, so neither row shouts over the other.
 */
function Controls({
	filters,
	dials,
	tuner,
}: {
	filters: PostersData["filters"]
	dials: DialSpec[]
	tuner: Tuner
}) {
	return (
		<section
			aria-label="What to rank"
			className="rounded-3xl bg-white/[0.025] p-2 ring-1 ring-white/[0.07] sm:p-2.5"
		>
			<div className="flex flex-wrap items-center gap-2 px-2 pt-1 pb-2.5">
				<span className={`${CAPTION} mr-1 w-[5.5rem] shrink-0`}>The best of</span>
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
						className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-gray-300 outline-none transition-[opacity,background-color] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${tuner.tuned ? "opacity-100 max-sm:ml-auto" : "pointer-events-none opacity-0 max-lg:hidden"}`}
					>
						Reset
					</button>
				</div>
			)}
		</section>
	)
}

function View({ data, address, to }: PageViewProps<PostersData>) {
	const tuner = useTuner(data.dials)
	const kindProps: KindProps = {
		address,
		to,
		kinds: KINDS.map((k) => ({
			kind: k,
			label: kindLabel(k),
			href: to(withKind(address, k)),
			on: address.kind === k,
		})),
	}
	const reduce = useReducedMotion()
	const { rows, tuned } = bestRows(data.rows, data.scores, data.dials, tuner.settings)
	const mixed = isMixed(rows.map((r) => r.title))
	const lead = rows.slice(0, 3)
	const rest = rows.slice(3)
	const move = reduce ? { duration: 0 } : MOVE
	// The same props on server and client (a reduced-motion browser would otherwise not match the server's HTML);
	// reduced motion only zeroes the timings.
	const enter = {
		initial: { opacity: 0, scale: 0.96 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.16, ease: EASE } },
	}
	return (
		<>
			{/* Best has no rooms row (round 8): Movies | Shows sits in its head, top right (above the title on a phone). */}
			<div className="relative">
				<div
					className={`${WRAP} pointer-events-none flex justify-end max-lg:pt-4 max-lg:justify-start lg:absolute lg:inset-x-0 lg:top-7 lg:z-10`}
				>
					<div className="pointer-events-auto">
						<Part slot="kind" {...kindProps} />
					</div>
				</div>
				<Head d={data} />
			</div>
			<div className={`${WRAP} space-y-6`}>
				<Controls filters={data.filters} dials={data.dials} tuner={tuner} />
				{rows.length ? (
					<LayoutGroup>
						<ol className="grid gap-3 sm:gap-4 lg:grid-cols-3">
							<AnimatePresence initial={false} mode="popLayout">
								{lead.map((r, i) => (
									<motion.li
										key={r.title.card.key}
										layoutId={`best-${r.title.card.key}`}
										transition={{ layout: move }}
										{...enter}
									>
										<Lead row={r} place={i + 1} tuned={tuned} mixed={mixed} />
									</motion.li>
								))}
							</AnimatePresence>
						</ol>
						{rest.length > 0 && (
							<ol
								start={4}
								className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-5 xl:grid-cols-6"
							>
								<AnimatePresence initial={false} mode="popLayout">
									{rest.map((r, i) => (
										<motion.li
											key={r.title.card.key}
											layoutId={`best-${r.title.card.key}`}
											transition={{ layout: move }}
											className="min-w-0"
											{...enter}
										>
											<Tile row={r} place={i + 4} tuned={tuned} mixed={mixed} eager={i < 5} />
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
			</div>
		</>
	)
}

export const variant: SlotVariant<PostersData> = {
	id: "posters",
	name: "Poster ranking",
	what: "The ranking as the site's own poster cards: menus and dial pills in one bar, three leads, then a ranked poster grid with aligned source scores.",
	order: 1,
	View,
	notes: () => [
		{
			term: "The cards",
			means:
				"Every title is the poster card members see everywhere (GoodWatch score pill, title band, award, hover actions); each source is one aligned cell. The number is the place on this page; with the dials set, the place on the full list shows under it.",
			isNew: true,
		},
		{
			term: "The best of ... menus",
			means:
				"Mood, genre, decade and year narrow the ranking; each choice is an address (best cozy movies of 2026).",
		},
		{
			term: "Dials",
			means:
				"Critics or the crowd, old or new, lighter or darker, as pills beside the menus. With a dial set, the 25 nearest come forward and glide to their new places.",
		},
	],
}
