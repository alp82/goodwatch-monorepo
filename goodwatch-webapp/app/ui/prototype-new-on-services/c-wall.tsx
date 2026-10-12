// PROTOTYPE - throwaway (#489, prototype C). Variation C, "Poster wall": every arrival as a poster, the best score
// first, with movies and shows as the one choice on top. It bets on browsing: the page is a wall to scan, and the
// score, not the day, decides the order. That sidesteps the limit: nothing on the wall claims a day. The titles a
// member waits for are four times the size and lead the wall.
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import {
	CountrySelect,
	FreshNote,
	Logo,
	Nothing,
	type PageProps,
	PosterImage,
	SavedServices,
	Score,
	ServiceKeys,
	TitleLink,
	VisitorPrompt,
	WantMark,
} from "./bits"
import {
	type Arrival,
	type KindChoice,
	byScore,
	isMember,
	wantedOf,
	wantedWords,
} from "./model"

const KINDS: [KindChoice, string][] = [
	["all", "All"],
	["movie", "Movies"],
	["show", "Shows"],
]

function Tile({ arrival }: { arrival: Arrival }) {
	const words = arrival.want ? wantedWords(arrival) : null
	return (
		<TitleLink
			arrival={arrival}
			className={`group relative block overflow-hidden rounded-md bg-gray-800 ${words ? "col-span-2 row-span-2 ring-2 ring-amber-400" : "ring-1 ring-white/10 hover:ring-amber-400/70"}`}
		>
			<PosterImage
				arrival={arrival}
				size={words ? "w500" : "w342"}
				className="block aspect-[2/3] h-full w-full transition-transform duration-200 group-hover:scale-105"
			/>
			<Score
				score={arrival.score}
				className={`absolute right-1 top-1 shadow ${words ? "" : "h-6 min-w-7 text-xs"}`}
			/>
			{words ? (
				<>
					<WantMark className="absolute left-1.5 top-1.5" />
					<span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-t from-gray-950 via-gray-950/85 to-transparent px-2.5 pb-2.5 pt-10">
						<span className="text-xs font-bold text-amber-300">
							{words.lead}
						</span>
						<b className="truncate text-base leading-tight text-white">
							{arrival.title}
						</b>
						<span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold text-sky-200">
							<Logo service={arrival.services[0]} size={20} />
							{words.landed}
							{words.episode && (
								<span className="rounded bg-sky-400 px-1.5 py-px text-[11px] font-black text-black">
									{words.episode}
								</span>
							)}
						</span>
					</span>
				</>
			) : (
				<span className="absolute bottom-1 left-1 flex gap-0.5">
					{arrival.services.map((service) => (
						<Logo key={service} service={service} size={20} />
					))}
				</span>
			)}
			<span className="sr-only">
				{arrival.title} ({arrival.year})
			</span>
		</TitleLink>
	)
}

export function VariantC(props: PageProps) {
	const { choice, arrivals, everything, seo, set } = props
	const wanted = wantedOf(arrivals)
	const rest = byScore(arrivals.filter((a) => !a.want))
	const count = (kind: KindChoice) =>
		kind === "all"
			? everything.length
			: everything.filter((a) => a.type === kind).length
	return (
		<div className="pb-28" data-variant="C">
			<header className={`${WRAP} pb-3 pt-6`}>
				<h1 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>
					{seo.heading}
				</h1>
				<p className="mt-1 text-sm text-gray-400">
					{isMember(choice.viewer) && choice.saved
						? "The best first. Found in the last two weeks."
						: `${seo.line}. The best first.`}
				</p>
			</header>
			{/* The choices stay in reach while the wall scrolls. */}
			<div className="sticky top-16 z-20 border-y border-white/[0.07] bg-gray-900/95 backdrop-blur">
				<div
					className={`${WRAP} flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5`}
				>
					<div
						className="flex rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10"
						role="radiogroup"
						aria-label="Movies or shows"
					>
						{KINDS.map(([kind, name]) => {
							const on = choice.kind === kind
							return (
								<button
									key={kind}
									// biome-ignore lint/a11y/useSemanticElements: a segmented key, as the sort drawer's tiles
									type="button"
									role="radio"
									aria-checked={on}
									data-kind={kind}
									onClick={() => set({ kind: kind === "all" ? "" : kind })}
									className={`h-8 cursor-pointer rounded-lg px-3 text-sm font-bold ${on ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
								>
									{name}{" "}
									<span
										className={`tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}
									>
										{count(kind)}
									</span>
								</button>
							)
						})}
					</div>
					{isMember(choice.viewer) && choice.saved ? (
						<SavedServices {...props} />
					) : (
						<>
							<CountrySelect {...props} />
							<ServiceKeys {...props} names={false} />
						</>
					)}
				</div>
			</div>
			<div className={`${WRAP} flex flex-col gap-6 pt-4`}>
				{arrivals.length === 0 ? (
					<Nothing {...props} />
				) : (
					<>
						<div
							className="grid grid-flow-dense grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
							data-wall
						>
							{wanted.map((arrival) => (
								<Tile key={arrival.key} arrival={arrival} />
							))}
							{rest.map((arrival) => (
								<Tile key={arrival.key} arrival={arrival} />
							))}
						</div>
						<FreshNote wanted={wanted.length > 0} />
					</>
				)}
				{choice.viewer === "visitor" && <VisitorPrompt className="max-w-xl" />}
			</div>
		</div>
	)
}
