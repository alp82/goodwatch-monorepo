// PROTOTYPE — round 4 score-area layout, grown from round 3's 8f (the owner's pick). Lives only on
// the prototype/score-area branch. 8g is 8f with 8e's divider lines, a smaller ring, the rating
// chips on the rate button's row at the button's height, and the country selector next to the
// offer pills with the "Your services" legend moved down to the disclaimer line.
// Everything switches on the panel's own width (a container query, @[41rem] = 656 px), so the
// wide panel beside the poster, the narrow column at tablet width, and the phone card each get
// their own arrangement.
import { CheckIcon } from "@heroicons/react/20/solid"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import ListActions from "~/ui/details/hero/ListActions"
import { OFFER_LABEL, useStreamingLinks } from "~/ui/details/hero/WhereToWatch"
import CountrySelector from "~/ui/streaming/CountrySelector"
import type { Section } from "~/utils/scroll"
import { BigRing, BlurFrame, Divider } from "./round3"
import { Chips, EpisodesText, type Media, RateBtn, type VariantProps } from "./shared"

// 8g — Score row: 8f plus 8e's lines. Wide panels put ring, rate button, and chips on one row
// (chips at the button's height, Episode ratings under them); narrower panels keep ring and rate
// button on top and put the chips with Episode ratings (right-aligned) on the row below.
export function Variant8gScoreRow(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media} blur="sm">
			<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 @[41rem]:grid-cols-[auto_auto_minmax(0,1fr)] @[41rem]:grid-rows-[1fr_2.75rem_1fr] @[41rem]:gap-x-6 @[41rem]:gap-y-0">
				<div className="@[41rem]:col-start-1 @[41rem]:row-span-3 @[41rem]:row-start-1">
					<BigRing media={media} phone={72} desktop={96} />
				</div>
				<RateBtn media={media} align="left" className="min-w-0 @[41rem]:col-start-2 @[41rem]:row-start-2" />
				<div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 @[41rem]:col-span-1 @[41rem]:col-start-3 @[41rem]:row-span-2 @[41rem]:row-start-2 @[41rem]:flex-col @[41rem]:flex-nowrap @[41rem]:items-end @[41rem]:gap-y-1.5 @[41rem]:self-start">
					<Chips media={media} size="rise" layout="wrap" hideEmpty className="@[41rem]:flex-nowrap" />
					{hasEpisodeGrid && <EpisodesText className="ml-auto @[41rem]:ml-0" />}
				</div>
			</div>
			<div className="my-6 md:my-7">
				<Divider />
			</div>
			<WhereToWatchSplit media={media} country={p.country} navigateToSection={p.navigateToSection} />
			<div className="min-h-6 grow" />
			<div className="mb-6 md:mb-7">
				<Divider />
			</div>
			<ListActions media={media} />
		</BlurFrame>
	)
}

// ---------------------------------------------------------------------------------------------
// The production WhereToWatch with two pieces moved: the country selector joins the offer pills
// (right-aligned) and the "Your services" legend joins the disclaimer line (right side). Every
// piece keeps its production classes.

const TILE_H = 48
const GAP = 8

