// Where to watch:
//   1. A toolbar: the offer type as a segmented control with counts, then the country (flag and name; on a phone flag
//      and code), which opens the header pair's country dialog. A picked country previews dimmed until its offers are
//      in. "Set your services" at the right (a gear on a phone) for a member without one of these services.
//   2. The services as a contained list, the whole row the link, the member's own first and marked. Each row has a
//      faint glow of its service's color behind the logo, and an "Open ↗" mark that reads as a button.
//   3. Quieter rows under the list: "Also streaming in N other countries" and "What's new on Netflix" (#489).
// A country without the offer names the countries that have it, each a way to switch.
// An address with #streaming lands here; arriving from the TV's Watch key, the block glows once (useStreamingGlow).
import {
	ArrowTopRightOnSquareIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	Cog6ToothIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useMemo, useRef, useState } from "react"
import { brandOfService, servicePath } from "~/domain/new-on-services"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useProductExposure } from "~/telemetry/useProductAnalytics"
import { TmdbImage } from "~/ui/TmdbImage"
import { UNDER_HEADERS } from "~/ui/details/header-height"
import { LogoStack } from "~/ui/details/hero/LogoStack"
import {
	OFFER_VERB,
	countriesWithOffers,
	plural,
	topCountries,
} from "~/ui/details/hero/countryOffers"
import { useStreamingGlow } from "~/ui/details/hero/useStreamingGlow"
import { LIST, ROW } from "~/ui/details/page-ui"
import { useOwnedProviderIds } from "~/ui/details/streaming"
import { useMediaPreference } from "~/ui/media-preference/MediaPreference"
import { preloadPreferenceDialog } from "~/ui/media-preference/PreferencePair"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { countryFlagUrl } from "~/utils/country-flag"
import { regionName } from "~/utils/display-names"
import {
	OFFER_TABS,
	type OfferTab,
	type StreamingLink,
	TAB_TYPES,
	streamingLinks,
} from "~/utils/streaming-links"
import { useReplayedTap } from "~/utils/useReplayedTap"

type Media = MovieResult | ShowResult

const TAB_LABEL: Record<OfferTab, string> = {
	flatrate: "Stream",
	rent: "Rent",
	buy: "Buy",
}
const TYPE_LABEL: Record<string, string> = {
	flatrate: "Subscription",
	flatrate_and_buy: "Subscription",
	free: "Free",
	ads: "Free with ads",
	rent: "Rent",
	buy: "Buy",
}
/** A secondary full-width row under the services: slim, a hint of a card, hover and pressed states. */
const ALSO =
	"group flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg bg-white/[0.02] px-3 text-left text-[13px] text-gray-400 ring-1 ring-white/[0.05] transition-colors duration-150 hover:bg-white/[0.05] hover:text-white hover:ring-white/10 active:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
/** The service list: a brighter surface than the rows under it, with a faint amber wash from its top left. */
const SERVICES =
	"divide-y divide-white/[0.07] overflow-hidden rounded-xl bg-[radial-gradient(120%_140%_at_0%_0%,rgb(252_211_77/.07),transparent_60%),linear-gradient(rgb(255_255_255/.045),rgb(255_255_255/.03))] shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)] ring-1 ring-white/[0.13]"
/** Brand colors for the glow behind a service's logo (by GoodWatch brand slug); others glow amber. */
const BRAND_GLOW: Record<string, string> = {
	netflix: "#e50914",
	"amazon-prime": "#1a98ff",
	"disney-plus": "#2f6bff",
	"hbo-max": "#6d4aff",
	"apple-tv": "#a8a29e",
	hulu: "#1ce783",
	peacock: "#7c6cff",
	"paramount-plus": "#2f7bff",
	crunchyroll: "#f47521",
	mubi: "#a8a29e",
}
const glowOf = (id: number) =>
	BRAND_GLOW[brandOfService(id)?.slug ?? ""] ?? "#fcd34d"
/** Rows before "All N services". */
const SHOWN = 5

