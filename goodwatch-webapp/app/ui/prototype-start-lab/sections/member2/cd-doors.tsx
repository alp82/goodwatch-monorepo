// PROTOTYPE (start page lab, round 3): member c and d's "Go deeper" doors: one always open (Continue watching on
// load, rendered on the server), the open door filled amber with a notch into its section; the section links to
// its page from its header and from a last "See all" tile; Hot on socials is a door only. Round 4: the doors follow
// what the member has (sections with titles first), with empty, still-forming and few-titles states and their CTAs.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { EASE } from "~/ui/watch-next/style"
import { type LabCard, useLab } from "../../lab/types"
import { CHIP, chipTone } from "../hero/shared"
import {
	DISPLAY,
	HREF,
	type Member,
	Poster,
	WRAP,
	interleave,
	posterSrc,
} from "../member/shared"
import { PERSONAL_AT, PILL, PILL_GHOST, Progress, START_HREF } from "./cd-shared"

type Open = "continue" | "movies" | "forYou"

type Filter = { key: string; label: string; keep: (c: LabCard) => boolean }

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
	/** What the section says when it has no titles: why it's empty and where to go. */
	empty: { title: string; body: string; ctas: Cta[] }
	/** The line under a short list (fewer than a row of titles), nudging the member to add more. */
	nudge: { body: string; ctas: Cta[] }
}

type Cta = { label: string; href: string }

/** Fewer titles than this is "a few": no filters, no See all tile, a short row and a nudge instead of a grid. */
const SPARSE_BELOW = 6

const BRING: Cta = { label: "Bring your ratings", href: START_HREF.imports }

const ALL: Filter = { key: "all", label: "All", keep: () => true }

