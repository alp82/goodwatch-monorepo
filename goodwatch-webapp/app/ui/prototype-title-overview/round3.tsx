// PROTOTYPE - throwaway. Round 3 of /prototype/title-overview: I (Rings on the banner), which the owner chose as
// the baseline, and J (Three cards), whose own score and service cards round 4 takes. K was dropped. Both are kept
// as they were, for comparison. Round 4 (round4.tsx) reuses the site chips and the where-to-watch section from here.
import { AdjustmentsHorizontalIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { BannerImage, BannerTrailer, MiniActions, ScoreBar, ScorePair, TitleBlock, TrackLine } from "./banner"
import { EYEBROW, EpisodeRatingsLink, FOCUS, Poster, SITES, type SiteId } from "./kit"
import { type Offer, PROVIDERS, type Provider, type ProviderKey, type Title, img } from "./model"
import type { VariantProps } from "./variants"

const PANEL = "relative min-w-0 rounded-2xl border border-white/10 bg-stone-950"
const BOX = "rounded-xl bg-white/[0.07] ring-1 ring-white/10"
const QUIET = "rounded-xl bg-white/[0.035] ring-1 ring-white/[0.07]"
const SHADOW = "shadow-[0_8px_30px_rgba(0,0,0,.7)]"

// ---------------------------------------------------------------------------------------------------------
// The sites, as the real page has them
// ---------------------------------------------------------------------------------------------------------

/** IMDb, Metacritic and Rotten Tomatoes: one brand-coloured chip each, "critics | audience" inside. A site with no score is left out. */
/** `fill`: the chips share the row's width (round 4, where a row has nothing else to end it). */
export function SiteChips({ title, fill = false, className = "" }: { title: Title; fill?: boolean; className?: string }) {
	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className="h-3 w-px bg-current opacity-40" />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chips: { id: SiteId; value: React.ReactNode; says: string }[] = []
	if (title.imdb) chips.push({ id: "imdb", value: title.imdb, says: `IMDb: ${title.imdb}` })
	if (title.mcCritics || title.mcAudience) chips.push({ id: "mc", value: pair(title.mcCritics, title.mcAudience), says: `Metacritic: critics ${title.mcCritics ?? "none"}, audience ${title.mcAudience ?? "none"}` })
	if (title.rtCritics || title.rtAudience) chips.push({ id: "rt", value: pair(title.rtCritics, title.rtAudience), says: `Rotten Tomatoes: critics ${title.rtCritics ?? "none"}, audience ${title.rtAudience ?? "none"}` })
	return (
		<div data-site-chips className={`flex items-center gap-1.5 ${fill ? "" : "flex-wrap"} ${className}`}>
			{chips.map((chip) => (
				<span key={chip.id} title={chip.says} className={`inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[13px] font-semibold tabular-nums ${fill ? "flex-1 justify-center" : ""} ${SITES[chip.id].chip}`}>
					<img src={SITES[chip.id].logo} alt={SITES[chip.id].name} className={chip.id === "imdb" ? "h-3" : "h-3.5"} />
					{chip.value}
				</span>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Where to watch as a section
// ---------------------------------------------------------------------------------------------------------

const OFFERS: Record<Offer, string> = { stream: "Stream", rent: "Rent", buy: "Buy" }
const FLAG = { background: "linear-gradient(#000 33%, #d00 33% 66%, #fc0 66%)" }

/**
 * A title row with the settings on its right (offer type, country), then the services, each a big logo with its
 * name. Yours come first with a green ring. Three ways to hold many of them:
 * - "swipe": logos with the name under them in one row that scrolls sideways inside the section
 * - "tiles": logo and name side by side, two to a row; four show, the rest open in place
 * - "wrap": logos with the name under them; one row shows, "+N" opens the rest in place
 */
export function WatchSection({
	providers,
	kind,
	layout,
	fill = false,
	tight = false,
	className = "",
}: { providers: ProviderKey; kind: string; layout: "swipe" | "tiles" | "wrap"; /** Tiles: a last one alone in its row takes the whole row. */ fill?: boolean; /** Tiles: lower cards. */ tight?: boolean; className?: string }) {
	const [offer, setOffer] = useState<Offer>("stream")
	const [all, setAll] = useState(false)
	const { offers } = PROVIDERS[providers]
	const list = offers[offer]
	const nothing = !offers.stream.length && !offers.rent.length && !offers.buy.length
	const tick = (
		<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-black text-black ring-2 ring-stone-950" aria-hidden="true">
			✓
		</span>
	)
	const says = (p: Provider) => (p.owned ? `${p.name}: one of your services` : `${OFFERS[offer]} on ${p.name}`)
	/** Logo over name. */
	const stacked = (p: Provider) => (
		<a key={p.name} href="#streaming" data-provider title={says(p)} className={`group flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-xl ${FOCUS}`}>
			<span className={`relative block h-14 w-14 rounded-xl ${p.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/15"}`}>
				<img src={img("w92", p.logo)} alt="" width={56} height={56} className="h-full w-full rounded-xl group-hover:brightness-125" />
				{p.owned && tick}
			</span>
			<span className={`w-full truncate text-center text-[11px] font-medium ${p.owned ? "text-green-300" : "text-gray-300"}`}>{p.name}</span>
		</a>
	)
	/** Logo beside name. */
	const tile = (p: Provider, i: number, shown: Provider[]) => {
		const whole = fill && i === shown.length - 1 && shown.length % 2 === 1
		return (
			<a
				key={p.name}
				href="#streaming"
				data-provider
				title={says(p)}
				className={`relative flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 hover:bg-white/[0.12] ${tight ? "h-11" : "h-12"} ${whole ? "col-span-2" : ""} ${p.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"} ${FOCUS}`}
			>
				<img src={img("w92", p.logo)} alt="" width={48} height={48} className={`shrink-0 rounded-xl ${tight ? "h-11 w-11" : "h-12 w-12"}`} />
				<span className="min-w-0 truncate text-sm font-medium text-white">{p.name}</span>
				{whole && <span className={`ml-auto shrink-0 text-xs ${p.owned ? "font-semibold text-green-300" : "text-gray-400"}`}>{p.owned ? "On your services" : OFFERS[offer]}</span>}
				{p.owned && tick}
			</a>
		)
	}
	const WRAP = 4
	const TILES = 4
	return (
		<div data-watch={providers} className={`min-w-0 ${className}`}>
			<div data-row="watch" className="flex min-w-0 items-center gap-1.5">
				<h2 className="mr-auto min-w-0 truncate text-sm font-semibold text-white">Where to watch</h2>
				{!nothing && (
					<div role="tablist" aria-label="Offer type" className="flex shrink-0 rounded-full bg-white/8 p-0.5 text-[11px] sm:text-xs">
						{(Object.keys(OFFERS) as Offer[]).map((o) => (
							<button
								key={o}
								type="button"
								role="tab"
								aria-selected={offer === o}
								onClick={() => {
									setOffer(o)
									setAll(false)
								}}
								className={`cursor-pointer rounded-full px-2 py-1 ${offer === o ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
							>
								{OFFERS[o]}
							</button>
						))}
					</div>
				)}
				<button type="button" data-country aria-label="Services in Germany. Change country" title="Services in Germany. Change country" className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs text-gray-300 hover:bg-white/10 ${FOCUS}`}>
					<span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[1px]" style={FLAG} />
					<span className="max-sm:hidden">DE</span>
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5 text-gray-400" />
				</button>
			</div>
			{nothing ? (
				<p className="mt-2 text-sm text-gray-400">No service in Germany has this {kind} yet.</p>
			) : list.length === 0 ? (
				<p className="mt-2 text-sm text-gray-400">Nothing to {offer} in Germany yet.</p>
			) : layout === "swipe" ? (
				// The row bleeds to the section's edges, and fades out on the right while there is more to swipe to.
				<div data-scroller className={`-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5 pt-1.5 [scrollbar-width:none] ${list.length > 4 ? "[mask-image:linear-gradient(to_right,black_82%,transparent)]" : ""}`}>
					{list.map(stacked)}
				</div>
			) : layout === "tiles" ? (
				<>
					<div data-row="services" className="mt-2.5 grid grid-cols-2 gap-2 pt-0.5">{(all ? list : list.slice(0, TILES)).map(tile)}</div>
					{list.length > TILES && (
						<button type="button" data-all-services aria-expanded={all} onClick={() => setAll(!all)} className={`mt-2 h-8 w-full cursor-pointer rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white ${FOCUS}`}>
							{all ? "Show fewer" : `All ${list.length} services`}
						</button>
					)}
				</>
			) : (
				<div className="mt-2 grid grid-cols-4 justify-items-center gap-x-1.5 gap-y-2.5 pt-1.5">
					{(all || list.length <= WRAP ? list : list.slice(0, WRAP - 1)).map(stacked)}
					{!all && list.length > WRAP && (
						<button type="button" data-all-services aria-expanded={false} aria-label={`Show all ${list.length} services`} onClick={() => setAll(true)} className={`group flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl ${FOCUS}`}>
							<span className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-white/25 text-sm font-semibold text-gray-200 group-hover:border-white/60">+{list.length - WRAP + 1}</span>
							<span className="text-[11px] font-medium text-gray-400">More</span>
						</button>
					)}
				</div>
			)}
		</div>
	)
}

// =========================================================================================================
// I - Rings on the banner
// H's compactness. The ratings are one group on the banner: A's two rings, and under them the site chips with the
// way to the episode ratings. Below the banner two blocks: your show (the tracking line, then the actions) and
// where to watch, whose services are one row to swipe through. Side by side on a wide screen.
// =========================================================================================================

export function VariantI({ title, m, api, providers }: VariantProps) {
	const ratings = (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
			<ScorePair title={title} m={m} api={api} />
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<SiteChips title={title} />
				{title.kind === "show" && <EpisodeRatingsLink />}
			</div>
		</div>
	)
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative px-4 pb-4 pt-12 md:px-6 md:pb-5 md:pt-10">
					<div className="flex items-end gap-3 md:gap-6">
						<Poster title={title} trailer="none" className={`aspect-[2/3] w-[4.5rem] shrink-0 md:w-32 ${SHADOW}`} />
						<div className="min-w-0 flex-1">
							<TitleBlock title={title} />
							<div className="mt-4 hidden md:block">{ratings}</div>
						</div>
					</div>
					<div className="mt-3.5 md:hidden">{ratings}</div>
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2">
				<div data-your className={`flex flex-col justify-center gap-2.5 p-3 ${BOX}`}>
					<TrackLine m={m} api={api} />
					<MiniActions api={api} />
				</div>
				<WatchSection providers={providers} kind={title.kind} layout="swipe" className={`p-3 ${QUIET}`} />
			</div>
		</section>
	)
}

// =========================================================================================================
// J - Three cards
// G's structure, tidied. A strip for the poster and the title, then three cards of different weight: ratings
// (D's ring and pill, the site chips under them, the episode ratings in the card's heading), your show, and
// where to watch with named tiles, two to a row. The cards stack on a phone and sit side by side from lg up.
// =========================================================================================================

export function VariantJ({ title, m, api, providers }: VariantProps) {
	const show = title.kind === "show"
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative flex items-end gap-3 px-4 pb-3 pt-12 md:gap-5 md:px-5 md:pb-4 md:pt-10">
					<Poster title={title} trailer="none" className={`aspect-[2/3] w-16 shrink-0 md:w-[5.5rem] ${SHADOW}`} />
					<TitleBlock title={title} className="flex-1 pb-0.5" />
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-3">
				<div className={`flex min-w-0 flex-col gap-3 p-3 ${BOX}`}>
					<div className="flex items-center justify-between gap-3">
						<h2 className={EYEBROW}>Ratings</h2>
						{show && <EpisodeRatingsLink />}
					</div>
					<ScoreBar title={title} m={m} api={api} />
					<SiteChips title={title} className="lg:mt-auto" />
				</div>
				<div data-your className={`flex min-w-0 flex-col gap-2.5 p-3 ${BOX}`}>
					<h2 className={EYEBROW}>{show ? "Your show" : "Your movie"}</h2>
					<TrackLine m={m} api={api} />
					{!show && <p className="line-clamp-2 text-sm leading-relaxed text-gray-300 max-lg:hidden">{title.overview}</p>}
					<MiniActions api={api} className="lg:mt-auto" />
				</div>
				<WatchSection providers={providers} kind={title.kind} layout="tiles" className={`p-3 ${QUIET}`} />
			</div>
		</section>
	)
}
