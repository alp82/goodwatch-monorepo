// PROTOTYPE (start page lab, round 3): member c and d's "Go deeper" doors: one always open (Continue watching on
// load, rendered on the server), the open door filled amber with a notch into its section; the section links to
// its page from its header and from a last "See all" tile. Round 4: the doors follow what the member has (sections
// with titles first), with empty, still-forming and few-titles states and their CTAs. Round 5: Hot on socials is a
// door like the others (its ranked titles inline, each with why it's talked about), and every sparse or empty
// section shares one pattern: a slim full-width strip when there is something to say, then one tidy grid where the
// posters, "add more" ghosts and the end tile always fill whole rows at every width.
import { ArrowRightIcon, PlusIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { useState } from "react"
import { why } from "~/ui/talked-about-now/parts"
import { EASE } from "~/ui/watch-next/style"
import { type LabCard, useLab } from "../../lab/types"
import { CHIP, chipTone } from "../hero/shared"
import { DISPLAY, HREF, type Member, Poster, WRAP, interleave, posterSrc } from "../member/shared"
import { PERSONAL_AT, START_HREF } from "./cd-shared"

type Open = "continue" | "movies" | "forYou" | "hot"

type Filter = { key: string; label: string; keep: (c: LabCard) => boolean }

type Cta = { label: string; href: string }

type Dive = {
	key: Open
	label: string
	/** Fixed one-line count, so the doors never change height. */
	line: string
	cards: LabCard[]
	href: string
	/** The page's name for the last tile: "See all 11 in My shows". */
	pageName: string
	/** Whether the tile can promise a count (For you keeps going, so it says "More in For you"). */
	counted: boolean
	note: string
	/** Media type and length are filters inside a section, not the page's navigation. */
	filters?: Filter[]
	/** What the strip says when the section has no titles: why it's empty and where to go. */
	empty: { title: string; body: string; ctas: Cta[] }
	/** The "add more" ghost tile that fills a short grid's row; null: a short grid drops titles to fit instead. */
	ghost: Cta | null
	/** A line under each poster (Hot on socials: rank and why it's talked about), by card key. */
	lines?: Map<number, { rank: number; text: string }>
}

/** The grid's size: eleven posters and the page tile, whole rows at three, four and six across. */
const LIMIT = 12
/** Filter chips only once a section has a full grid of titles; a handful needs no sorting. */
const FILTERS_FROM = LIMIT

const BRING: Cta = { label: "Bring your ratings", href: START_HREF.imports }
const RATE: Cta = { label: "Rate a few titles", href: START_HREF.taste }

const ALL: Filter = { key: "all", label: "All", keep: () => true }

/** The same key talkedCards gives a talked-about title. */
const talkedKey = (t: { mediaType: string; tmdbId: number }) => (t.mediaType === "movie" ? 1e12 : 2e12) + t.tmdbId

function divesOf(m: Member, ratings: number): Dive[] {
	const forYou = interleave(m.forYou, m.forYouShows)
	const forming = ratings < PERSONAL_AT
	const lines = new Map((m.talked?.titles ?? []).map((t) => [talkedKey(t), { rank: t.rank, text: why(t) }]))
	return [
		{
			key: "continue",
			label: "Continue watching",
			line: `${m.continueShows.length} ${m.continueShows.length === 1 ? "show" : "shows"}`,
			cards: m.continueShows,
			href: HREF.shows,
			pageName: "My shows",
			counted: true,
			note: "The next episode of each show you're watching",
			empty: {
				title: "No shows yet",
				body: "Track a show and its next episode waits here.",
				ctas: [{ label: "Find a show", href: START_HREF.findShow }, BRING],
			},
			ghost: { label: "Track a show", href: START_HREF.findShow },
		},
		{
			key: "movies",
			label: "Wishlist",
			line: `${m.movies.length} ${m.movies.length === 1 ? "movie" : "movies"}`,
			cards: [...m.movies].sort((a, b) => (b.match ?? 0) - (a.match ?? 0)),
			href: HREF.movies,
			pageName: "My movies",
			counted: true,
			note: "Your Wishlist, best taste match first",
			empty: {
				title: "Your Wishlist is empty",
				body: "Tap Want to See on any movie and it lands here, best match first.",
				ctas: [
					{ label: "Browse Discover", href: START_HREF.discover },
					{ label: "See For you", href: START_HREF.forYou },
				],
			},
			ghost: { label: "Save a movie", href: START_HREF.discover },
			filters: [
				ALL,
				{ key: "short", label: "Under 2 hours", keep: (c) => !!c.runtime && c.runtime < 120 },
				{ key: "long", label: "2 hours or more", keep: (c) => !!c.runtime && c.runtime >= 120 },
			],
		},
		{
			key: "forYou",
			label: "For you",
			line: forming ? `${Math.min(ratings, PERSONAL_AT)} of ${PERSONAL_AT} ratings` : "Your taste",
			cards: forYou,
			href: HREF.forYou,
			pageName: "For you",
			counted: false,
			note: forming ? "First guesses while your taste forms" : "Movies and shows picked for your taste",
			// While forming, the strip is the forming strip (see Strip below), with or without picks.
			empty: { title: "", body: "", ctas: [] },
			ghost: { label: "Rate more to unlock", href: START_HREF.taste },
			filters: [
				ALL,
				{ key: "movie", label: "Movies", keep: (c) => c.media_type === "movie" },
				{ key: "show", label: "Shows", keep: (c) => c.media_type === "show" },
			],
		},
		{
			key: "hot",
			label: "Hot on socials",
			line: m.hot.length ? `Top ${m.hot.length} right now` : "Nothing yet",
			cards: m.hot,
			href: HREF.hot,
			pageName: "Hot on socials",
			counted: false,
			note: "Most talked about right now, and why",
			empty: {
				title: "Nothing measured yet today",
				body: "The ranking updates once a day.",
				ctas: [{ label: "Open Hot on socials", href: HREF.hot }],
			},
			ghost: null,
			lines,
		},
	]
}

/** The site's text link, with an arrow that moves on hover. */
const TEXT_LINK =
	"group inline-flex shrink-0 items-center gap-1 rounded-md text-sm font-semibold text-amber-400 underline-offset-4 outline-none hover:text-amber-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
const ARROW =
	"h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1"

const DOOR =
	"relative flex h-[6.5rem] w-full sm:h-28 flex-col justify-between gap-2 rounded-xl p-3 text-left outline-none transition-[opacity,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:scale-[0.98] sm:p-4"
/** The open door: amber-tinted fill, a strong amber ring. */
const DOOR_OPEN = "bg-amber-400/[0.16] ring-2 ring-amber-400 shadow-lg shadow-amber-950/40"
/** The closed doors: quieter while another is open, full strength on hover or focus. */
const DOOR_SHUT =
	"cursor-pointer bg-white/[0.05] ring-1 ring-white/5 opacity-60 hover:bg-white/10 hover:opacity-100 hover:ring-white/20 focus-visible:opacity-100"

/** A door's line when its section has no titles. */
const EMPTY_LINE: Record<Open, string> = {
	continue: "No shows yet",
	movies: "Nothing saved yet",
	forYou: "Needs ratings",
	hot: "Nothing yet",
}

export function Doors({ m, className = "" }: { m: Member; className?: string }) {
	const ratings = useLab().data.member?.ratings ?? 0
	/*
	 * The doors follow what the member has. Sections with titles come first, in their usual order (Continue,
	 * Wishlist, For you, Hot on socials), then sections with nothing in them yet, still in that order. The first
	 * section with titles is open on load; when none has any, the first door (Continue) is open and shows its empty
	 * state. An empty door still opens, to say why it's empty and where to go next. With the owner's data every
	 * section has titles, so the order and the open door are what they were.
	 */
	const all = divesOf(m, ratings)
	const dives = [...all.filter((d) => d.cards.length), ...all.filter((d) => !d.cards.length)]
	// One door is always open; decided from the data alone, so the server renders the same section.
	const [open, setOpen] = useState<Open>(dives[0].key)
	const [filter, setFilter] = useState("all")
	const [first, setFirst] = useState(true)
	const cur = dives.find((d) => d.key === open) ?? dives[0]
	const forming = cur.key === "forYou" && ratings < PERSONAL_AT
	const filters = cur.filters && cur.cards.length >= FILTERS_FROM ? cur.filters : null
	const f = filters?.find((x) => x.key === filter) ?? ALL
	const shown = cur.cards.filter(f.keep)
	const has = cur.cards.length > 0

	const door = (d: Dive) => {
		const on = open === d.key
		const filled = d.cards.length > 0
		return (
			<li key={d.key} className="relative min-w-0">
				<button
					type="button"
					aria-expanded={on}
					aria-controls="cd-dive"
					onClick={() => {
						if (on) return
						setOpen(d.key)
						setFilter("all")
						setFirst(false)
					}}
					className={`${DOOR} ${on ? DOOR_OPEN : DOOR_SHUT}`}
				>
					<span className={`shrink-0 truncate text-base font-bold ${on ? "text-amber-100" : "text-white"}`}>{d.label}</span>
					<span className="flex items-end justify-between gap-2">
						<span className={`line-clamp-1 text-xs ${on ? "font-semibold text-amber-300" : "text-gray-400"}`}>
							{filled ? d.line : d.key === "forYou" && ratings > 0 ? d.line : EMPTY_LINE[d.key]}
						</span>
						{filled ? <Few cards={d.cards} /> : null}
					</span>
				</button>
				{/* The notch from the open door down into its section (one row of doors on desktop only). */}
				{on ? (
					<motion.span
						layoutId="cd-notch"
						aria-hidden
						transition={{ duration: 0.25, ease: EASE }}
						className="pointer-events-none absolute left-1/2 top-full z-10 mt-[17px] hidden h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-amber-400 bg-gray-900 lg:block"
					/>
				) : null}
			</li>
		)
	}

	return (
		<section className={`${WRAP} ${className}`} aria-labelledby="cd-doors">
			<h2 id="cd-doors" className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
				Go deeper
			</h2>
			<ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">{dives.map(door)}</ul>

			{/* The open section: a gray-900 panel whose amber top edge meets the notch. */}
			<div
				id="cd-dive"
				className="-mx-4 mt-5 border-t-2 border-amber-400 bg-gray-900 px-4 pt-5 pb-6 ring-1 ring-white/5 sm:mx-0 sm:rounded-2xl sm:px-6 lg:mt-6"
			>
				{/* A new section swaps in at once and fades up, so the panel never collapses between sections. */}
				<motion.div
					key={cur.key}
					initial={first ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2, ease: EASE }}
				>
					<div className="mb-4">
						<div className="flex items-baseline justify-between gap-3">
							<h3 className={`${DISPLAY} min-w-0 truncate text-2xl leading-tight text-white sm:text-3xl`}>{cur.label}</h3>
							{has ? (
								<Link to={cur.href} prefetch="intent" className={TEXT_LINK}>
									<span>
										<span className="max-sm:hidden">Open </span>
										{cur.pageName}
									</span>
									<ArrowRightIcon aria-hidden className={`${ARROW} self-center`} />
								</Link>
							) : null}
						</div>
						{has ? <p className="mt-0.5 text-sm text-gray-400">{cur.note}</p> : null}
					</div>

					{forming ? (
						<Strip title={`Picks get personal at ${PERSONAL_AT} ratings`} progress={ratings} ctas={[RATE, BRING]} />
					) : !has ? (
						<Strip title={cur.empty.title} body={cur.empty.body} ctas={cur.empty.ctas} />
					) : null}

					{filters ? (
						<div
							className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
							role="group"
							aria-label="Filter"
						>
							{filters.map((x) => (
								<button
									key={x.key}
									type="button"
									aria-pressed={f.key === x.key}
									onClick={() => setFilter(x.key)}
									className={`${CHIP} ${chipTone(f.key === x.key)}`}
								>
									{x.label}
									<span className={`ml-1.5 tabular-nums ${f.key === x.key ? "text-gray-950/60" : "text-gray-500"}`}>
										{cur.cards.filter(x.keep).length}
									</span>
								</button>
							))}
						</div>
					) : null}

					{has ? <DiveGrid dive={cur} cards={shown} filtered={f.key !== "all"} /> : null}
				</motion.div>
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The grid: whole rows at every width
// ---------------------------------------------------------------------------------------------------------

/** Columns at the three widths the grid has: phones, tablets (sm), desktops (lg). */
const COLS = [3, 4, 6] as const

type Plan = { posters: number; ghosts: number; tile: boolean }

/**
 * How many posters, ghosts and the end tile one width shows, so the last row is always full:
 * - a full section: eleven posters and the tile (two rows on desktop, three on tablets, four on phones);
 * - a short section with an "add more" ghost: every poster, then ghosts up to the end of the row, then the tile
 *   (one row of up to a few titles: the rest of it; under a full row, at most a couple, else the posters shrink to
 *   fit the tile into the rows they fill);
 * - a short section without one (Hot on socials): as many posters as fill whole rows with the tile, the rest wait
 *   behind the tile;
 * - an empty section: nothing; the strip above says it all (a row of ghosts alone looked unfinished).
 */
function plan(n: number, cols: number, ghost: boolean): Plan {
	if (n === 0) return { posters: 0, ghosts: 0, tile: false }
	if (n >= LIMIT - 1) return { posters: LIMIT - 1, ghosts: 0, tile: true }
	if (ghost) {
		const slots = Math.ceil((n + 1) / cols) * cols
		const ghosts = slots - n - 1
		// A row that would be mostly ghosts under full rows of posters reads as missing titles: shrink instead.
		if (n >= cols && ghosts >= cols / 2) return { posters: slots - cols - 1, ghosts: 0, tile: true }
		return { posters: n, ghosts, tile: true }
	}
	if (n + 1 <= cols) return { posters: n, ghosts: 0, tile: true }
	return { posters: Math.floor((n + 1) / cols) * cols - 1, ghosts: 0, tile: true }
}

/** Shown or hidden at each width, as literal classes so Tailwind keeps them. */
const vis = ([base, sm, lg]: boolean[]) =>
	`${base ? "" : "hidden"} ${sm ? "sm:block" : "sm:hidden"} ${lg ? "lg:block" : "lg:hidden"}`

/** Ghosts fade as they go, so a short row reads as "room for more", not as missing posters. */
const GHOST_FADE = ["", "opacity-70", "opacity-50", "opacity-40", "opacity-30", "opacity-25"]

function DiveGrid({ dive, cards, filtered }: { dive: Dive; cards: LabCard[]; filtered: boolean }) {
	const n = cards.length
	// A filtered view isn't the member's whole list, so it never asks for more; it only keeps whole rows.
	const ghost = filtered ? null : dive.ghost
	const plans = COLS.map((c) => plan(n, c, !!ghost))
	const maxPosters = Math.max(...plans.map((p) => p.posters))
	const maxGhosts = Math.max(...plans.map((p) => p.ghosts))
	const tile = tileText(dive, n)
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
			{cards.slice(0, maxPosters).map((card, i) => {
				const line = dive.lines?.get(card.key)
				return (
					<li key={card.key} className={`min-w-0 ${vis(plans.map((p) => i < p.posters))}`}>
						<Poster card={card} />
						{line ? (
							<p className="mt-1.5 flex min-w-0 items-baseline gap-1.5 text-xs" title={line.text}>
								<span className="shrink-0 font-black tabular-nums text-amber-400">{line.rank}</span>
								<span className="line-clamp-2 leading-snug text-gray-300">{line.text}</span>
							</p>
						) : null}
					</li>
				)
			})}
			{ghost
				? Array.from({ length: maxGhosts }, (_, i) => (
						<li key={`ghost${i}`} className={`min-w-0 ${vis(plans.map((p) => i < p.ghosts))} ${GHOST_FADE[i] ?? "opacity-25"}`}>
							<Ghost cta={ghost} labeled={i === 0} />
						</li>
					))
				: null}
			{plans.some((p) => p.tile) ? (
				<li className={`min-w-0 ${vis(plans.map((p) => p.tile))}`}>
					<Link
						to={dive.href}
						prefetch="intent"
						className="group flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-gray-800 bg-gray-950/60 p-2 text-center outline-none transition-colors hover:border-amber-400/70 hover:bg-amber-400/[0.08] focus-visible:border-amber-300"
					>
						<span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950 sm:h-12 sm:w-12">
							<ArrowRightIcon aria-hidden className="h-5 w-5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
						</span>
						<span className="text-sm font-bold leading-tight text-white">{tile.top}</span>
						<span className="text-xs leading-tight text-gray-400">{tile.sub}</span>
					</Link>
				</li>
			) : null}
		</ul>
	)
}

/** The end tile's two lines: a count only when the tile stands for more titles than the grid shows. */
function tileText(dive: Dive, n: number): { top: string; sub: string } {
	const total = dive.cards.length
	if (dive.key === "hot") return { top: "See all", sub: `on ${dive.pageName}` }
	if (!dive.counted) return { top: "More", sub: `in ${dive.pageName}` }
	if (total >= LIMIT - 1 || total > n) return { top: `See all ${total}`, sub: `in ${dive.pageName}` }
	return { top: "Open", sub: dive.pageName }
}

/** The "add more" placeholder: a dashed poster-shaped slot; the first carries the label and is the link. */
function Ghost({ cta, labeled }: { cta: Cta; labeled: boolean }) {
	const box =
		"flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-800 p-2 text-center"
	const plus = (
		<span className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 ring-1 ring-gray-700 transition-colors group-hover:text-amber-400 group-hover:ring-amber-400/50 sm:h-10 sm:w-10">
			<PlusIcon aria-hidden className="h-5 w-5" />
		</span>
	)
	if (!labeled) return <div aria-hidden className={box}>{plus}</div>
	return (
		<Link
			to={cta.href}
			prefetch="intent"
			className={`group ${box} outline-none transition-colors hover:border-amber-400/50 hover:bg-amber-400/[0.05] focus-visible:border-amber-300`}
		>
			{plus}
			<span className="text-xs font-semibold leading-tight text-gray-400 group-hover:text-gray-200">{cta.label}</span>
		</Link>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The strip: one slim full-width line above the grid
// ---------------------------------------------------------------------------------------------------------

const PILL_SM =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-black text-gray-950 hover:bg-amber-300 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
const PILL_GHOST_SM =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold text-gray-200 ring-1 ring-inset ring-white/15 hover:bg-white/5 hover:text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

/**
 * Why a section is empty or still forming, and the way forward: the message (and the ratings bar) on the left,
 * the CTAs compact on the right; stacked on phones.
 */
function Strip({ title, body, progress, ctas }: { title: string; body?: string; progress?: number; ctas: Cta[] }) {
	const have = progress === undefined ? 0 : Math.min(progress, PERSONAL_AT)
	return (
		<div className="mb-5 flex flex-col gap-3 rounded-xl bg-white/[0.035] px-4 py-3 ring-1 ring-white/10 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
			<div className="min-w-0 flex-1">
				<p className="text-sm font-bold text-white sm:text-[15px]">{title}</p>
				{body ? <p className="mt-0.5 text-sm text-gray-400">{body}</p> : null}
				{progress !== undefined ? (
					<p className="mt-1.5 flex items-center gap-2.5">
						<span className="h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-white/10" aria-hidden>
							<span className="block h-full rounded-full bg-amber-400" style={{ width: `${(have / PERSONAL_AT) * 100}%` }} />
						</span>
						<span className="shrink-0 text-xs font-semibold tabular-nums text-amber-300">
							{have} of {PERSONAL_AT} ratings
						</span>
					</p>
				) : null}
			</div>
			<div className="flex gap-2">
				{ctas.map((c, i) => (
					<Link key={c.href} to={c.href} prefetch="intent" className={`${i === 0 ? PILL_SM : PILL_GHOST_SM} max-sm:flex-1 max-sm:px-2`}>
						{c.label}
						{i === 0 ? <ArrowRightIcon aria-hidden className="h-4 w-4 max-sm:hidden" /> : null}
					</Link>
				))}
			</div>
		</div>
	)
}

function Few({ cards }: { cards: LabCard[] }) {
	const few = cards.filter((c) => c.poster_path).slice(0, 3)
	return (
		<span className="flex shrink-0 -space-x-2">
			{few.map((c) => (
				<img
					key={c.key}
					src={posterSrc(c)}
					alt=""
					loading="lazy"
					className="aspect-[2/3] w-7 rounded object-cover ring-2 ring-gray-900 sm:w-8"
				/>
			))}
		</span>
	)
}
