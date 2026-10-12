// PROTOTYPE - throwaway (#489, prototype C). Variation B, "By service": a shelf of posters for each service, the
// better score first, and above the shelves the titles the member waited for. It bets on the service being how
// people think about what is new ("what is new on Netflix"), and each shelf opens the page of that one service. It
// says no day at all for the catalogue, only "in the last two weeks", which is what the data can carry.
import { ArrowsPointingOutIcon } from "@heroicons/react/20/solid"
import { DISPLAY, WRAP, tmdbImage } from "~/ui/my-pages/bits"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import type { AllRatings } from "~/utils/ratings"
import {
	FreshNote,
	Logo,
	Nothing,
	type PageProps,
	Pickers,
	PosterImage,
	TitleLink,
	VisitorPrompt,
	WantMark,
} from "./bits"
import {
	type Arrival,
	COUNTRIES,
	SERVICES,
	type ServiceKey,
	byScore,
	byService,
	isMember,
	plural,
	serviceNames,
	wantedOf,
	wantedWords,
} from "./model"

/** A wanted title that landed: its backdrop, what it is to the member, the service and the day. */
function Landed({ arrival }: { arrival: Arrival }) {
	const words = wantedWords(arrival)
	return (
		<TitleLink
			arrival={arrival}
			className="group relative flex h-44 w-[78vw] max-w-sm shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl p-3 ring-1 ring-sky-300/40 hover:ring-sky-300 sm:w-auto sm:max-w-none"
		>
			<img
				src={tmdbImage(arrival.backdrop, "w780")}
				alt=""
				className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
			/>
			<span className="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/60 to-transparent" />
			<Logo
				service={arrival.services[0]}
				size={36}
				className="absolute left-3 top-3"
			/>
			{words.episode && (
				<span className="absolute right-3 top-3 rounded-md bg-sky-400 px-2 py-1 text-xs font-black text-black">
					{words.episode}
				</span>
			)}
			<span className="relative text-xs font-bold text-amber-300">
				{words.lead}
			</span>
			<b className={`${DISPLAY} relative truncate text-2xl text-white`}>
				{arrival.title}
			</b>
			<span className="relative flex items-center gap-1.5 text-sm font-bold text-sky-200">
				<span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
				{words.landed}
			</span>
		</TitleLink>
	)
}

function Tile({ arrival }: { arrival: Arrival }) {
	return (
		<TitleLink
			arrival={arrival}
			className={`group relative block w-[31vw] max-w-[150px] shrink-0 snap-start rounded-lg border-4 bg-gray-900 hover:bg-gray-800 ${arrival.want ? "border-amber-400" : "border-gray-800 hover:border-amber-700/50"}`}
		>
			<span className="relative block">
				<RatingOverlay
					ratings={
						{
							goodwatch_overall_score_normalized_percent: arrival.score,
						} as AllRatings
					}
				/>
				{arrival.want && <WantMark className="absolute left-1.5 top-1.5" />}
				<PosterImage
					arrival={arrival}
					className="block aspect-[2/3] w-full rounded-md"
				/>
			</span>
			<span className="block truncate px-1.5 pb-1 pt-1.5 text-xs font-bold text-gray-200">
				{arrival.title}
			</span>
		</TitleLink>
	)
}

function Shelf({
	service,
	arrivals,
	only,
	open,
}: {
	service: ServiceKey
	arrivals: Arrival[]
	/** This service is the only one on the page. */
	only: boolean
	open: () => void
}) {
	// The titles the member waits for lead the shelf.
	const ordered = byScore(arrivals).sort(
		(a, b) => Number(Boolean(b.want)) - Number(Boolean(a.want)),
	)
	return (
		<section data-shelf={service}>
			<div className="flex items-center gap-3">
				<Logo service={service} size={40} />
				<div className="min-w-0 flex-1">
					<h2 className={`${DISPLAY} truncate text-2xl text-white`}>
						New on {SERVICES[service].name}
					</h2>
					<p className="text-xs text-gray-400">
						{plural(arrivals.length, "title")} in the last two weeks
					</p>
				</div>
				{!only && (
					<button
						type="button"
						onClick={open}
						data-open={service}
						title={`Only ${SERVICES[service].name}`}
						className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
					>
						<ArrowsPointingOutIcon className="h-4 w-4" aria-hidden />
						Only this
					</button>
				)}
			</div>
			{/* One service alone has room for all its posters; several services each get one row. */}
			<div
				className={
					only
						? "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8 [&>a]:w-auto [&>a]:max-w-none"
						: "-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
				}
			>
				{ordered.map((arrival) => (
					<Tile key={arrival.key} arrival={arrival} />
				))}
			</div>
		</section>
	)
}

export function VariantB(props: PageProps) {
	const { choice, arrivals, seo, set } = props
	const wanted = wantedOf(arrivals)
	const shelves = byService(arrivals, choice.services)
	const quiet = choice.services.filter(
		(service) => !shelves.some(([key]) => key === service),
	)
	return (
		<div className="pb-28" data-variant="B">
			<header className={`${WRAP} flex flex-col gap-3 pb-5 pt-6`}>
				<div>
					<h1 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>
						{seo.heading}
					</h1>
					{!(isMember(choice.viewer) && choice.saved) && (
						<p className="mt-1 text-sm text-gray-400">{seo.line}</p>
					)}
				</div>
				<Pickers {...props} />
			</header>
			<div className={`${WRAP} flex flex-col gap-8`}>
				{wanted.length > 0 && (
					<section data-wanted-shelf>
						<h2 className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
							You waited for {wanted.length === 1 ? "this" : "these"}
						</h2>
						<div className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
							{wanted.map((arrival) => (
								<Landed key={arrival.key} arrival={arrival} />
							))}
						</div>
					</section>
				)}
				{arrivals.length === 0 ? (
					<Nothing {...props} />
				) : (
					<>
						{shelves.map(([service, list]) => (
							<Shelf
								key={service}
								service={service}
								arrivals={list}
								only={choice.services.length === 1}
								open={() => set({ services: service })}
							/>
						))}
						{quiet.length > 0 && (
							<p className="text-sm text-gray-500" data-quiet>
								Nothing new on {serviceNames(quiet)}{" "}
								{COUNTRIES[choice.country].inThe} in the last two weeks.
							</p>
						)}
						<FreshNote wanted={wanted.length > 0} />
					</>
				)}
				{choice.viewer === "visitor" && <VisitorPrompt className="max-w-xl" />}
			</div>
		</div>
	)
}
