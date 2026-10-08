// The stepped grid under the hero: the rest of the Wishlist in tiers that get smaller further out, large now and small
// later. Medium tiers show up to 40 posters and small ones up to 30, then a "+N" button. The server sends cards for
// the first two tiers; later tiers load as they scroll into view.
import {
	BookmarkIcon,
	CheckIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { useIsNotInterested } from "~/hooks/useUserDataAccessors"
import { TIER_CAPS, type WatchNextTierSize } from "~/domain/watch-next"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type {
	WatchNext,
	WatchNextTier,
	WatchNextTitle,
} from "~/server/watch-next.server"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import type { TitleKey } from "~/utils/title-key"
import { titleHref, useMoviesPage } from "./WatchNextHero"
import {
	SORT_WORDS,
	TIER_LABEL,
	TIER_NOTE,
	moodWords,
	runtimeLabel,
	sortFact,
	tierHeadingClass,
	titleCount,
} from "./labels"
import { misfitWords } from "./labels"
import { offersOf } from "./services"
import { DISPLAY, posterUrl } from "./style"
import { type WatchNextState, useTierCards } from "./useWatchNext"

const GRID: Record<WatchNextTierSize, string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
	sm: "grid grid-cols-6 gap-1 md:flex md:flex-wrap md:gap-1.5",
}
const ITEM: Record<WatchNextTierSize, string> = {
	xl: "md:w-56",
	lg: "md:w-36",
	md: "md:w-24",
	sm: "md:w-16",
}

// True once the element comes within a screen of the viewport, and from then on.
function useNear<T extends Element>() {
	const ref = useRef<T>(null)
	const [near, setNear] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el || near) return
		const observer = new IntersectionObserver(
			([entry]) => entry.isIntersecting && setNear(true),
			{ rootMargin: "600px 0px" },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [near])
	return [ref, near] as const
}

function TierRow({
	tier,
	state,
	sort,
	showMatch,
	mine,
}: {
	tier: WatchNextTier
	state: WatchNextState
	sort: WatchNext["sort"]
	showMatch: boolean
	mine: CardService[]
}) {
	const [all, setAll] = useState(false)
	const [ref, near] = useNear<HTMLLIElement>()
	const movies = useMoviesPage()
	// My movies' last group is closed until asked for: what does not fit tonight, each movie saying why.
	const misfits = tier.key === "notTonightsFit"
	const [opened, setOpened] = useState(false)
	const open = !misfits || opened
	const cap = TIER_CAPS[tier.size]
	const shownKeys = all ? tier.keys : tier.keys.slice(0, cap)
	const given = new Map((tier.titles ?? []).map((title) => [title.key, title]))
	const missing = shownKeys.filter((key) => !given.has(key))
	const loaded = useTierCards(
		state,
		missing,
		near && open && missing.length > 0,
		cap - (tier.titles?.length ?? 0),
	)
	const titleOf = (key: TitleKey) => given.get(key) ?? loaded.get(key)
	const big = tier.size === "xl" || tier.size === "lg"
	const note = TIER_NOTE[tier.key]
	const count = movies
		? `${tier.keys.length} ${tier.keys.length === 1 ? "movie" : "movies"}`
		: titleCount(tier.keys.length)

	const meta = (title: WatchNextTitle) => {
		const offer = offersOf(title, mine)?.[0]
		return [
			sortFact(sort, title, showMatch) ??
				runtimeLabel(title, movies ? "Movie" : undefined),
			offer?.owned ? `on ${offer.name}` : null,
		]
			.filter(Boolean)
			.join(", ")
	}

	return (
		<li
			ref={ref}
			className={`grid gap-3 md:grid-cols-[12rem_1fr] md:gap-8 ${tier.size === "xl" ? "pb-12" : tier.size === "lg" ? "pb-10" : "pb-8"}`}
			data-tier={tier.key}
		>
			<div className="md:sticky md:top-32 md:self-start md:text-right">
				<h3
					className={`${DISPLAY} leading-none ${tierHeadingClass[tier.size]}`}
				>
					{misfits ? (
						<button
							type="button"
							aria-expanded={opened}
							onClick={() => setOpened(!opened)}
							className="inline-flex cursor-pointer items-center gap-1.5 text-gray-400 hover:text-white"
						>
							<ChevronDownIcon
								className={`h-4 w-4 transition-transform ${opened ? "" : "-rotate-90"}`}
								aria-hidden
							/>
							{TIER_LABEL[tier.key]}
						</button>
					) : (
						TIER_LABEL[tier.key]
					)}
				</h3>
				<p className="mt-1 text-sm text-gray-400">
					{note && open ? `${note} ` : ""}
					{count}
				</p>
			</div>
			<div className={`min-w-0 ${GRID[tier.size]} ${open ? "" : "hidden"}`}>
				{shownKeys.map((key) => {
					const title = titleOf(key)
					if (!title)
						return (
							<div
								key={key}
								className={`aspect-[2/3] min-w-0 animate-pulse rounded-md bg-white/5 ${ITEM[tier.size]}`}
								aria-hidden
							/>
						)
					return big ? (
						<div
							key={key}
							className={`min-w-0 ${ITEM[tier.size]}`}
							data-key={key}
						>
							<TitlePosterCard card={title} />
							{tier.size === "xl" && (
								<div className="-mt-1 truncate px-1 text-xs text-gray-400">
									{meta(title)}
								</div>
							)}
						</div>
					) : (
						<div
							key={key}
							className={`min-w-0 ${ITEM[tier.size]}`}
							data-key={key}
						>
							<Link to={titleHref(title)} className="block" title={title.title}>
								<img
									src={posterUrl(
										title.poster_path,
										tier.size === "md" ? "w185" : "w92",
									)}
									alt={title.title}
									loading="lazy"
									className={`aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-white/5 ${tier.size === "sm" || misfits ? "opacity-75 hover:opacity-100" : ""}`}
								/>
								{title.misfit && (
									<span
										className="mt-1 block truncate text-xs text-gray-400"
										data-misfit={title.misfit.why}
									>
										{misfitWords(title.misfit)}
									</span>
								)}
							</Link>
						</div>
					)
				})}
				{tier.keys.length > shownKeys.length && (
					<button
						type="button"
						onClick={() => setAll(true)}
						aria-label={`Show ${tier.keys.length - shownKeys.length} more in ${TIER_LABEL[tier.key]}`}
						className={`flex aspect-[2/3] min-w-0 cursor-pointer items-center justify-center rounded-md bg-white/5 text-center text-xs font-semibold text-gray-300 hover:bg-white/10 ${ITEM[tier.size]}`}
					>
						+{tier.keys.length - shownKeys.length}
					</button>
				)}
			</div>
		</li>
	)
}