export function WatchSection({
	media,
	country,
	shownCountry,
	preview,
	newPages,
}: {
	media: Media
	/** The country `media`'s offers are for. */
	country: string
	/** The country the header pair shows; differs from `country` while its offers load or failed to load. */
	shownCountry: string
	preview: "loading" | "failed" | null
	/** The brands with a page of new arrivals in the loaded country (#489). */
	newPages?: NewPagesHere
}) {
	const ref = useRef<HTMLDivElement>(null)
	// A tap on an offer tab before the app's script was there (utils/replay-tap.ts).
	useReplayedTap("offer", (el) => Boolean(ref.current?.contains(el)))
	// Arriving from the TV's Watch key, the block is highlighted once.
	const arrival = useStreamingGlow(ref)
	const owned = useOwnedProviderIds()
	const preference = useMediaPreference()
	const byTab = useMemo(
		() =>
			Object.fromEntries(
				OFFER_TABS.map((t) => [
					t,
					streamingLinks(media, country, TAB_TYPES[t], owned),
				]),
			) as Record<OfferTab, StreamingLink[]>,
		[media, country, owned],
	)
	// Start on the first tab that has something, so a rent-only title doesn't open on an empty list.
	const [type, setType] = useState<OfferTab>(
		() => OFFER_TABS.find((t) => byTab[t].length) ?? "flatrate",
	)
	const [all, setAll] = useState(false)
	const links = byTab[type]
	useProductExposure(
		"availability checked",
		preview ? null : `${media.details.tmdb_id}:${country}:${type}`,
		{
			tmdb_id: media.details.tmdb_id,
			media_type: media.mediaType,
			country,
			offer_type: type,
			result_count: links.length,
		},
	)
	const shown = all ? links : links.slice(0, SHOWN)
	const countries = useMemo(
		() => countriesWithOffers(media, type),
		[media, type],
	)
	const others = countries.filter((c) => c.code !== country)
	const verb = OFFER_VERB[type]
	const here = regionName(shownCountry)
	const off = preference.saving
	const anyOwned = links.some((l) => l.owned)
	const openCountries = () => preference.openDialog("country")

	// "What's new on Netflix" (#489): the streaming services here with a page of new arrivals, two at most, only for
	// the loaded country and while no other country previews, so the rows never link to a country the block doesn't show.
	const seen = new Set<string>()
	const newOn =
		newPages &&
		newPages.country === country &&
		!preview &&
		shownCountry === country &&
		type === "flatrate"
			? links
					.flatMap((l) => {
						const brand = brandOfService(l.id)
						if (
							!brand ||
							seen.has(brand.slug) ||
							!newPages.brands.includes(brand.slug)
						)
							return []
						seen.add(brand.slug)
						return [{ brand, logoPath: l.logoPath }]
					})
					.slice(0, 2)
			: []

	return (
		<div
			id="streaming"
			ref={ref}
			data-feedback-area="watch"
			{...arrival.block}
			className={`rounded-xl${arrival.className}`}
			style={{ scrollMarginTop: UNDER_HEADERS }}
		>
			{arrival.rules}
			{/* What kind of offer, and where; one row on a phone too. */}
			<div className="flex flex-wrap items-center gap-x-1.5 gap-y-3 sm:gap-x-3">
				<div
					role="tablist"
					aria-label="Offer type"
					className="flex rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/10"
				>
					{OFFER_TABS.map((t) => {
						const count = byTab[t].length
						const on = t === type
						return (
							<button
								key={t}
								type="button"
								role="tab"
								aria-selected={on}
								aria-label={`${TAB_LABEL[t]} ${plural(count, "service", "services")}`}
								data-replay-tap={`offer:${t}`}
								onClick={() => {
									setType(t)
									setAll(false)
								}}
								className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors duration-150 sm:px-3 ${
									on
										? "bg-white/[0.12] font-semibold text-white"
										: count
											? "text-gray-300 hover:text-white"
											: "text-gray-500 hover:text-gray-300"
								}`}
							>
								{TAB_LABEL[t]}{" "}
								<span
									className={`text-xs tabular-nums ${on ? "text-amber-300" : "text-gray-500"}`}
								>
									{count}
								</span>
							</button>
						)
					})}
				</div>
				<button
					type="button"
					data-country
					onClick={openCountries}
					onPointerEnter={preloadPreferenceDialog}
					onFocus={preloadPreferenceDialog}
					disabled={off}
					aria-haspopup="dialog"
					aria-label={`${shownCountry}. Country: ${here}. Change`}
					className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50 sm:gap-2 sm:px-2"
				>
					<img
						src={countryFlagUrl(shownCountry)}
						alt=""
						className="h-3 rounded-[1px]"
					/>
					<span className="max-sm:hidden">{here}</span>
					<span className="font-semibold sm:hidden">{shownCountry}</span>
					<ChevronDownIcon className="h-4 w-4 text-gray-500" />
				</button>
				{preview && (
					<span
						aria-live="polite"
						className="text-xs text-gray-400 max-sm:order-last max-sm:basis-full"
					>
						{preview === "loading"
							? `Loading ${here}…`
							: `${here} could not be loaded. These are ${regionName(country)}'s.`}
					</span>
				)}
				{!anyOwned && (
					<Link
						to={SERVICES_PATH}
						aria-label="Set your services"
						className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors duration-150 hover:bg-white/5 hover:text-white max-sm:-mr-2 max-sm:w-9 max-sm:justify-center"
					>
						<Cog6ToothIcon
							className="h-5 w-5 text-gray-400 sm:hidden"
							aria-hidden="true"
						/>
						<span className="max-sm:hidden">Set your services</span>
						<ChevronRightIcon className="h-4 w-4 text-gray-500 max-sm:hidden" />
					</Link>
				)}
			</div>

			<div
				className={`mt-4 ${preview ? "opacity-40" : ""}`}
				aria-busy={preview === "loading" || undefined}
			>
				{links.length ? (
					<ul className={SERVICES}>
						{shown.map((l) => (
							<li key={l.id}>
								<a
									href={l.url}
									target="_blank"
									rel="noreferrer"
									data-provider
									data-product-event="streaming service clicked"
									data-provider-id={l.id}
									data-tmdb-id={media.details.tmdb_id}
									data-media-type={media.mediaType}
									data-country={country}
									data-offer-type={l.type}
									aria-description={`${TYPE_LABEL[l.type] ?? "Watch"} on ${l.name}${l.owned ? ", one of your services" : ""}. Opens ${l.name}`}
									className={`${ROW} relative isolate h-16`}
								>
									{/* The service's color, faint, behind its logo. */}
									<span
										aria-hidden="true"
										className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-64 opacity-[.2] transition-opacity duration-150 group-hover:opacity-30"
										style={{
											background: `radial-gradient(70% 120% at 0% 50%, ${glowOf(l.id)}, transparent 70%)`,
										}}
									/>
									<span className="relative shrink-0">
										<TmdbImage
											kind="logo"
											path={l.logoPath}
											width={40}
											ratio={1}
											alt=""
											className={`h-10 w-10 rounded-lg ${l.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"}`}
										/>
										{l.owned && (
											<span
												aria-hidden="true"
												className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950"
											>
												<CheckIcon className="h-3 w-3" />
											</span>
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-[15px] font-semibold text-white">
											{l.name}
										</span>
										<span className="block truncate text-xs text-gray-400">
											{TYPE_LABEL[l.type] ?? TAB_LABEL[type]}
											{l.owned && (
												<span className="font-semibold text-green-300">
													{" "}
													· Your service
												</span>
											)}
										</span>
									</span>
									{/* Reads as a button; the whole row is the link. */}
									<span
										aria-hidden="true"
										className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-gray-200 ring-1 ring-white/15 transition-colors duration-150 group-hover:bg-white group-hover:text-black group-hover:ring-white group-active:scale-[.97]"
									>
										<span>
											Open
											<span className="max-sm:hidden">
												{" "}
												{l.name.length <= 14 ? l.name : ""}
											</span>
										</span>
										<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
									</span>
								</a>
							</li>
						))}
						{links.length > SHOWN && (
							<li>
								<button
									type="button"
									aria-expanded={all}
									onClick={() => setAll(!all)}
									className="flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 text-sm font-semibold text-gray-300 hover:bg-white/[0.04] hover:text-white"
								>
									{all ? "Show fewer" : `All ${links.length} services`}
									<ChevronDownIcon
										className={`h-4 w-4 text-gray-500 transition-transform duration-150 ${all ? "rotate-180" : ""}`}
									/>
								</button>
							</li>
						)}
					</ul>
				) : (
					<NotHere
						media={media}
						type={type}
						country={country}
						here={regionName(country)}
						verb={verb}
						disabled={off}
						onChoose={(c) => preference.pickCountry(c)}
						onAll={openCountries}
					/>
				)}
			</div>

			{/* Other countries, and what's new on a service here: full rows on a faint card, so they read as pressable. */}
			{links.length > 0 && (others.length > 0 || newOn.length > 0) && (
				<div className="mt-2.5 flex flex-col gap-1">
					{others.length > 0 && (
						<button
							type="button"
							disabled={off}
							onClick={openCountries}
							onPointerEnter={preloadPreferenceDialog}
							className={`${ALSO} disabled:cursor-wait disabled:opacity-50`}
						>
							<span className="flex w-10 shrink-0 justify-center -space-x-2">
								{others.slice(0, 3).map((c) => (
									<img
										key={c.code}
										src={countryFlagUrl(c.code)}
										alt=""
										className="h-3 w-[18px] rounded-[2px] object-cover ring-2 ring-stone-900"
									/>
								))}
							</span>
							<span className="min-w-0 flex-1 truncate">
								Also {verb} in{" "}
								<span className="font-semibold text-gray-200">
									{plural(others.length, "other country", "other countries")}
								</span>
							</span>
							<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gray-300" />
						</button>
					)}
					{newOn.map(({ brand, logoPath }) => (
						<Link
							key={brand.slug}
							to={servicePath(country, brand)}
							prefetch="intent"
							className={ALSO}
						>
							<span className="flex w-10 shrink-0 justify-center">
								<TmdbImage
									kind="logo"
									path={logoPath}
									width={20}
									ratio={1}
									alt=""
									className="h-[18px] w-[18px] rounded-[4px] ring-1 ring-white/10"
								/>
							</span>
							<span className="min-w-0 flex-1 truncate">
								What's new on{" "}
								<span className="font-semibold text-gray-200">
									{brand.name}
								</span>
							</span>
							<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gray-300" />
						</Link>
					))}
				</div>
			)}
		</div>
	)
}

/** Nothing of this kind here: the countries with the most services, as rows like the services'. */
function NotHere({
	media,
	type,
	country,
	here,
	verb,
	disabled,
	onChoose,
	onAll,
}: {
	media: Media
	type: OfferTab
	country: string
	here: string
	verb: string
	disabled: boolean
	onChoose: (code: string) => void
	onAll: () => void
}) {
	const top = topCountries(media, type, country)
	const others = countriesWithOffers(media, type).filter(
		(c) => c.code !== country,
	)
	if (!top.length)
		return (
			<p className="text-[15px] text-gray-300">
				Not {verb} in any country yet.
			</p>
		)
	return (
		<div>
			<p className="text-[15px] text-gray-300">
				Not {verb} in {here}. Where it is:
			</p>
			<ul className={`${LIST} mt-3`}>
				{top.map((c) => (
					<li key={c.code}>
						<button
							type="button"
							disabled={disabled}
							onClick={() => onChoose(c.code)}
							className={`${ROW} h-14 disabled:cursor-wait`}
						>
							<img
								src={countryFlagUrl(c.code)}
								alt=""
								className="h-4 rounded-[1px]"
							/>
							<span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
								{c.name}
							</span>
							<LogoStack services={c.services} />
							<ChevronRightIcon className="h-4 w-4 text-gray-500" />
						</button>
					</li>
				))}
			</ul>
			{others.length > top.length && (
				<button
					type="button"
					disabled={disabled}
					onClick={onAll}
					className="mt-3 cursor-pointer text-sm text-gray-400 hover:text-white"
				>
					All {plural(others.length, "country", "countries")}
				</button>
			)}
		</div>
	)
}
