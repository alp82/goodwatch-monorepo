import {
	AdjustmentsHorizontalIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { Link, useNavigate } from "@remix-run/react"
import React, { Suspense, lazy, useMemo, useRef, useState } from "react"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type {
	MovieResult,
	ShowResult,
	StreamingType,
} from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import { LogoStack } from "~/ui/details/hero/LogoStack"
import {
	type CountryCount,
	type CountryService,
	OFFER_VERB,
	countriesWithOffers,
	plural,
	topCountries,
} from "~/ui/details/hero/countryOffers"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import { useStreamingGlow } from "~/ui/details/hero/useStreamingGlow"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import {
	OFFER_TABS,
	type OfferTab,
	TAB_TYPES,
	brandName,
	duplicateProviderMapping,
	getShorterProviderLabel,
	getStreamingUrl,
	ignoredProviders,
} from "~/utils/streaming-links"
import { useReplayedTap } from "~/utils/useReplayedTap"

type Media = MovieResult | ShowResult

// The country list opens from the country button or from a link to all countries. Its code loads when a visitor
// reaches for the button (pointer, touch or focus), or at the latest when the list opens.
const loadCountryList = () => import("~/ui/details/hero/CountryList")
const CountryList = lazy(reloadOnStaleChunk(loadCountryList))
const preloadCountryList = () => {
	void loadCountryList().catch(() => {})
}

export const OFFER_LABEL: Record<string, string> = {
	flatrate: "Stream",
	rent: "Rent",
	buy: "Buy",
	free: "Free",
	ads: "Free with ads",
}

type StreamingLink = {
	id: number
	name: string
	logoPath: string
	url: string
	type: StreamingType
	owned: boolean
	order: number
}

/** The ids of the member's services, with the ids of the same brand's other entries. */
function useOwnedProviderIds() {
	return useUserStreamingProviders().flatMap((p) =>
		p.id in duplicateProviderMapping
			? [p.id, ...duplicateProviderMapping[p.id]]
			: [p.id],
	)
}

// Legal offers for the given offer types, one per brand, your services first.
function streamingLinks(
	media: Media,
	country: string,
	types: readonly string[],
	owned: number[],
): StreamingLink[] {
	const {
		details,
		mediaType,
		streaming_availabilities = [],
		streaming_services = [],
	} = media
	const seen = new Set<string>()
	return streaming_availabilities
		.filter(
			(l) =>
				types.includes(l.streaming_type) &&
				!ignoredProviders.includes(l.streaming_service_id),
		)
		.map((l) => {
			const s = streaming_services.find(
				(x) => x.tmdb_id === l.streaming_service_id,
			)
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

export function useStreamingLinks(
	media: Media,
	country: string,
	types: StreamingType[],
) {
	return streamingLinks(media, country, types, useOwnedProviderIds())
}

/** How many services show before "All N services" opens the rest in place: two rows of two. */
const SHOWN = 4

const FlagStack = ({ codes }: { codes: string[] }) => (
	<span className="flex shrink-0 -space-x-1.5">
		{codes.map((code) => (
			<img
				key={code}
				src={countryFlagUrl(code)}
				alt=""
				className="h-3.5 w-5 rounded-[2px] object-cover ring-2 ring-stone-950"
			/>
		))}
	</span>
)

const SITE_BAR_HEIGHT = 64

// The hero's where-to-watch block. A title row carries the settings on its right: the offer type, with how many
// services the country has for each, and the country. Under it the services as cards, logo beside name, two to a
// row and yours first with a green ring. Four show; "All N services" opens the rest in place. A card that would
// stand alone in its row takes the whole row. One line under them tells how many other countries have the title.
// A country without the title for the offer type names the three countries with most services instead.
export default function WhereToWatch({
	media,
	country,
	className = "",
}: { media: Media; country: string; className?: string }) {
	const [type, setType] = useState<OfferTab>("flatrate")
	const [countryOpen, setCountryOpen] = useState(false)
	const [all, setAll] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useClickOutside([ref], () => setCountryOpen(false))
	useReplayedTap("offer", (el) => Boolean(ref.current?.contains(el)))
	// Arriving from the TV's Watch key, the block is highlighted once.
	const arrival = useStreamingGlow(ref)
	const navigate = useNavigate()
	const owned = useOwnedProviderIds()
	const linksByTab = Object.fromEntries(
		OFFER_TABS.map((t) => [
			t,
			streamingLinks(media, country, TAB_TYPES[t], owned),
		]),
	) as Record<OfferTab, StreamingLink[]>
	const links = linksByTab[type]
	const countries = useMemo(
		() => countriesWithOffers(media, type),
		[media, type],
	)
	const others = countries.filter((c) => c.code !== country)
	const top = topCountries(media, type, country)
	const anyOwned = links.some((l) => l.owned)
	const shown = all ? links : links.slice(0, SHOWN)
	const flag = country ? countryFlagUrl(country) : null
	const offer = OFFER_LABEL[type]
	const verb = OFFER_VERB[type]
	const here = country ? regionName(country) : "your country"
	// Another offer type the country has, for a way out when this one has nothing.
	const otherTab = OFFER_TABS.find(
		(t) => t !== type && linksByTab[t].length > 0,
	)

	const chooseType = (t: OfferTab) => {
		setType(t)
		setAll(false)
	}
	const chooseCountry = (code: string) => {
		setCountryOpen(false)
		setAll(false)
		try {
			localStorage.setItem("country", code)
		} catch {}
		navigate(`?country=${code}`, { preventScrollReset: true })
	}
	const openList = () => {
		preloadCountryList()
		setCountryOpen(true)
	}

	return (
		<div
			id="streaming"
			ref={ref}
			data-where-to-watch
			{...arrival.block}
			className={`@container relative min-w-0 ${className}${arrival.className}`}
			// An address with `#streaming` lands the block clear of the site bar and the sticky title header.
			style={{ scrollMarginTop: `calc(${HEADER_HEIGHT} + ${SITE_BAR_HEIGHT + 16}px)` }}
		>
			{arrival.rules}
			<div className="flex min-w-0 items-center justify-end gap-1.5">
				<h2
					aria-label="Where to watch"
					className="mr-auto min-w-0 truncate text-sm font-semibold text-white @max-[18rem]:sr-only"
				>
					{/* A narrow box has no room for the three words beside the tabs and the country, the narrowest for any. */}
					<span className="@[30rem]:hidden">Watch</span>
					<span className="hidden @[30rem]:inline">Where to watch</span>
				</h2>
				<div
					role="tablist"
					aria-label="Offer type"
					className="flex shrink-0 rounded-full bg-white/8 p-0.5 text-[11px] sm:text-xs"
				>
					{OFFER_TABS.map((t) => {
						const count = linksByTab[t].length
						return (
							<button
								key={t}
								type="button"
								role="tab"
								aria-selected={type === t}
								aria-label={`${OFFER_LABEL[t]}: ${plural(count, "service", "services")}`}
								data-replay-tap={`offer:${t}`}
								onClick={() => chooseType(t)}
								className={`inline-flex cursor-pointer items-center gap-0.5 rounded-full px-1.5 py-1 @[24rem]:gap-1 @[24rem]:px-2 ${
									type === t
										? "bg-white font-semibold text-black"
										: count
											? "text-gray-300 hover:text-white"
											: "text-gray-500 hover:text-gray-300"
								}`}
							>
								{OFFER_LABEL[t]}
								{count > 0 && (
									<span
										className={`min-w-3.5 rounded-full px-0.5 text-center @[24rem]:min-w-4 @[24rem]:px-1 text-[10px] font-bold leading-4 tabular-nums ${type === t ? "bg-black/10 text-black" : "bg-white/10 text-gray-200"}`}
									>
										{count}
									</span>
								)}
							</button>
						)
					})}
				</div>
				<div className="relative shrink-0 text-xs">
					<button
						type="button"
						data-country
						onClick={() => setCountryOpen(!countryOpen)}
						onPointerEnter={preloadCountryList}
						onTouchStart={preloadCountryList}
						onFocus={preloadCountryList}
						aria-expanded={countryOpen}
						aria-label="Change country"
						className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-gray-300 hover:bg-white/10"
					>
						{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
						<span className="max-sm:hidden">{country || "Country"}</span>
						<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
					</button>
					{countryOpen && (
						<div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
							<h3 className="mb-2 text-xs font-semibold text-gray-400">
								Show services in
							</h3>
							{/* The fallback has the height of the search field, so the popover grows only once. */}
							<Suspense fallback={<div className="h-8" aria-busy="true" />}>
								<CountryList
									mediaType={media.mediaType}
									titleId={media.details.tmdb_id}
									tab={type}
									rows={countries}
									current={country}
									verb={verb}
									onChoose={chooseCountry}
								/>
							</Suspense>
						</div>
					)}
				</div>
			</div>
			{links.length === 0 ? (
				<NotHere
					others={others}
					top={top}
					known={media.streaming_countries !== undefined}
					here={here}
					verb={verb}
					onChoose={chooseCountry}
					onAll={openList}
				/>
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
								title={
									l.owned
										? `${l.name}: one of your services`
										: `${OFFER_LABEL[l.type] ?? "Watch"} on ${l.name}`
								}
								className={`relative flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${whole ? "col-span-2" : ""} ${
									l.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"
								}`}
							>
								<TmdbImage
									kind="logo"
									path={l.logoPath}
									width={48}
									ratio={1}
									alt=""
									className="h-12 w-12 shrink-0 rounded-xl"
								/>
								<span className="min-w-0 truncate text-sm font-medium text-white">
									{l.name}
								</span>
								{whole && (
									<span
										className={`ml-auto shrink-0 text-xs ${l.owned ? "font-semibold text-green-300" : "text-gray-400"}`}
									>
										{l.owned
											? "On your services"
											: (OFFER_LABEL[l.type] ?? offer)}
									</span>
								)}
								{l.owned && (
									<span
										className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-black text-black ring-2 ring-stone-950"
										aria-hidden="true"
									>
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
			{links.length > 0 && others.length > 0 && (
				<button
					type="button"
					data-other-countries
					onClick={openList}
					onPointerEnter={preloadCountryList}
					className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
				>
					<FlagStack codes={others.slice(0, 3).map((c) => c.code)} />
					<span className="min-w-0 truncate">
						Also {verb} in{" "}
						<span className="font-semibold text-gray-200">
							{plural(others.length, "other country", "other countries")}
						</span>
					</span>
					<ChevronRightIcon className="ml-auto h-3.5 w-3.5 shrink-0" />
				</button>
			)}
			{links.length === 0 && otherTab && (
				<button
					type="button"
					onClick={() => chooseType(otherTab)}
					className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-300 hover:text-white"
				>
					{OFFER_LABEL[otherTab]} it in {here} instead
					<ChevronRightIcon className="h-3 w-3" />
				</button>
			)}
			{/* Which services are yours is a setting. As before, the way to it shows from md up while none of these is. */}
			{!anyOwned && links.length > 0 && (
				<p className="mt-2 text-right max-md:hidden">
					<Link
						to="/settings/streaming"
						className="text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
					>
						Set your services
					</Link>
				</p>
			)}
		</div>
	)
}

// The country has nothing for this offer type: the three countries with most services, each a way to switch.
// Details cached before they carried the other countries don't know them (known is false), and say less.
function NotHere({
	others,
	top,
	known,
	here,
	verb,
	onChoose,
	onAll,
}: {
	others: CountryCount[]
	top: (CountryCount & { services: CountryService[] })[]
	known: boolean
	here: string
	verb: string
	onChoose: (code: string) => void
	onAll: () => void
}) {
	if (others.length === 0)
		return (
			<p className="mt-2 text-sm text-gray-400">
				{known ? `Not ${verb} in any country yet.` : `Not ${verb} in ${here}.`}
			</p>
		)
	return (
		<div className="mt-2">
			<p className="text-sm text-gray-400">
				Not {verb} in {here}. Where it is:
			</p>
			<ul
				data-other-countries
				className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-white/10"
			>
				{top.map((c) => (
					<li key={c.code}>
						<button
							type="button"
							onClick={() => onChoose(c.code)}
							className="flex h-11 w-full cursor-pointer items-center gap-2.5 px-3 text-left hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
						>
							<img
								src={countryFlagUrl(c.code)}
								alt=""
								className="h-3.5 rounded-[1px]"
							/>
							<span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
								{c.name}
							</span>
							<LogoStack services={c.services} />
							<ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
						</button>
					</li>
				))}
			</ul>
			{others.length > 3 && (
				<button
					type="button"
					onClick={onAll}
					onPointerEnter={preloadCountryList}
					className="mt-1.5 cursor-pointer text-xs font-semibold text-gray-300 hover:text-white"
				>
					All {plural(others.length, "country", "countries")} →
				</button>
			)}
		</div>
	)
}
