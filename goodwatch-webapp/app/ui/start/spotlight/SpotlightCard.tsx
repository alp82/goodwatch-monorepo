// The start page's spotlight card (docs/implementation/start-page-redesign.md, "Spotlight card"): one fixed box per
// breakpoint (spotlight.css), so nothing shifts between its states. The states crossfade in place:
//
// - Before any choice: a dimmed fan of start titles behind "Start with a mood or a search" and Surprise me.
// - Tap three: the results as whole poster toggles (poster-fit.ts, PosterPager.tsx). The first loved dims the rest;
//   three Loved slots sit in the header. The line says what's on show; See all goes to Discover with the query.
//   While the titles load the row is a skeleton; an error shows its message with Retry; nothing found says so, with
//   one tap to drop the moods (Discover filters strictly, so a search plus moods can leave nothing).
// - For you: ForYouPanel, with Back to the titles.
import { HeartIcon, InformationCircleIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	type CSSProperties,
	type ReactNode,
	Suspense,
	lazy,
	useEffect,
	useMemo,
	useState,
} from "react"
import { WORDS } from "~/domain/taste-picker"
import type { TitleCard } from "~/server/title-cards.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titlePath } from "~/utils/helpers"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { picksLine } from "../moods/mixes"
import { seeAllHref } from "../search/start-search"
import {
	LOVED_NEEDED,
	type StartQuery,
	type StartResults,
	type StartView,
} from "../stage/start-query"
import type { StartQueryState } from "../stage/useStartQuery"
import { ForYouSkeleton } from "./ForYouSkeleton"
import { LovedSlots } from "./LovedSlots"
import { EdgeArrows, PageDots, SmallArrows, usePager } from "./PosterPager"
import type { LovedThreeState } from "./useLovedThree"

// For you shows only after three loved titles, so its code loads on first use: fetched once the first title is loved,
// shown as its skeleton (the same box) until it's there.
const importForYouPanel = () => import("./ForYouPanel")
const ForYouPanel = lazy(
	reloadOnStaleChunk(() =>
		importForYouPanel().then((m) => ({ default: m.ForYouPanel })),
	),
)
let forYouPreloaded = false
function preloadForYouPanel() {
	if (forYouPreloaded) return
	forYouPreloaded = true
	// A failure here is left to the lazy load, which reloads a tab that outlived a deploy.
	void importForYouPanel().catch(() => {})
}

/** The card's heading per step. */
export const TAP_THREE = "Tap three you loved"
export const FOR_YOU = "For you"

const MOOD_IDS = WORDS.filter((w) => w.kind === "mood").map((w) => w.id)

/** Surprise me: a random mood, never the one picked alone now. */
export function surpriseMood(
	picks: readonly string[],
	random: () => number = Math.random,
): string {
	const now = picks.length === 1 ? picks[0] : null
	const pool = MOOD_IDS.filter((id) => id !== now)
	return pool[Math.floor(random() * pool.length)] ?? MOOD_IDS[0]
}

const shortTitle = (title: string) => title.replace(/:.*$/, "")

