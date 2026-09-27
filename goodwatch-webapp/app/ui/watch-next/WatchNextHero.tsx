// The start hero: the first title of Watch next, large, over its backdrop, with its services and actions, and the
// Then column with the next three. The docked strip sits on its top edge. With an empty Wishlist it offers the best
// worthwhile suggestion instead ("Start with this?").
import { BookmarkIcon, CheckIcon, PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { MOOD_BY_KEY } from "~/domain/moods"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { WatchNext, WatchNextTitle } from "~/server/watch-next.server"
import { titleToDashed } from "~/utils/helpers"
import { heroLabel, runtimeLabel, sortFact } from "./labels"
import { type ServiceOffer, offersOf, watchLine } from "./services"
import { DISPLAY, EASE, WRAP, backdropUrl, logoUrl, posterUrl } from "./style"

export const titleHref = (
	title: Pick<TitleCard, "media_type" | "tmdb_id" | "title">,
) => `/${title.media_type}/${title.tmdb_id}-${titleToDashed(title.title)}`

const SWAP = {
	initial: { opacity: 0, x: 40 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: -40 },
	transition: { duration: 0.3, ease: EASE },
} as const

/** Logo tiles for a title's services, the viewer's own ringed in green. */
export function ServiceTiles({
	offers,
	size = 44,
	max = 3,
}: {
	offers: ServiceOffer[] | null
	size?: number
	max?: number
}) {
	if (!offers) return null
	if (!offers.length)
		return (
			<p className="text-xs text-gray-400">Not streaming in your country</p>
		)
	const owned = offers.some((offer) => offer.owned)
	return (
		<div className="flex flex-wrap items-center gap-2">
			{offers.slice(0, max).map((offer) => (
				<span
					key={offer.id}
					title={
						offer.owned
							? `${offer.name}: one of your services`
							: `Stream on ${offer.name}`
					}
					className={`relative flex shrink-0 items-center gap-2 rounded-lg border-2 bg-white/10 pr-2.5 ${offer.owned ? "border-green-500" : "border-white/15 opacity-70"}`}
					style={{ height: size }}
				>
					<img
						src={logoUrl(offer.logo_path)}
						alt=""
						className="aspect-square h-full rounded-md"
					/>
					<span className="truncate text-sm font-medium text-white">
						{offer.name}
					</span>
					{offer.owned && (
						<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
							<CheckIcon className="h-3 w-3" aria-hidden />
							<span className="sr-only">One of your services</span>
						</span>
					)}
				</span>
			))}
			{!owned && (
				<span className="text-xs text-gray-400">Not on your services</span>
			)}
		</div>
	)
}

// The line above the title: what the pick is under this sort and these moods, the value the sort read, its moods.
function Eyebrow({
	data,
	hero,
	showMatch,
}: {
	data: WatchNext
	hero: WatchNextTitle
	showMatch: boolean
}) {
	const fact =
		data.sort === "match" ? null : sortFact(data.sort, hero, showMatch)
	return (
		<motion.div
			key={`${hero.key}:${data.sort}`}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
			className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold"
			data-eyebrow
		>
			<span className="text-amber-300" data-herolabel>
				{heroLabel(data.sort, data.moods, data.heroNote)}
			</span>
			{fact && <span className="text-gray-300">{fact}</span>}
			{hero.moods.length > 0 && (
				<span className="flex flex-wrap items-center gap-1.5">
					{hero.moods.slice(0, 3).map((mood) => {
						const on = data.moods.includes(mood)
						const { name, hue } = MOOD_BY_KEY[mood]
						return (
							<span
								key={mood}
								className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs ${on ? "text-black" : "bg-black/40 text-gray-200 ring-1 ring-white/15"}`}
								style={on ? { background: hue } : undefined}
							>
								{!on && (
									<span
										className="h-2 w-2 rounded-full"
										style={{ background: hue }}
										aria-hidden
									/>
								)}
								{name}
							</span>
						)
					})}
				</span>
			)}
		</motion.div>
	)
}

function WatchButton({
	title,
	offers,
}: { title: TitleCard; offers: ServiceOffer[] | null }) {
	const offer = offers?.[0]
	return (
		<Link
			to={titleHref(title)}
			className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200"
		>
			{offer ? (
				<img
					src={logoUrl(offer.logo_path)}
					alt=""
					className="h-8 w-8 rounded-md"
				/>
			) : null}
			<PlayIcon className={`h-5 w-5 ${offer ? "" : "ml-2"}`} aria-hidden />
			{offer ? `Watch on ${offer.name}` : "Where to watch"}
		</Link>
	)
}

// The next three, as the start hero kept them from round 1: poster, number, title, and where it streams.
function ThenColumn({
	titles,
	mine,
}: { titles: WatchNextTitle[]; mine: CardService[] }) {
	if (!titles.length) return null
	return (
		<div className="min-w-0" data-then>
			<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
			<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[20rem] md:flex-col md:overflow-visible md:px-0">
				<AnimatePresence mode="popLayout" initial={false}>
					{titles.map((title, i) => (
						<motion.li
							key={title.key}
							layout
							initial={{ opacity: 0, x: 24 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -24 }}
							transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
							className="w-28 shrink-0 md:w-auto"
						>
							<Link
								to={titleHref(title)}
								className="flex w-full flex-col gap-2 rounded-lg bg-black/50 p-1.5 text-left backdrop-blur-md hover:bg-black/70 md:flex-row md:items-center md:gap-3"
							>
								<span className="relative block shrink-0">
									<img
										src={posterUrl(title.poster_path, "w185")}
										alt=""
										className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16"
									/>
									<span
										className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`}
										aria-hidden
									>
										{i + 2}
									</span>
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-bold text-white">
										{title.title}
									</span>
									<span className="block truncate text-xs text-gray-400">
										{watchLine(offersOf(title, mine))}
									</span>
									<span className="hidden truncate text-xs text-gray-500 md:block">
										{runtimeLabel(title)}
									</span>
								</span>
							</Link>
						</motion.li>
					))}
				</AnimatePresence>
			</ol>
		</div>
	)
}

export function WatchNextHero({
	data,
	strip,
	showMatch,
	onFinish,
	onPass,
	onWant,
}: {
	data: WatchNext | null
	strip: React.ReactNode
	showMatch: boolean
	onFinish: (title: WatchNextTitle) => void
	onPass: (title: WatchNextTitle) => void
	onWant: (title: TitleCard) => void
}) {
	const hero = data?.hero ?? null
	const start = data?.start ?? null
	const stage = hero ?? start
	const mine = data?.myServices ?? []
	const heroOffers = hero ? offersOf(hero, mine) : null
	return (
		<section
			className="relative isolate overflow-hidden"
			aria-label="Your next watch"
		>
			<AnimatePresence mode="popLayout" initial={false}>
				{stage?.backdrop_path && (
					<motion.img
						key={stage.key}
						src={backdropUrl(stage.backdrop_path, "original")}
						alt=""
						initial={{ opacity: 0, scale: 1.06 }}
						animate={{ opacity: hero ? 1 : 0.5, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.9, ease: EASE }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-linear-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-900 to-transparent" />
			<div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-gray-900/90 to-transparent" />
			<div className={`${WRAP} relative z-20 pt-4 md:pt-6`}>{strip}</div>

			<div
				className={`${WRAP} grid min-h-[30rem] items-end gap-6 pb-8 pt-24 md:min-h-[36rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-6`}
			>
				<div className="min-w-0">
					{data && hero && (
						<Eyebrow data={data} hero={hero} showMatch={showMatch} />
					)}
					<AnimatePresence mode="wait" initial={false}>
						{hero ? (
							<motion.div
								key={hero.key}
								{...SWAP}
								className="min-w-0 max-w-2xl"
								data-hero={hero.key}
							>
								<Link to={titleHref(hero)} className="block">
									<h2
										className={`${DISPLAY} mt-1 leading-[0.9] text-white ${hero.title.length > 22 ? "text-4xl md:text-6xl lg:text-7xl" : "text-5xl md:text-7xl lg:text-[7rem]"}`}
									>
										{hero.title}
									</h2>
								</Link>
								{hero.tagline && (
									<p className="mt-3 text-base text-gray-200 md:text-lg">
										{hero.tagline}
									</p>
								)}
								<p className="mt-1 text-sm text-gray-400">
									{[
										hero.release_year,
										runtimeLabel(hero),
										showMatch && hero.match
											? `${hero.match}% taste match`
											: null,
										hero.goodwatch_overall_score_normalized_percent
											? `GoodWatch score ${Math.round(hero.goodwatch_overall_score_normalized_percent)}`
											: null,
									]
										.filter(Boolean)
										.join(", ")}
								</p>
								<div className="mt-5">
									<ServiceTiles offers={heroOffers} />
								</div>
								<div className="mt-6 flex flex-wrap items-center gap-2">
									<WatchButton title={hero} offers={heroOffers} />
									<button
										type="button"
										onClick={() => onFinish(hero)}
										className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20"
									>
										<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />
										I watched it
									</button>
									{data && data.total > 1 && (
										<button
											type="button"
											onClick={() => onPass(hero)}
											className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10"
										>
											Not tonight
										</button>
									)}
								</div>
							</motion.div>
						) : data ? (
							<motion.div
								key={`start-${start?.key ?? ""}`}
								{...SWAP}
								className="min-w-0 max-w-2xl"
							>
								<p className="text-sm font-semibold text-amber-300">
									Your Wishlist is empty
								</p>
								{start ? (
									<>
										<Link to={titleHref(start)} className="block">
											<h2
												className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-7xl`}
											>
												{start.title}
											</h2>
										</Link>
										<p className="mt-3 text-base text-gray-200 md:text-lg">
											Start with this?{" "}
											{showMatch && start.match
												? `${start.match}% taste match. `
												: ""}
											{runtimeLabel(start)}.
										</p>
										<div className="mt-5">
											<ServiceTiles offers={offersOf(start, mine)} />
										</div>
										<div className="mt-6 flex flex-wrap gap-2">
											<button
												type="button"
												onClick={() => onWant(start)}
												className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-5 text-base font-bold text-black shadow-lg shadow-black/50 hover:bg-white"
											>
												<BookmarkIcon
													className="h-4 w-4 text-amber-600"
													aria-hidden
												/>
												Want to See
											</button>
										</div>
									</>
								) : (
									<h2
										className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-6xl`}
									>
										Nothing here yet
									</h2>
								)}
							</motion.div>
						) : (
							<div
								key="loading"
								className="min-w-0 max-w-2xl animate-pulse"
								aria-hidden
							>
								<div className="h-4 w-48 rounded bg-white/10" />
								<div className="mt-3 h-20 w-96 max-w-full rounded bg-white/10" />
								<div className="mt-4 h-4 w-64 rounded bg-white/10" />
								<div className="mt-6 flex gap-2">
									<div className="h-12 w-48 rounded-lg bg-white/10" />
									<div className="h-12 w-36 rounded-lg bg-white/10" />
								</div>
							</div>
						)}
					</AnimatePresence>
				</div>
				{data && <ThenColumn titles={data.thenColumn} mine={mine} />}
			</div>
		</section>
	)
}