function divesOf(m: Member, ratings: number): Dive[] {
	const forYou = interleave(m.forYou, m.forYouShows)
	const forming = ratings < PERSONAL_AT
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
				body: "Shows you track show up here with their next episode, so you can pick up where you left off.",
				ctas: [{ label: "Find a show", href: START_HREF.findShow }, BRING],
			},
			nudge: {
				body: "Track more shows and their next episodes line up here.",
				ctas: [{ label: "Find a show", href: START_HREF.findShow }],
			},
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
				body: "Tap Want to See on any movie to save it for later. It shows up here, best match first.",
				ctas: [
					{ label: "Browse Discover", href: START_HREF.discover },
					{ label: "See For you", href: START_HREF.forYou },
				],
			},
			nudge: {
				body: "Tap Want to See on any movie to add it here.",
				ctas: [{ label: "Browse Discover", href: START_HREF.discover }],
			},
			filters: [
				ALL,
				{
					key: "short",
					label: "Under 2 hours",
					keep: (c) => !!c.runtime && c.runtime < 120,
				},
				{
					key: "long",
					label: "2 hours or more",
					keep: (c) => !!c.runtime && c.runtime >= 120,
				},
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
			note: forming ? "First picks while your taste is still forming" : "Movies and shows picked for your taste",
			// While forming, the section's empty state is the forming card itself (see Forming below).
			empty: { title: "", body: "", ctas: [] },
			nudge: {
				body: "Rate more titles and more picks come in.",
				ctas: [{ label: "Rate a few titles", href: START_HREF.taste }],
			},
			filters: [
				ALL,
				{
					key: "movie",
					label: "Movies",
					keep: (c) => c.media_type === "movie",
				},
				{ key: "show", label: "Shows", keep: (c) => c.media_type === "show" },
			],
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
const DOOR_OPEN =
	"bg-amber-400/[0.16] ring-2 ring-amber-400 shadow-lg shadow-amber-950/40"
/** The closed doors: quieter while another is open, full strength on hover or focus. */
const DOOR_SHUT =
	"cursor-pointer bg-white/[0.05] ring-1 ring-white/5 opacity-60 hover:bg-white/10 hover:opacity-100 hover:ring-white/20 focus-visible:opacity-100"

/** A door's line when its section has no titles. */
const EMPTY_LINE: Record<Open, string> = {
	continue: "No shows yet",
	movies: "Nothing saved yet",
	forYou: "Needs ratings",
}

export function Doors({
	m,
	className = "",
}: { m: Member; className?: string }) {
	const ratings = useLab().data.member?.ratings ?? 0
	/*
	 * The doors follow what the member has. Sections with titles come first, in their usual order (Continue,
	 * Wishlist, For you), then the Hot on socials link, then sections with nothing in them yet, still in that
	 * order. The first section with titles is open on load; when none has any, the first door (Continue) is open
	 * and shows its empty state. An empty door still opens, to say why it's empty and where to go next.
	 * With the owner's data every section has titles, so the order and the open door are what they were.
	 */
	const all = divesOf(m, ratings)
	const dives = [...all.filter((d) => d.cards.length), ...all.filter((d) => !d.cards.length)]
	const filled = dives.filter((d) => d.cards.length)
	const emptyDives = dives.filter((d) => !d.cards.length)
	// One door is always open; decided from the data alone, so the server renders the same section.
	const [open, setOpen] = useState<Open>(dives[0].key)
	const [filter, setFilter] = useState("all")
	const [first, setFirst] = useState(true)
	const cur = dives.find((d) => d.key === open) ?? dives[0]
	const f = cur.filters?.find((x) => x.key === filter) ?? ALL
	const shown = cur.cards.filter(f.keep)
	const sparse = cur.cards.length > 0 && cur.cards.length < SPARSE_BELOW
	const forming = cur.key === "forYou" && ratings < PERSONAL_AT

	const door = (d: Dive) => {
		const on = open === d.key
		const has = d.cards.length > 0
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
							{has ? d.line : d.key === "forYou" && ratings > 0 ? d.line : EMPTY_LINE[d.key]}
						</span>
						{has ? <Few cards={d.cards} /> : null}
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
			<h2
				id="cd-doors"
				className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400"
			>
				Go deeper
			</h2>
			<ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
				{filled.map(door)}
				<li className="min-w-0">
					<Link
						to={HREF.hot}
						prefetch="intent"
						className={`group ${DOOR} ${DOOR_SHUT}`}
					>
						<span className="flex shrink-0 items-center justify-between gap-2 text-base font-bold text-white">
							<span className="truncate">Hot on socials</span>
							<ArrowRightIcon
								aria-hidden
								className={`${ARROW} shrink-0 text-amber-400`}
							/>
						</span>
						<span className="flex items-end justify-between gap-2">
							<span className="line-clamp-1 text-xs text-gray-400">
								This week
							</span>
							<Few cards={m.hot.length ? m.hot : m.popular} />
						</span>
					</Link>
				</li>
				{emptyDives.map(door)}
			</ul>

			{/* The open section: a gray-900 panel whose amber top edge meets the notch. */}
			<div
				id="cd-dive"
				className="-mx-4 mt-5 border-t-2 sm:mx-0 sm:rounded-2xl border-amber-400 bg-gray-900 px-4 pt-5 pb-6 ring-1 ring-white/5 sm:px-6 lg:mt-6"
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
							<h3
								className={`${DISPLAY} min-w-0 truncate text-2xl leading-tight text-white sm:text-3xl`}
							>
								{cur.label}
							</h3>
							{cur.cards.length ? (
								<Link to={cur.href} prefetch="intent" className={TEXT_LINK}>
									<span>
										<span className="max-sm:hidden">Open </span>
										{cur.pageName}
									</span>
									<ArrowRightIcon aria-hidden className={`${ARROW} self-center`} />
								</Link>
							) : null}
						</div>
						{cur.cards.length ? <p className="mt-0.5 text-sm text-gray-400">{cur.note}</p> : null}
					</div>
					{forming ? <Forming ratings={ratings} hasPicks={cur.cards.length > 0} /> : null}
					{!cur.cards.length ? (
						forming ? null : (
							<EmptyState title={cur.empty.title} body={cur.empty.body} ctas={cur.empty.ctas} />
						)
					) : sparse ? (
						<ShortList cards={cur.cards} nudge={forming ? null : cur.nudge} />
					) : (
						<>
					{cur.filters ? (
						<div
							className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
							role="group"
							aria-label="Filter"
						>
							{cur.filters.map((x) => (
								<button
									key={x.key}
									type="button"
									aria-pressed={f.key === x.key}
									onClick={() => setFilter(x.key)}
									className={`${CHIP} ${chipTone(f.key === x.key)}`}
								>
									{x.label}
									<span
										className={`ml-1.5 tabular-nums ${f.key === x.key ? "text-gray-950/60" : "text-gray-500"}`}
									>
										{cur.cards.filter(x.keep).length}
									</span>
								</button>
							))}
						</div>
					) : null}
					<DiveGrid dive={cur} cards={shown} />
						</>
					)}
				</motion.div>
			</div>
		</section>
	)
}

/** Eleven poster cards, then the page as the twelfth tile: two full rows on desktop, three on tablets, four on phones. */
function DiveGrid({ dive, cards }: { dive: Dive; cards: LabCard[] }) {
	const LIMIT = 12
	const few = cards.slice(0, LIMIT - 1)
	const n = dive.cards.length
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
			{few.map((card) => (
				<li key={card.key} className="min-w-0">
					<Poster card={card} />
				</li>
			))}
			<li className="min-w-0">
				<Link
					to={dive.href}
					prefetch="intent"
					className="group flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-gray-800 bg-gray-950/60 p-2 text-center outline-none transition-colors hover:border-amber-400/70 hover:bg-amber-400/[0.08] focus-visible:border-amber-300"
				>
					<span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/40 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950 sm:h-12 sm:w-12">
						<ArrowRightIcon
							aria-hidden
							className="h-5 w-5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
						/>
					</span>
					<span className="text-sm font-bold leading-tight text-white">
						{dive.counted && n ? `See all ${n}` : "More"}
					</span>
					<span className="text-xs leading-tight text-gray-400">
						in {dive.pageName}
					</span>
				</Link>
			</li>
		</ul>
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

/** Two CTAs: the first as the amber pill, the rest quiet. */
function Ctas({ ctas, className = "" }: { ctas: Cta[]; className?: string }) {
	return (
		<div className={`flex flex-wrap gap-2 ${className}`}>
			{ctas.map((c, i) => (
				<Link key={c.href} to={c.href} prefetch="intent" className={i === 0 ? PILL : PILL_GHOST}>
					{c.label}
					{i === 0 ? <ArrowRightIcon aria-hidden className="h-4 w-4" /> : null}
				</Link>
			))}
		</div>
	)
}

/** The For you page's empty card (ForYouPage Unready): a soft panel, a short reason, the way forward. */
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`max-w-xl rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/10 sm:p-6 ${className}`}>{children}</div>
}