/** "A", "A and B", "A, B and C". */
export const joinNames = (names: readonly string[]) =>
	names.length < 2
		? names.join("")
		: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`

/**
 * What's on show, in a few words: the searched text and the picks' names, a whole mix by its name ("rainy day
 * whodunit · Funny", "Warm, easy comedies · Animated").
 */
export function shownLabel(query: Pick<StartQuery, "text" | "picks">) {
	return [query.text, picksLine(query.picks)].filter(Boolean).join(" · ")
}

export function SpotlightCard({
	start,
	results,
	view,
	loved,
	fan,
}: {
	start: StartQueryState
	results: StartResults & { retry: () => void }
	view: StartView
	loved: LovedThreeState
	/** The start titles, for the fan before any choice. */
	fan: readonly StartTitle[]
}) {
	const { query } = start
	const [roll, setRoll] = useState(0)
	const surprise = () => {
		setRoll((r) => r + 1)
		start.clearSearch()
		start.setPicks([surpriseMood(query.picks)])
	}
	const forYou = view === "forYou"
	const anyLoved = loved.loved.length > 0
	useEffect(() => {
		if (anyLoved) preloadForYouPanel()
	}, [anyLoved])
	const tapping = view === "results" || view === "loading"
	return (
		<div className="spotlight">
			<div
				aria-hidden
				className="spotlight-halo"
				{...(view === "empty" ? {} : { "data-lit": "" })}
			/>
			<div className="spotlight-card">
				<div className="spotlight-head spotlight-pad">
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
							<h2
								key={forYou ? "for-you" : "tap-three"}
								className="spotlight-in spotlight-title min-w-0 truncate font-extrabold tracking-tight text-white"
							>
								{forYou ? FOR_YOU : TAP_THREE}
							</h2>
							{forYou ? null : (
								<Dice roll={roll} onRoll={surprise} away={view === "empty"} />
							)}
						</div>
						<div className="mt-0.5 flex min-w-0 text-[13px] leading-5 text-gray-300 sm:mt-1 sm:text-sm">
							<span className="min-w-0 truncate">
								<CardLine
									view={view}
									query={query}
									results={results}
									loved={loved}
								/>
							</span>
						</div>
					</div>
					{forYou ? (
						<button
							type="button"
							onClick={loved.reset}
							aria-label={`Back to ${TAP_THREE.toLowerCase()}`}
							className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:px-3"
						>
							<span aria-hidden>←&nbsp;</span>Back
						</button>
					) : view === "results" && results.cards.length ? (
						<SeeAll href={seeAllHref(query)} className="max-sm:hidden" />
					) : null}
					<LovedSlots loved={loved.loved} onUndo={loved.toggle} />
				</div>
				<div className="relative min-h-0 flex-1">
					<Layer on={view === "empty"} from="up">
						<EmptyFan
							fan={fan}
							lovedCount={loved.loved.length}
							roll={roll}
							onRoll={surprise}
							on={view === "empty"}
						/>
					</Layer>
					<Layer on={tapping} from="down">
						{tapping ? (
							<ResultsBody
								view={view}
								query={query}
								results={results}
								loved={loved}
								onDropMoods={start.clearPicks}
							/>
						) : null}
					</Layer>
					<Layer on={forYou} from="down">
						{forYou ? (
							<Suspense fallback={<ForYouSkeleton />}>
								<ForYouPanel picks={loved.picks} onStartOver={loved.reset} />
							</Suspense>
						) : null}
					</Layer>
				</div>
			</div>
		</div>
	)
}

/** One state of the card's body: shown, or faded out of reach. */
function Layer({
	on,
	from,
	children,
}: {
	on: boolean
	from: "up" | "down"
	children: ReactNode
}) {
	return (
		<div
			className="spotlight-layer"
			data-from={from}
			{...(on ? { "data-on": "" } : { inert: "", "aria-hidden": true })}
		>
			{children}
		</div>
	)
}

/** The one line under the heading: why these picks, what's loading, what's loved so far, or what's on show. */
function CardLine({
	view,
	query,
	results,
	loved,
}: {
	view: StartView
	query: StartQuery
	results: StartResults
	loved: LovedThreeState
}) {
	const names = loved.loved.map((c) => shortTitle(c.title))
	if (view === "forYou")
		return (
			<>
				Because you loved{" "}
				<b className="font-semibold text-white">{joinNames(names)}</b>
			</>
		)
	if (view === "loading")
		return (
			<span className="inline-flex items-center gap-2 text-gray-400">
				<span
					className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"
					aria-hidden
				/>
				{query.text ? "Reading your search…" : "Finding titles…"}
			</span>
		)
	if (names.length)
		return (
			<>
				Loved <b className="font-semibold text-white">{joinNames(names)}</b> ·{" "}
				{LOVED_NEEDED - names.length} more
			</>
		)
	if (view === "empty") return <>Then get picks for you.</>
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			<b className="truncate font-semibold text-white">{shownLabel(query)}</b>
			{results.status === "ready" && results.cards.length ? (
				<span className="shrink-0 text-gray-400 max-sm:hidden">
					·{" "}
					<InformationCircleIcon
						className="inline h-4 w-4 -translate-y-px align-middle text-gray-300"
						aria-label="The info button"
					/>{" "}
					opens a title
				</span>
			) : null}
		</span>
	)
}

/** A die showing five, for Surprise me. */
function DieIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			className={className}
			aria-hidden="true"
			fill="none"
		>
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
				rx="3.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			{[
				[6.6, 6.6],
				[13.4, 6.6],
				[10, 10],
				[6.6, 13.4],
				[13.4, 13.4],
			].map(([cx, cy]) => (
				<circle
					key={`${cx}-${cy}`}
					cx={cx}
					cy={cy}
					r="1.35"
					fill="currentColor"
				/>
			))}
		</svg>
	)
}

/**
 * Surprise me beside the heading: icon-led and compact; the die rolls on a tap. `away` while the empty state shows its
 * own big button: it keeps its room, unseen and out of reach.
 */
function Dice({
	roll,
	onRoll,
	away,
}: {
	roll: number
	onRoll: () => void
	away: boolean
}) {
	return (
		<button
			type="button"
			disabled={away}
			aria-hidden={away || undefined}
			tabIndex={away ? -1 : undefined}
			onClick={onRoll}
			aria-label="Surprise me: a random mood"
			title="Surprise me"
			style={{ opacity: away ? 0 : 1 }}
			className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.07] px-1.5 text-[13px] font-semibold text-gray-200 ring-1 ring-white/12 outline-none transition-[opacity,background-color,color] duration-300 hover:bg-amber-400/15 hover:text-white hover:ring-amber-400/40 focus-visible:ring-2 focus-visible:ring-amber-400 sm:pr-3 sm:pl-2 sm:text-sm"
		>
			<span
				key={roll}
				className={`grid place-items-center ${roll ? "spotlight-roll" : ""}`}
			>
				<DieIcon className="h-[18px] w-[18px] text-amber-400" />
			</span>
			<span className="max-sm:hidden">Surprise me</span>
		</button>
	)
}

/** See all: Discover with the search's text and the picks. */
function SeeAll({
	href,
	className = "",
}: { href: string; className?: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:px-3 ${className}`}
		>
			See all<span aria-hidden>&nbsp;→</span>
		</Link>
	)
}

