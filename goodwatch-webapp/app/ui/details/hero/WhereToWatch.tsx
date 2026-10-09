import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React, { Suspense, lazy, useRef, useState } from "react"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type { MovieResult, ShowResult, StreamingType } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import { countryFlagUrl } from "~/utils/country-flag"
import type { Section } from "~/utils/scroll"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { brandName, duplicateProviderMapping, getShorterProviderLabel, getStreamingUrl, ignoredProviders } from "~/utils/streaming-links"

type Media = MovieResult | ShowResult

// The country list opens from the "Change country" button. Its code, with the list box of the dialog library, loads
// when a visitor reaches for the button (pointer, touch or focus), or at the latest when the list opens.
const loadCountrySelector = () => import("~/ui/streaming/CountrySelector")
const CountrySelector = lazy(reloadOnStaleChunk(loadCountrySelector))
const preloadCountrySelector = () => {
	void loadCountrySelector().catch(() => {})
}

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
				logoPath: s?.logo ?? "",
				url: getStreamingUrl(l, details, country, mediaType),
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

/** How many services show before "All N services" opens the rest in place: two rows of two. */
const SHOWN = 4

// The hero's where-to-watch block. A title row carries the settings on its right: the offer type and the country.
// Under it the services as cards, logo beside name, two to a row and yours first with a green ring. Four show;
// "All N services" opens the rest in place. A card that would stand alone in its row takes the whole row.
export default function WhereToWatch({ media, country, navigateToSection, className = "" }: { media: Media; country: string; navigateToSection: (s: Section) => void; className?: string }) {
	const [type, setType] = useState<"flatrate" | "rent" | "buy">("flatrate")
	const [countryOpen, setCountryOpen] = useState(false)
	const [all, setAll] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useClickOutside([ref], () => setCountryOpen(false))
	const links = useStreamingLinks(media, country, type === "flatrate" ? ["flatrate", "flatrate_and_buy", "free", "ads"] : [type])
	const anyOwned = links.some((l) => l.owned)
	const shown = all ? links : links.slice(0, SHOWN)
	const flag = country ? countryFlagUrl(country) : null
	const offer = OFFER_LABEL[type]

	return (
		<div id="streaming" ref={ref} data-where-to-watch className={`relative min-w-0 ${className}`}>
			<div className="flex min-w-0 items-center gap-1.5">
				<h2 className="mr-auto min-w-0 truncate text-sm font-semibold text-white">Where to watch</h2>
				<div role="tablist" aria-label="Offer type" className="flex shrink-0 rounded-full bg-white/8 p-0.5 text-[11px] sm:text-xs">
					{(["flatrate", "rent", "buy"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={type === t}
							onClick={() => {
								setType(t)
								setAll(false)
							}}
							className={`cursor-pointer rounded-full px-2 py-1 ${type === t ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
						>
							{OFFER_LABEL[t]}
						</button>
					))}
				</div>
				<div className="relative shrink-0 text-xs">
					<button
						type="button"
						data-country
						onClick={() => setCountryOpen(!countryOpen)}
						onPointerEnter={preloadCountrySelector}
						onTouchStart={preloadCountrySelector}
						onFocus={preloadCountrySelector}
						aria-expanded={countryOpen}
						aria-label="Change country"
						className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-gray-300 hover:bg-white/10"
					>
						{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
						<span className="max-sm:hidden">{country || "Country"}</span>
						<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
					</button>
					{countryOpen && (
						<div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
							<h3 className="mb-2 text-xs font-semibold text-gray-400">Show services in</h3>
							{/* The fallback has the height of the closed list, so the popover doesn't grow when it arrives. */}
							<Suspense fallback={<div className="h-9" aria-busy="true" />}>
								<CountrySelector
									mediaType={media.mediaType}
									countryCodes={media.details.streaming_country_codes}
									currentCountryCode={country}
									navigateToSection={navigateToSection}
								/>
							</Suspense>
						</div>
					)}
				</div>
			</div>
			{links.length === 0 ? (
				<p className="mt-2 text-sm text-gray-400">
					No {offer.toLowerCase()} option in {country || "your country"} yet.
				</p>
			) : (
				<div data-services className="mt-2.5 grid grid-cols-2 gap-2 pt-0.5">
					{shown.map((l, i) => {
						// The last card of an odd number takes the whole row, and has room to say what it is.
						const whole = i === shown.length - 1 && shown.length % 2 === 1
						return (
							<a
								key={l.id}
								href={l.url}
								target="_blank"
								rel="noreferrer"
								data-provider
								title={l.owned ? `${l.name}: one of your services` : `${OFFER_LABEL[l.type] ?? "Watch"} on ${l.name}`}
								className={`relative flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${whole ? "col-span-2" : ""} ${
									l.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"
								}`}
							>
								<TmdbImage kind="logo" path={l.logoPath} width={48} ratio={1} alt="" className="h-12 w-12 shrink-0 rounded-xl" />
								<span className="min-w-0 truncate text-sm font-medium text-white">{l.name}</span>
								{whole && (
									<span className={`ml-auto shrink-0 text-xs ${l.owned ? "font-semibold text-green-300" : "text-gray-400"}`}>{l.owned ? "On your services" : (OFFER_LABEL[l.type] ?? offer)}</span>
								)}
								{l.owned && (
									<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-black text-black ring-2 ring-stone-950" aria-hidden="true">
										✓
									</span>
								)}
							</a>
						)
					})}
				</div>
			)}
			{links.length > SHOWN && (
				<button
					type="button"
					data-all-services
					aria-expanded={all}
					onClick={() => setAll(!all)}
					className="mt-2 h-8 w-full cursor-pointer rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{all ? "Show fewer" : `All ${links.length} services`}
				</button>
			)}
			{/* Which services are yours is a setting. As before, the way to it shows from md up while none of these is. */}
			{!anyOwned && links.length > 0 && (
				<p className="mt-2 text-right max-md:hidden">
					<Link to="/settings/streaming" className="text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white">
						Set your services
					</Link>
				</p>
			)}
		</div>
	)
}