export function SteppedGrid({
	data,
	state,
	showMatch,
}: {
	data: WatchNext
	state: WatchNextState
	showMatch: boolean
}) {
	const movies = useMoviesPage()
	if (!data.tiers.length) return null
	const filtered = data.moods.length > 0 || data.onMyServices
	const fitWords = data.moods.length
		? `${moodWords(data.moods)}${data.onMyServices ? " on your services" : ""}`
		: "What's on your services"
	const by = SORT_WORDS[data.sort]
	const list = movies ? "movies" : "Wishlist"
	return (
		<section aria-label={`The rest of your ${list}`}>
			<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
				<span className="hidden md:block" />
				<div>
					<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>
						After that
					</h2>
					<p className="mt-1 text-sm text-gray-400">
						{movies
							? `The rest of your movies that fit, by ${by}. Each step further down gets smaller.`
							: filtered
								? `${fitWords} first and largest, by ${by}; near misses follow, smaller.`
								: `The rest of your Wishlist, by ${by}. Each step further down gets smaller.`}
					</p>
				</div>
			</header>
			<ol aria-label={`Your ${list}, stepped`}>
				{data.tiers.map((tier) => (
					<TierRow
						key={tier.key}
						tier={tier}
						state={state}
						sort={data.sort}
						showMatch={showMatch}
						mine={data.myServices}
					/>
				))}
			</ol>
		</section>
	)
}

/** While the Wishlist is short: suggestions worth adding, each with Want to See. */
export function WorthAdding({
	data,
	onWant,
	isWanted,
}: {
	data: WatchNext
	onWant: (card: TitleCard) => void
	isWanted: (card: TitleCard) => boolean
}) {
	const movies = useMoviesPage()
	if (!data.worthAdding.length) return null
	return (
		<section aria-label="Suggestions to add" className="mt-4">
			<div className="mb-3">
				<h2 className="text-lg font-bold text-white md:text-xl">
					{data.total > 0
						? "Worth adding"
						: movies
							? "Movies to start with"
							: "Start your Wishlist"}
				</h2>
				<p className="text-sm text-gray-400">
					{data.onMyServices
						? "Your best matches on your services. "
						: "Your best matches. "}
					Tap Want to See and it joins {movies ? "My movies" : "Watch next"}{" "}
					under your sort.
				</p>
			</div>
			<div className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
				{data.worthAdding.map((card) => (
					<WorthAddingCard
						key={card.key}
						card={card}
						wanted={isWanted(card)}
						onWant={onWant}
					/>
				))}
			</div>
		</section>
	)
}

function WorthAddingCard({
	card,
	wanted,
	onWant,
}: {
	card: TitleCard
	wanted: boolean
	onWant: (card: TitleCard) => void
}) {
	// The card turns into its "Hidden" tile after Not interested; the pill goes with it.
	const hidden = useIsNotInterested(card.media_type, card.tmdb_id)
	return (
		<div className="relative w-[8.5rem] shrink-0 snap-start md:w-[10.5rem]">
			{/* The card's other actions sit above the pill. */}
			<TitlePosterCard card={card} actions="raised" />
			{!hidden && (
				<div className="pointer-events-none absolute inset-x-2 bottom-4 z-40 flex justify-end">
					<button
						type="button"
						onClick={() => onWant(card)}
						aria-pressed={wanted}
						aria-label={
							wanted
								? `${card.title} is on your Wishlist`
								: `Want to See: ${card.title}`
						}
						className={`pointer-events-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-bold shadow-lg shadow-black/50 transition-colors ${wanted ? "bg-amber-400 text-black hover:bg-amber-300" : "bg-white/95 text-black hover:bg-white"}`}
					>
						<BookmarkIcon
							className={`h-4 w-4 ${wanted ? "" : "text-amber-600"}`}
							aria-hidden
						/>
						{wanted ? (
							<CheckIcon className="h-3.5 w-3.5" aria-hidden />
						) : (
							"Want to See"
						)}
					</button>
				</div>
			)}
		</div>
	)
}