/** The fan's posters run -FAN_HALF..FAN_HALF from the middle. */
const FAN_HALF = 5

/**
 * Before any choice: start titles fanned in a shallow bowl (each placed from its own size, so it fits every
 * breakpoint), dimmed, behind a short headline, one line and Surprise me. It fills exactly the box the posters take.
 */
function EmptyFan({
	fan,
	lovedCount,
	roll,
	onRoll,
	on,
}: {
	fan: readonly StartTitle[]
	lovedCount: number
	roll: number
	onRoll: () => void
	on: boolean
}) {
	const posters = useMemo(
		() => fan.filter((t) => t.poster_path).slice(0, FAN_HALF * 2 + 1),
		[fan],
	)
	return (
		<div className="absolute inset-0 overflow-clip">
			<div aria-hidden className="absolute inset-0">
				{posters.map((t, i) => {
					const d = i - FAN_HALF
					return (
						<img
							key={`${t.media_type}:${t.tmdb_id}`}
							src={tmdbImageUrl(t.poster_path as string, "w342")}
							alt=""
							loading="lazy"
							decoding="async"
							fetchPriority="low"
							draggable={false}
							className="spotlight-fan aspect-[2/3] rounded-lg object-cover shadow-[0_18px_40px_rgb(0_0_0/.6)] ring-1 ring-white/10"
							style={
								{
									"--fan-x": `${d * 74}%`,
									"--fan-y": `${48 - d * d * 1.9}%`,
									"--fan-r": `${-d * 2.2}deg`,
									zIndex: 10 - Math.abs(d),
									opacity: d === 0 ? 0.4 : 0.5,
								} as CSSProperties
							}
						/>
					)
				})}
			</div>
			<div aria-hidden className="spotlight-fan-dim" />
			<div className="relative z-30 flex flex-col items-center px-4 pt-4 text-center sm:pt-7 lg:pt-9">
				<h3 className="font-['Gabarito'] text-[22px] font-black leading-7 tracking-[-0.03em] text-white sm:text-[28px] sm:leading-9 lg:text-[34px] lg:leading-10">
					{lovedCount
						? `${LOVED_NEEDED - lovedCount} more to go`
						: "Start with a mood or a search"}
				</h3>
				<p className="mt-1 text-[14px] leading-5 text-gray-300 sm:mt-1.5 lg:text-[15px] lg:leading-6">
					Search above, pick a mood, or roll the dice.
				</p>
				<button
					type="button"
					tabIndex={on ? undefined : -1}
					onClick={onRoll}
					className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-amber-400 pr-5 pl-4 text-[14px] font-black text-gray-950 shadow-[0_8px_28px_rgb(251_191_36/.28)] outline-none transition-colors hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white sm:mt-4 sm:min-h-11 lg:mt-5 lg:text-[15px]"
				>
					<span
						key={roll}
						className={`grid place-items-center ${roll ? "spotlight-roll" : ""}`}
					>
						<DieIcon className="h-5 w-5" />
					</span>
					Surprise me
				</button>
			</div>
		</div>
	)
}

