// PROTOTYPE — round 4 score-area layout, grown from round 3's 8f (the owner's pick). Lives only on
// the prototype/score-area branch. 8g is 8f with 8e's divider lines, a smaller ring, the rating
// chips on their own row under the ring and the rate button (Episode ratings right-aligned on the
// same row), and the country selector next to the offer pills with the "Your services" legend
// moved down to the disclaimer line. The same arrangement holds at every width.
// Round 5: the poster is exactly as tall as the panel beside it and keeps 2:3, so the panel's
// height drives the poster's width (see PosterMatchedFrame).
import { CheckIcon } from "@heroicons/react/20/solid"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import ListActions from "~/ui/details/hero/ListActions"
import { BackdropTrailer, PosterTrailer, backdropUrl } from "~/ui/details/hero/Trailer"
import { OFFER_LABEL, useStreamingLinks } from "~/ui/details/hero/WhereToWatch"
import CountrySelector from "~/ui/streaming/CountrySelector"
import type { Section } from "~/utils/scroll"
import { BigRing, Divider } from "./round3"
import { Chips, EpisodesText, type Media, RateBtn, type VariantProps } from "./shared"

// 8g — Score row: 8f plus 8e's lines. Ring and rate button on top, the chips with Episode ratings
// (right-aligned; it wraps to its own line, still right-aligned, when the row is too narrow) below.
export function Variant8gScoreRow(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<PosterMatchedFrame media={media}>
			<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4">
				<BigRing media={media} phone={72} desktop={96} />
				<RateBtn media={media} align="left" className="min-w-0" />
				<div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
					<Chips media={media} size="sm" layout="wrap" hideEmpty />
					{hasEpisodeGrid && <EpisodesText className="ml-auto" />}
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
		</PosterMatchedFrame>
	)
}

// ---------------------------------------------------------------------------------------------
// Round 3's BlurFrame (sm blur, production gradient) with the poster matched to the panel.
//
// The panel sits in the grid's second column; its content alone sets the row's height (the grid
// has a floor of MIN_W * 1.5). The poster is absolutely positioned in the first column, so it
// never feeds back into the row height: CSS gives it height min(100%, column width * 1.5) and
// width from aspect-ratio 2/3, so it is exactly the panel's height unless the column is too
// narrow, and it never crops or stretches. A ResizeObserver sets the column width to 2/3 of the
// panel's height, clamped to [MIN_W, min(MAX_W, 40% of the row)]. Narrower column means a wider
// panel, a possibly shorter panel, and so on, so it re-measures until it settles (a few passes
// at most; within a second it stops if it revisits a width). The server renders a per-breakpoint default
// (the settled value for Breaking Bad) so there is no visible shift on hydration.

const MIN_W = 192 // 12rem
const MAX_W = 352 // 22rem
const MAX_SHARE = 0.4

function PosterMatchedFrame({ media, children }: { media: Media; children: React.ReactNode }) {
	const rowRef = useRef<HTMLDivElement>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	const [posterW, setPosterW] = useState<number | null>(null)
	useEffect(() => {
		const row = rowRef.current
		const box = boxRef.current
		if (!row || !box) return
		const seen = new Set<number>()
		let lastRowW = -1
		let forget: ReturnType<typeof setTimeout> | undefined
		const measure = () => {
			if (!window.matchMedia("(min-width: 768px)").matches) return
			const rowW = row.clientWidth
			if (rowW !== lastRowW) {
				seen.clear()
				lastRowW = rowW
			}
			const max = Math.min(MAX_W, Math.floor(rowW * MAX_SHARE))
			const next = Math.round(Math.min(max, Math.max(MIN_W, (box.offsetHeight * 2) / 3)))
			if (seen.has(next)) return
			seen.add(next)
			setPosterW((w) => (w === next ? w : next))
			// Once it has settled, later content changes (a rating, another offer tab) start fresh.
			clearTimeout(forget)
			forget = setTimeout(() => seen.clear(), 1000)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(row)
		ro.observe(box)
		return () => {
			ro.disconnect()
			clearTimeout(forget)
		}
	}, [])
	const style = posterW == null ? undefined : ({ "--poster-w": `${posterW}px` } as React.CSSProperties)
	return (
		<div
			ref={rowRef}
			style={style}
			className="grid gap-4 md:min-h-[18rem] md:grid-cols-[var(--poster-w)_minmax(0,1fr)] md:[--poster-w:21rem] lg:[--poster-w:20.5rem] [&>*]:min-w-0"
		>
			<div className="relative hidden md:block">
				<div className="absolute left-0 top-0 aspect-[2/3] h-[min(100%,var(--poster-w)*1.5)]">
					<PosterTrailer media={media} className="block h-full w-full" />
				</div>
			</div>
			<div ref={boxRef} className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10" aria-hidden="true">
					<img src={backdropUrl(media)} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />
					<div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
				</div>
				<BackdropTrailer
					media={media}
					className="h-44 [mask-image:linear-gradient(to_bottom,black_65%,transparent)] md:hidden [&_span.bg-gradient-to-b]:hidden"
				/>
				<div className="@container flex grow flex-col px-4 pb-5 pt-2 md:p-5 lg:p-7">{children}</div>
			</div>
		</div>
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
	useClickOutside([ref], () => setPopover("none"))
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
