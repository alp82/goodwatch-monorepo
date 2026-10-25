import { useProductExposure } from "~/telemetry/useProductAnalytics"
import { brandOfService, servicePath } from "~/domain/new-on-services"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import { SERVICES_PATH } from "~/ui/settings/paths"
import {
	AdjustmentsHorizontalIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React, { useMemo, useRef, useState } from "react"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type {
	MovieResult,
	ShowResult,
	StreamingType,
} from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { UNDER_HEADERS } from "~/ui/details/header-height"
import { LogoStack } from "~/ui/details/hero/LogoStack"
import {
	type CountryCount,
	type CountryService,
	OFFER_VERB,
	countriesWithOffers,
	plural,
	topCountries,
} from "~/ui/details/hero/countryOffers"
import { useMediaPreference } from "~/ui/media-preference/MediaPreference"
import { preloadPreferenceDialog } from "~/ui/media-preference/PreferencePair"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import { useStreamingGlow } from "~/ui/details/hero/useStreamingGlow"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import {
	OFFER_TABS,
	type OfferTab,
	TAB_TYPES,
	type StreamingLink,
	duplicateProviderMapping,
	streamingLinks,
} from "~/utils/streaming-links"
import { useReplayedTap } from "~/utils/useReplayedTap"

type Media = MovieResult | ShowResult

export const OFFER_LABEL: Record<string, string> = {
	flatrate: "Stream",
	rent: "Rent",
	buy: "Buy",
	free: "Free",
	ads: "Free with ads",
}

/** The ids of the member's services, with the ids of the same brand's other entries. */
function useOwnedProviderIds() {
	return useUserStreamingProviders().flatMap((p) =>
		p.id in duplicateProviderMapping
			? [p.id, ...duplicateProviderMapping[p.id]]
			: [p.id],
	)
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
/** On a wide block (three or four cards to a row) twice as many show. */
const SHOWN_WIDE = 8

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

// The hero's where-to-watch block. A title row carries the settings on its right: the offer type, with how many
// services the country has for each, and the country. Under it the services as cards, logo beside name, two to a
// row on a narrow block and three or four on a wide one, yours first with a green ring. Four show narrow, eight
// wide; "All N services" opens the rest in place. On a narrow block a card that would stand alone in its row takes
// the whole row. One line under them tells how many other countries have the title.
// A country without the title for the offer type names the three countries with most services instead.
//
// The country is the header pair's (variant F): the country button and every other country here open the pair's
// dialog or preview a country through it, unsaved until Keep. While a save is under way they are off.
export default function WhereToWatch({
	media,
	country,
	shownCountry = country,
	preview = null,
	newPages,
	className = "",
}: {
	media: Media
	/** The country `media`'s offers are for. */
	country: string
	/** The brands with a page of new arrivals in the loaded country (#489): "More new on Netflix" under the logos. */
	newPages?: NewPagesHere
	/** The country the header pair shows; differs from `country` while its offers load or failed to load. */
	shownCountry?: string
	preview?: "loading" | "failed" | null
	className?: string
}) {
	const [type, setType] = useState<OfferTab>("flatrate")
	const [all, setAll] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useReplayedTap("offer", (el) => Boolean(ref.current?.contains(el)))
	const preference = useMediaPreference()
	// Arriving from the TV's Watch key, the block is highlighted once.
	const arrival = useStreamingGlow(ref)
	const owned = useOwnedProviderIds()
	const linksByTab = Object.fromEntries(
		OFFER_TABS.map((t) => [
			t,
			streamingLinks(media, country, TAB_TYPES[t], owned),
		]),
	) as Record<OfferTab, StreamingLink[]>
	const links = linksByTab[type]
 useProductExposure("availability checked", preview ? null : `${media.details.tmdb_id}:${country}:${type}`,
  { tmdb_id: media.details.tmdb_id, media_type: media.mediaType, country, offer_type: type, result_count: links.length })
	const countries = useMemo(
		() => countriesWithOffers(media, type),
		[media, type],
	)
	const others = countries.filter((c) => c.code !== country)
	const top = topCountries(media, type, country)
	const anyOwned = links.some((l) => l.owned)
	const shown = all ? links : links.slice(0, SHOWN_WIDE)
	const offer = OFFER_LABEL[type]
	const verb = OFFER_VERB[type]
	const here = country ? regionName(country) : "your country"
	// The streaming services here that have a page of new arrivals, two at most: "More new on Netflix" (#489). Only
	// for the loaded country's offers, so a previewed country never links to another country's page.
	const newOnHere =
		newPages && newPages.country === country && type === "flatrate"
			? [
					...new Set(
						links.flatMap((l) => {
							const brand = brandOfService(l.id)
							return brand && newPages.brands.includes(brand.slug) ? [brand] : []
						}),
					),
				].slice(0, 2)
			: []
	// Another offer type the country has, for a way out when this one has nothing.
	const otherTab = OFFER_TABS.find(
		(t) => t !== type && linksByTab[t].length > 0,
	)

	const chooseType = (t: OfferTab) => {
		setType(t)
		setAll(false)
	}
	const chooseCountry = (code: string) => {
		setAll(false)
		preference.pickCountry(code)
	}
	const openList = () => preference.openDialog("country")
	const off = preference.saving

	return (
		<div
			id="streaming"
			ref={ref}
			data-where-to-watch
			data-feedback-area="watch"
			{...arrival.block}
			className={`@container relative min-w-0 ${className}${arrival.className}`}
			// An address with `#streaming` lands the block clear of the site bar and the sticky title header.
			style={{ scrollMarginTop: UNDER_HEADERS }}
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
				<button
					type="button"
					data-country
					onClick={openList}
					onPointerEnter={preloadPreferenceDialog}
					onFocus={preloadPreferenceDialog}
					disabled={off}
					aria-haspopup="dialog"
					aria-label={`Country: ${regionName(shownCountry)}. Change`}
					className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
				>
					<img src={countryFlagUrl(shownCountry)} alt="" className="h-2.5 rounded-[1px]" />
					<span className="max-sm:hidden">{shownCountry}</span>
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
				</button>
			</div>
			{/* Over the services, not above them: a country's preview moves nothing on the page. The services under it are
			    the loaded country's, dimmed until the picked one's are in. */}
			<div className="relative">
			<p
				aria-live="polite"
				className={
					preview
						? "pointer-events-none absolute inset-x-0 top-1 z-10 mx-auto w-fit max-w-full rounded-full bg-stone-900/95 px-3 py-1 text-center text-xs text-gray-200 shadow-lg shadow-black/50 ring-1 ring-white/10"
						: "sr-only"
				}
			>
				{preview === "loading"
					? `Loading the services in ${regionName(shownCountry)}…`
					: preview === "failed"
						? `The services in ${regionName(shownCountry)} could not be loaded. These are ${regionName(country)}'s.`
						: ""}
			</p>
			<div className={preview ? "opacity-40" : ""} aria-busy={preview === "loading" || undefined}>
			{links.length === 0 ? (
				<NotHere
					others={others}
					top={top}
					known={media.streaming_countries !== undefined}
					here={here}
					verb={verb}
					disabled={off}
					onChoose={chooseCountry}
					onAll={openList}
				/>
			) : (
				<div data-services className="mt-2.5 grid grid-cols-2 gap-2 pt-0.5 @[36rem]:grid-cols-3 @[52rem]:grid-cols-4 @[52rem]:gap-3">
					{shown.map((l, i) => {
						// The last card of an odd number takes the whole row, and has room to say what it is.
						// On a narrow block, cards past the first four wait for "All N services".
						const narrowCount = Math.min(shown.length, all ? shown.length : SHOWN)
						const whole = i === narrowCount - 1 && narrowCount % 2 === 1
						const wideOnly = i >= narrowCount
						return (
							<a
								key={l.id}
								href={l.url} data-product-event="streaming service clicked" data-provider-id={l.id} data-tmdb-id={media.details.tmdb_id} data-media-type={media.mediaType} data-country={country} data-offer-type={l.type}
								target="_blank"
								rel="noreferrer"
								data-provider
								title={
									l.owned
										? `${l.name}: one of your services`
										: `${OFFER_LABEL[l.type] ?? "Watch"} on ${l.name}`
								}
								className={`relative flex h-12 min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.06] pr-2.5 hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${whole ? "col-span-2 @[36rem]:col-span-1" : ""} ${wideOnly ? "@max-[36rem]:hidden" : ""} ${
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
										className={`ml-auto shrink-0 text-xs @[36rem]:hidden ${l.owned ? "font-semibold text-green-300" : "text-gray-400"}`}
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
					className={`${links.length <= SHOWN_WIDE ? "@[36rem]:hidden " : ""}mt-2 h-8 w-full cursor-pointer rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
				>
					{all ? "Show fewer" : `All ${links.length} services`}
				</button>
			)}
			{newOnHere.length > 0 && (
				<p data-new-on className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
					{newOnHere.map((brand) => (
						<Link
							key={brand.slug}
							to={servicePath(country, brand)}
							prefetch="intent"
							className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200"
						>
							More new on {brand.name}
							<ChevronRightIcon className="h-3 w-3" aria-hidden />
						</Link>
					))}
				</p>
			)}
			{links.length > 0 && others.length > 0 && (
				<button
					type="button"
					data-other-countries
					disabled={off}
					onClick={openList}
					onPointerEnter={preloadPreferenceDialog}
					className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-left text-xs text-gray-400 hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-white"
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
			</div>
			</div>
			{/* Which services are yours is a setting. As before, the way to it shows from md up while none of these is. */}
			{!anyOwned && links.length > 0 && (
				<p className="mt-2 text-right max-md:hidden">
					<Link
						to={SERVICES_PATH}
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
	disabled,
	onChoose,
	onAll,
}: {
	others: CountryCount[]
	top: (CountryCount & { services: CountryService[] })[]
	known: boolean
	here: string
	verb: string
	disabled: boolean
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
							disabled={disabled}
							onClick={() => onChoose(c.code)}
							className="flex h-11 w-full cursor-pointer items-center gap-2.5 px-3 text-left hover:bg-white/[0.06] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
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
					disabled={disabled}
					onClick={onAll}
					onPointerEnter={preloadPreferenceDialog}
					className="mt-1.5 cursor-pointer text-xs font-semibold text-gray-300 hover:text-white disabled:cursor-wait disabled:opacity-50"
				>
					All {plural(others.length, "country", "countries")} →
				</button>
			)}
		</div>
	)
}