/** The tap-three body: the skeleton, the error with Retry, the empty answer, or the whole-poster row. */
function ResultsBody({
	view,
	query,
	results,
	loved,
	onDropMoods,
}: {
	view: StartView
	query: StartQuery
	results: StartResults & { retry: () => void }
	loved: LovedThreeState
	onDropMoods: () => void
}) {
	if (view === "loading")
		return (
			<div aria-hidden className="start-results absolute inset-0">
				<div className="start-results-box relative h-full">
					<div className="start-results-row flex overflow-hidden pt-3.5 pb-2.5">
						{Array.from({ length: 12 }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className="start-results-c"
							>
								<div
									className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/80"
									style={{ animationDelay: `${i * 80}ms` }}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		)
	if (results.status === "error")
		return (
			<Answer>
				<p className="text-[15px] font-semibold text-white sm:text-lg">
					{results.error}
				</p>
				<button
					type="button"
					onClick={results.retry}
					className="inline-flex h-9 cursor-pointer items-center rounded-full bg-amber-400 px-4 text-sm font-bold text-gray-950 hover:bg-amber-300"
				>
					Retry
				</button>
			</Answer>
		)
	if (!results.cards.length) {
		const moods = query.picks.length > 0
		return (
			<Answer>
				<p className="text-[15px] font-semibold text-white sm:text-lg">
					{moods && query.text
						? "Nothing matches all of these"
						: moods
							? "Nothing matches these moods"
							: `Nothing found for “${query.text}”`}
				</p>
				{moods ? (
					<button
						type="button"
						onClick={onDropMoods}
						className="inline-flex h-9 cursor-pointer items-center rounded-full bg-gray-800 px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-gray-700"
					>
						{query.text ? "Search without the moods" : "Clear the moods"}
					</button>
				) : (
					<p className="text-sm text-gray-400">Try other words or a mood.</p>
				)}
			</Answer>
		)
	}
	return (
		<PosterRow
			key={results.signature}
			cards={results.cards}
			loved={loved}
			seeAll={seeAllHref(query)}
		/>
	)
}

function Answer({ children }: { children: ReactNode }) {
	return (
		<div
			aria-live="polite"
			className="spotlight-in absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
		>
			{children}
		</div>
	)
}

/**
 * The results as whole posters: the row snaps to every poster; at most two views, See all counting as one tile. From
 * 640 px round arrows over the first and last poster; on phones the page dots and small arrows under the posters.
 * The posters' middle is the row's top room (14 px) plus 3/4 of a poster's width.
 */
function PosterRow({
	cards,
	loved,
	seeAll,
}: {
	cards: readonly TitleCard[]
	loved: LovedThreeState
	seeAll: string
}) {
	const nav = usePager()
	const count = loved.loved.length
	const full = count >= LOVED_NEEDED
	return (
		<div className="start-results absolute inset-0">
			<div className="start-results-box relative h-full">
				<div
					ref={nav.ref}
					className="start-results-row spotlight-in flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pt-3.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{cards.slice(0, nav.cap(1)).map((card, i) => {
						const on = loved.isLoved(card)
						return (
							<div
								key={card.key}
								className={`start-results-c snap-start ${count && !full && !on ? "spotlight-dim" : ""}`}
							>
								<LovedToggle
									card={card}
									on={on}
									full={full}
									onToggle={() => loved.toggle(card)}
									priority={i < 8}
								/>
							</div>
						)
					})}
					<div className="start-results-c flex aspect-[2/3] snap-start items-center justify-center rounded-lg ring-1 ring-white/10 ring-inset">
						<SeeAll href={seeAll} />
					</div>
				</div>
				<EdgeArrows
					nav={nav}
					name="results"
					className="max-sm:hidden"
					top="calc(14px + var(--poster-w) * .75)"
				/>
				<div className="absolute inset-x-0 bottom-0 flex h-[42px] items-center justify-between px-4 pb-2.5 sm:hidden">
					<PageDots nav={nav} />
					<SmallArrows nav={nav} name="results" />
				</div>
			</div>
		</div>
	)
}

/**
 * A real poster card that is itself the "loved it" toggle: a tap rings it, pops a heart and lifts it; a second tap
 * undoes. The small info button opens the title page (shown on hover with a pointer, always on touch).
 */
function LovedToggle({
	card,
	on,
	full,
	onToggle,
	priority,
}: {
	card: TitleCard
	on: boolean
	/** Three are loved: the others can't be tapped. */
	full: boolean
	onToggle: () => void
	priority?: boolean
}) {
	const off = full && !on
	return (
		<div
			className="loved-toggle relative w-full"
			{...(on ? { "data-on": "" } : {})}
			{...(off ? { "data-off": "" } : {})}
		>
			<div className="loved-lift">
				<TitlePosterCard
					card={card}
					actions={false}
					posterPriority={priority ? "high" : undefined}
				/>
				<button
					type="button"
					className="loved-tap"
					aria-pressed={on}
					disabled={off}
					aria-label={`Loved ${card.title}`}
					onClick={onToggle}
				/>
				<span className="loved-ring" aria-hidden />
				<span className="loved-badge" aria-hidden>
					<HeartIcon className="h-4 w-4" />
				</span>
				<Link
					to={titlePath(card.media_type, card.tmdb_id, card.title)}
					prefetch="none"
					aria-label={`Open ${card.title}`}
					className="loved-info absolute top-1 left-1 z-[31] flex h-7 w-7 items-center justify-center rounded-full bg-gray-950/80 text-gray-100 ring-1 ring-white/25 outline-none hover:bg-gray-900 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-8 sm:w-8"
				>
					<InformationCircleIcon className="h-5 w-5" aria-hidden />
				</Link>
			</div>
		</div>
	)
}
