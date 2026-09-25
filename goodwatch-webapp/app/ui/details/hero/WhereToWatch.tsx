import { CheckIcon } from "@heroicons/react/20/solid"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React, { useEffect, useRef, useState } from "react"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type { MovieResult, ShowResult, StreamingType } from "~/server/types/details-types"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import CountrySelector from "~/ui/streaming/CountrySelector"
import type { Section } from "~/utils/scroll"
import { brandName, duplicateProviderMapping, getShorterProviderLabel, getStreamingUrl, ignoredProviders } from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

export const OFFER_LABEL: Record<string, string> = { flatrate: "Stream", rent: "Rent", buy: "Buy", free: "Free", ads: "Free with ads" }

// Legal offers for the given offer types, one per brand, your services first.
export function useStreamingLinks(media: Media, country: string, types: StreamingType[]) {
	const { details, mediaType, streaming_availabilities = [], streaming_services = [] } = media
	const owned = useUserStreamingProviders().flatMap((p) => (p.id in duplicateProviderMapping ? [p.id, ...duplicateProviderMapping[p.id]] : [p.id]))
	const seen = new Set<string>()
	return streaming_availabilities
		.filter((l) => types.includes(l.streaming_type) && !ignoredProviders.includes(l.streaming_service_id))
		.map((l) => {
			const s = streaming_services.find((x) => x.tmdb_id === l.streaming_service_id)
			return {
				id: l.streaming_service_id,
				name: s ? brandName(getShorterProviderLabel(s.name)) : "",
				logo: s ? `https://www.themoviedb.org/t/p/original/${s.logo}` : "",
				url: getStreamingUrl(l as never, details as never, country, mediaType),
				type: l.streaming_type,
				owned: owned.includes(l.streaming_service_id),
				order: s?.order_default ?? 999,
			}
		})
		.filter((l) => l.name)
		.sort((a, b) => Number(b.owned) - Number(a.owned) || a.order - b.order)
		.filter((l) => {
			if (seen.has(l.name)) return false
			seen.add(l.name)
			return true
		})
}

const TILE_H = 48
const GAP = 8

// Offer tiles in a fixed number of rows so switching offer type or country
// never changes the height: one row of logos on phones, two rows of named
// tiles from md up. When the rows are full, the last tile opens the full list.
export default function WhereToWatch({ media, country, navigateToSection }: { media: Media; country: string; navigateToSection: (s: Section) => void }) {
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
			<div className="flex items-center gap-2">
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
				<div className="ml-auto flex shrink-0 items-center gap-3 text-xs">
					{anyOwned ? (
						<span className="inline-flex items-center gap-1 text-green-300">
							<span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-black">
								<CheckIcon className="h-2.5 w-2.5" />
							</span>
							Your services
						</span>
					) : (
						<Link to="/settings/streaming" className="hidden text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white md:inline">
							Set your services
						</Link>
					)}
					<div className="relative">
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
			</div>
			<div
				ref={gridRef}
				className="mt-2.5 flex h-[52px] flex-wrap content-start gap-2 overflow-hidden pr-1 pt-1 md:h-[108px]"
			>
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
			<p className="mt-2 text-[11px] text-gray-500">
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
		</div>
	)
}