function EmptyState({ title, body, ctas }: { title: string; body: string; ctas: Cta[] }) {
	return (
		<Panel>
			<p className="text-base font-bold text-white">{title}</p>
			<p className="mt-1 text-[15px] leading-6 text-gray-300">{body}</p>
			<Ctas ctas={ctas} className="mt-4" />
		</Panel>
	)
}

/** For you below PERSONAL_AT ratings: how far along it is and the two ways to get there. Its picks (if any) follow. */
function Forming({ ratings, hasPicks }: { ratings: number; hasPicks: boolean }) {
	return (
		<Panel className={hasPicks ? "mb-5" : ""}>
			<p className="text-base font-bold text-white">For you is still forming</p>
			<p className="mt-1 text-[15px] leading-6 text-gray-300">
				Picks get personal at {PERSONAL_AT} ratings.
				{hasPicks ? " Until then, these are first guesses." : ""}
			</p>
			<Progress have={ratings} className="mt-3" />
			<Ctas
				ctas={[
					{ label: "Rate a few titles", href: START_HREF.taste },
					{ label: "Bring your ratings", href: START_HREF.imports },
				]}
				className="mt-4"
			/>
		</Panel>
	)
}

/** How many columns the nudge spans after n posters, so the row stays one row (phones: always its own row). */
const SPAN_SM = ["sm:col-span-4", "sm:col-span-3", "sm:col-span-2", "sm:col-span-4", "sm:col-span-4", "sm:col-span-4"]
const SPAN_LG = ["lg:col-span-6", "lg:col-span-5", "lg:col-span-4", "lg:col-span-3", "lg:col-span-2", "lg:col-span-2"]

/**
 * One to a few titles: the same poster cards at the grid's size, and the rest of the row is a nudge to add more
 * (on phones the nudge is its own row under them), so a single title never sits alone in an empty grid.
 */
function ShortList({ cards, nudge }: { cards: LabCard[]; nudge: Dive["nudge"] | null }) {
	const n = cards.length
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
			{cards.map((card) => (
				<li key={card.key} className="min-w-0">
					<Poster card={card} />
				</li>
			))}
			{nudge ? (
				<li className={`col-span-3 min-w-0 ${SPAN_SM[n]} ${n === 5 ? "lg:col-span-6" : SPAN_LG[n]}`}>
					<div className="flex h-full flex-col justify-center rounded-lg border-2 border-dashed border-gray-800 p-4 sm:p-5">
						<p className="text-sm font-bold text-white">
							{n === 1 ? "Just one so far" : `${n} so far`}
						</p>
						<p className="mt-0.5 text-sm text-gray-400">{nudge.body}</p>
						<Ctas ctas={nudge.ctas} className="mt-3" />
					</div>
				</li>
			) : null}
		</ul>
	)
}
