// "This or that" (deck.ts has the rules): two titles from the member's own lists side by side; tapping one keeps it
// and deals a challenger to the other side; three taps give tonight's pick with the Watch button. Neither deals a new
// pair, Start over reshuffles. Nothing is written: a tap only moves the round on.
//
// Every state fills the card's fixed box, and a new title crossfades into the same cell, so nothing changes size.
// Phones show posters; from 640 px the sides show the titles' backdrops.
import { ArrowPathIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import { WatchButton, titleHref } from "~/ui/watch-next/WatchNextHero"
import { offersOf } from "~/ui/watch-next/services"
import { DISPLAY, EASE, backdropUrl, posterUrl } from "~/ui/watch-next/style"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import {
	type DeckTitle,
	type Duel,
	SOURCE_LABEL,
	choose,
	deal,
	neither,
	restart,
	roundsFor,
} from "./deck"
import { MEMBER_HREF } from "./doors"

const QUIET =
	"inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-gray-100 outline-none ring-1 ring-inset ring-white/15 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

export function ThisOrThat({ deck }: { deck: DeckTitle[] }) {
	const [duel, setDuel] = useState<Duel>(() => deal(deck, 0))
	const byKey = useMemo(() => new Map(deck.map((t) => [t.card.key, t])), [deck])
	const of = (key: number | null) =>
		key === null ? null : (byKey.get(key) ?? null)
	const rounds = roundsFor(deck)
	// One title on all of the member's lists: no pair to play, it is simply tonight's pick.
	const only = deck.length === 1 ? deck[0] : null
	const done = of(duel.done)
	const view = only
		? "only"
		: done
			? `done:${done.card.key}`
			: `pair:${duel.epoch}`
	return (
		<div className="relative h-full">
			<AnimatePresence initial={false}>
				<motion.div
					key={view}
					className="absolute inset-0"
					initial={{ opacity: 0, scale: 0.98 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3, ease: EASE }}
				>
					{only ? (
						<TonightsPick pick={only} runnerUp={null} onAgain={null} />
					) : done ? (
						<TonightsPick
							pick={done}
							runnerUp={of(duel.runnerUp)}
							onAgain={() => setDuel(restart(deck, duel))}
						/>
					) : (
						<Pair
							left={of(duel.left)}
							right={of(duel.right)}
							taps={duel.taps}
							rounds={rounds}
							canSkip={deck.length > 2}
							chose={duel.chose}
							onChoose={(side) => setDuel(choose(deck, duel, side))}
							onNeither={() => setDuel(neither(deck, duel))}
							onRestart={() => setDuel(restart(deck, duel))}
						/>
					)}
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function Pair({
	left,
	right,
	taps,
	rounds,
	canSkip,
	chose,
	onChoose,
	onNeither,
	onRestart,
}: {
	left: DeckTitle | null
	right: DeckTitle | null
	taps: number
	rounds: number
	/** Neither needs titles beyond the two on screen; with only two, a link to find more takes its place. */
	canSkip: boolean
	chose: "left" | "right" | null
	onChoose: (side: "left" | "right") => void
	onNeither: () => void
	onRestart: () => void
}) {
	return (
		<div className="start-member-box flex h-full flex-col pt-3">
			<div className="flex h-10 items-center gap-3">
				<h2 className="min-w-0 flex-1 truncate text-base font-bold text-white lg:text-lg">
					This or that?
					{rounds > 1 ? (
						<span className="ml-2 text-sm font-semibold text-gray-400">
							{Math.min(taps + 1, rounds)} of {rounds}
						</span>
					) : null}
				</h2>
				<span className="flex gap-1" aria-hidden>
					{Array.from({ length: rounds }, (_, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: one mark per round
							key={i}
							className={`h-1.5 w-5 rounded-full transition-colors ${i < taps ? "bg-amber-400" : i === taps ? "bg-amber-400/40" : "bg-white/15"}`}
						/>
					))}
				</span>
				<button
					type="button"
					onClick={onRestart}
					aria-label="Start over"
					title="Start over"
					className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 outline-none hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
				>
					<ArrowPathIcon className="h-4 w-4" />
				</button>
			</div>

			<div className="mt-2 grid grid-cols-2 gap-3 lg:gap-6">
				<Side
					title={left}
					side="left"
					nod={chose === "left"}
					onChoose={onChoose}
				/>
				<Side
					title={right}
					side="right"
					nod={chose === "right"}
					onChoose={onChoose}
				/>
			</div>

			<div className="mt-3 flex items-center justify-between gap-3">
				<p className="text-xs text-gray-400 sm:text-sm">
					Tap the one you'd rather watch.
				</p>
				{canSkip ? (
					<button type="button" onClick={onNeither} className={QUIET}>
						Neither
					</button>
				) : (
					<Link to={MEMBER_HREF.discover} prefetch="intent" className={QUIET}>
						Add more
					</Link>
				)}
			</div>
		</div>
	)
}

/** The wide picture: the backdrop, else the poster. */
const artOf = (card: TitleCard) =>
	card.backdrop_path
		? { src: backdropUrl(card.backdrop_path, "w780"), poster: false }
		: { src: posterUrl(card.poster_path, "w780"), poster: true }

/** One side of the pair. A new title crossfades into the same grid cell, so the side never changes size. */
function Side({
	title,
	side,
	nod,
	onChoose,
}: {
	title: DeckTitle | null
	side: "left" | "right"
	nod: boolean
	onChoose: (side: "left" | "right") => void
}) {
	return (
		<div className="grid min-w-0 [&>*]:[grid-area:1/1]">
			<AnimatePresence initial={false}>
				{title ? (
					<motion.button
						key={title.card.key}
						type="button"
						onClick={() => onChoose(side)}
						className="group mx-auto block w-full min-w-0 max-w-[11.25rem] cursor-pointer text-left outline-none sm:max-w-none"
						initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
						animate={
							nod
								? { opacity: 1, x: 0, scale: [1, 1.03, 1] }
								: { opacity: 1, x: 0, scale: 1 }
						}
						exit={{ opacity: 0, scale: 0.94 }}
						transition={{ duration: 0.3, ease: EASE }}
					>
						<Art card={title.card} label={SOURCE_LABEL[title.source]} />
						<span className="mt-2 block h-16 min-w-0 lg:h-[4.5rem]">
							<span
								className="block truncate text-base font-bold text-white lg:text-xl"
								lang={mediaFieldLanguage(title.card)}
							>
								{title.card.title}
							</span>
							<span className="block truncate text-xs font-semibold text-amber-300 lg:text-sm">
								{title.episode ?? title.why}
							</span>
							<span className="block truncate text-xs text-gray-400 lg:text-sm">
								{factsLine(title.card)}
							</span>
						</span>
					</motion.button>
				) : (
					<div
						key="empty"
						className="mx-auto aspect-[2/3] w-full max-w-[11.25rem] rounded-lg border-2 border-dashed border-gray-800 sm:aspect-video sm:max-w-none"
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

/** The side's picture: the poster on phones, the backdrop from 640 px (only the one drawn is fetched). */
function Art({ card, label }: { card: TitleCard; label: string }) {
	const art = artOf(card)
	return (
		<span className="relative block aspect-[2/3] overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 transition-colors group-hover:border-amber-500/70 group-focus-visible:border-amber-400 sm:aspect-video">
			<picture>
				<source media="(min-width: 640px)" srcSet={art.src} />
				<img
					src={posterUrl(card.poster_path, "w342")}
					alt=""
					loading="lazy"
					{...{ fetchpriority: "low" }}
					className={`absolute inset-0 h-full w-full object-cover ${art.poster ? "sm:object-[center_25%]" : ""}`}
				/>
			</picture>
			<span className="absolute left-1.5 top-1.5 rounded-md bg-gray-950/85 px-2 py-0.5 text-xs font-semibold text-gray-100 lg:left-2.5 lg:top-2.5 lg:text-sm">
				{label}
			</span>
		</span>
	)
}

function TonightsPick({
	pick,
	runnerUp,
	onAgain,
}: {
	pick: DeckTitle
	runnerUp: DeckTitle | null
	onAgain: (() => void) | null
}) {
	const card = pick.card
	const art = artOf(card)
	return (
		<div className="start-member-box flex h-full flex-col pt-3">
			<div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-gray-900 sm:rounded-2xl">
				<img
					src={art.src}
					srcSet={
						art.poster
							? undefined
							: `${art.src} 780w, ${backdropUrl(card.backdrop_path, "w1280")} 1280w`
					}
					sizes="(min-width: 1024px) 1216px, 100vw"
					alt=""
					className={`absolute inset-0 h-full w-full object-cover ${art.poster ? "object-[center_22%] lg:left-auto lg:w-[55%]" : "object-[center_20%]"}`}
				/>
				<div className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent lg:bg-linear-to-r lg:via-gray-950/70 lg:to-gray-950/10" />
				<div className="absolute inset-x-0 bottom-0 p-4 lg:max-w-2xl lg:p-8">
					<p className="truncate text-sm font-semibold text-amber-300">
						Tonight's pick · {pick.why}
					</p>
					<Link to={titleHref(card)} prefetch="intent" className="mt-1 block">
						<h2
							className={`${DISPLAY} line-clamp-2 leading-[0.92] text-white ${card.title.length > 22 ? "text-4xl lg:text-5xl" : "text-[2.75rem] lg:text-7xl"}`}
							lang={mediaFieldLanguage(card)}
						>
							{card.title}
						</h2>
					</Link>
					<p className="mt-2 h-6 truncate text-base font-semibold text-white lg:text-lg">
						{pick.episode ?? ""}
					</p>
					<p className="h-5 truncate text-sm text-gray-400">
						{factsLine(card)}
					</p>
					<div className="mt-4 flex items-center gap-2">
						<WatchButton title={card} offers={offersOf(card, [])} />
						{onAgain ? (
							<button
								type="button"
								onClick={onAgain}
								className={`${QUIET} !h-12 lg:!text-base`}
							>
								<ArrowPathIcon className="h-4 w-4" aria-hidden /> Again
							</button>
						) : null}
					</div>
				</div>
			</div>
			<p className="mt-3 h-5 truncate text-sm text-gray-400">
				{!onAgain ? (
					<>
						Add a few more for this or that.{" "}
						<Link
							to={MEMBER_HREF.discover}
							prefetch="intent"
							className="font-semibold text-amber-400 hover:text-amber-300"
						>
							Find something →
						</Link>
					</>
				) : (
					<>
						{runnerUp ? (
							<>
								Runner-up:{" "}
								<Link
									to={titleHref(runnerUp.card)}
									prefetch="intent"
									className="font-semibold text-gray-200 hover:text-white"
								>
									{runnerUp.card.title}
								</Link>
								{" · "}
							</>
						) : null}
						<Link
							to={MEMBER_HREF.watchNext}
							prefetch="intent"
							className="font-semibold text-amber-400 hover:text-amber-300"
						>
							More in Watch next →
						</Link>
					</>
				)}
			</p>
		</div>
	)
}

/** "2h 1m" for a movie, "45 min episodes" for a show. */
function runtimeText(card: TitleCard) {
	const minutes = card.runtime
	if (!minutes) return null
	if (card.media_type === "show") return `${minutes} min episodes`
	if (minutes < 60) return `${minutes} min`
	return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
}

/** The facts line: year, length, match, score. */
const factsLine = (card: TitleCard) =>
	[
		card.release_year,
		runtimeText(card),
		card.match ? `${card.match}% match` : null,
		card.goodwatch_overall_score_normalized_percent
			? `Score ${Math.round(card.goodwatch_overall_score_normalized_percent)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ")