function WhereToWatchSplit({ media, country, navigateToSection }: { media: Media; country: string; navigateToSection: (s: Section) => void }) {
	const [type, setType] = useState<"flatrate" | "rent" | "buy">("flatrate")
	const [popover, setPopover] = useState<"none" | "country" | "all">("none")
	const ref = useRef<HTMLDivElement>(null)
	const gridRef = useRef<HTMLDivElement>(null)
	useClickOutside(ref, () => setPopover("none"))
	const links = useStreamingLinks(media, country, type === "flatrate" ? ["flatrate", "flatrate_and_buy", "free", "ads"] : [type])
	const anyOwned = links.some((l) => l.owned)

	const [capacity, setCapacity] = useState(6)
	useEffect(() => {
		const el = gridRef.current
		if (!el) return
		const measure = () => {
			const wide = window.matchMedia("(min-width: 768px)").matches
			const tileW = wide ? 152 : TILE_H
			const cols = Math.max(1, Math.floor((el.clientWidth + GAP) / (tileW + GAP)))
			setCapacity(cols * (wide ? 2 : 1))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const overflow = links.length > capacity
	const shown = overflow ? links.slice(0, capacity - 1) : links
	const flag = country ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg` : null

	const tile = (l: (typeof links)[number]) => (
		<a
			key={l.id}
			href={l.url}
			target="_blank"
			rel="noreferrer"
			title={l.owned ? `${l.name}: one of your services` : `${OFFER_LABEL[l.type] ?? "Watch"} on ${l.name}`}
			className={`relative flex shrink-0 items-center gap-2 rounded-lg border-2 bg-white/10 hover:brightness-125 md:w-[152px] md:bg-white/8 md:pr-2 ${
				l.owned ? "border-green-500" : "border-white/15"
			}`}
			style={{ height: TILE_H }}
		>
			<img src={l.logo} alt={l.name} className="aspect-square h-full rounded-md" />
			<span className="hidden truncate text-sm font-medium md:inline" aria-hidden="true">
				{l.name}
			</span>
			{l.owned && (
				<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
					<CheckIcon className="h-3 w-3" />
				</span>
			)}
		</a>
	)

	return (
		<div id="streaming" ref={ref} className="relative min-w-0">
			<div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
				<h2 className="whitespace-nowrap text-sm font-semibold text-gray-200 max-[430px]:sr-only">Where to watch</h2>
				<div role="tablist" aria-label="Offer type" className="flex rounded-full bg-white/8 p-0.5 text-xs">
					{(["flatrate", "rent", "buy"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={type === t}
							onClick={() => setType(t)}
							className={`rounded-full px-2.5 py-1 cursor-pointer ${type === t ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
						>
							{OFFER_LABEL[t]}
						</button>
					))}
				</div>
				<div className="relative -mr-2 ml-auto shrink-0 text-xs">
					<button
						type="button"
						onClick={() => setPopover(popover === "country" ? "none" : "country")}
						aria-expanded={popover === "country"}
						aria-label="Change country"
						className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-gray-300 hover:bg-white/10 cursor-pointer"
					>
						{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
						{country || "Country"}
						<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
					</button>
					{popover === "country" && (
						<div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
							<h3 className="mb-2 text-xs font-semibold text-gray-400">Show services in</h3>
							<CountrySelector
								mediaType={media.mediaType}
								countryCodes={media.details.streaming_country_codes}
								currentCountryCode={country}
								navigateToSection={navigateToSection}
							/>
						</div>
					)}
				</div>
			</div>
			<div ref={gridRef} className="mt-2.5 flex h-[52px] flex-wrap content-start gap-2 overflow-hidden pr-1 pt-1 md:h-[108px]">
				{shown.length === 0 && (
					<p className="text-sm text-gray-400">
						No {OFFER_LABEL[type].toLowerCase()} option in {country || "your country"} yet.
					</p>
				)}
				{shown.map(tile)}
				{overflow && (
					<button
						type="button"
						onClick={() => setPopover(popover === "all" ? "none" : "all")}
						aria-expanded={popover === "all"}
						aria-label={`Show all ${links.length} services`}
						className="flex w-12 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-sm font-semibold text-gray-200 hover:border-white/60 cursor-pointer md:w-[152px]"
						style={{ height: TILE_H }}
					>
						+{links.length - shown.length}
					</button>
				)}
			</div>
			{popover === "all" && (
				<div className="absolute bottom-0 left-0 right-0 z-40 max-w-2xl translate-y-[calc(100%+0.5rem)] rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
					<div className="flex flex-wrap gap-2 pt-1">{links.map(tile)}</div>
				</div>
			)}
			<div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<p className="text-[11px] text-gray-500">
					Links go to licensed services. Data from{" "}
					<a href="https://www.justwatch.com" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-gray-300">
						JustWatch
					</a>{" "}
					and{" "}
					<a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-gray-300">
						TMDB
					</a>
					.
				</p>
				{anyOwned ? (
					<span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-green-300">
						<span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-black">
							<CheckIcon className="h-2.5 w-2.5" />
						</span>
						Your services
					</span>
				) : (
					<Link to="/settings/streaming" className="ml-auto hidden text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white md:inline">
						Set your services
					</Link>
				)}
			</div>
		</div>
	)
}
