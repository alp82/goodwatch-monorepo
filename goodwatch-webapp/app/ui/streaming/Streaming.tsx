import { ExclamationTriangleIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import tmdb_logo from "~/img/tmdb-logo.svg"
import type {
	MovieDetails,
	StreamingLink,
	TVDetails,
} from "~/server/details.server"
import InfoBox from "~/ui/InfoBox"
import { getStreamingUrl } from "~/utils/streaming-links"

export interface StreamingProps {
	details: MovieDetails | TVDetails
	media_type: "movie" | "tv"
	links: StreamingLink[]
	currentCountryCode: string
	countryCodes: string[]
}

export default function Streaming({
	details,
	media_type,
	links,
	currentCountryCode,
	countryCodes = [],
}: StreamingProps) {
	const flatrateLinks = (links || []).filter((link: StreamingLink) =>
		["flatrate", "free"].includes(link.stream_type),
	)
	const buyLinks = (links || []).filter(
		(link: StreamingLink) => link.stream_type === "buy",
	)
	const rentLinks = (links || []).filter(
		(link: StreamingLink) => link.stream_type === "rent",
	)

	const hasFlatrate = Boolean(flatrateLinks.length)
	const hasBuy = Boolean(buyLinks.length)
	const hasRent = Boolean(rentLinks.length)
	const hasNothing = !hasFlatrate && !hasBuy && !hasRent

	const onlyOtherCountries = hasNothing && countryCodes?.length
	const countryCount = onlyOtherCountries
		? countryCodes?.length
		: countryCodes?.length - 1

	return (
		<div className="mt-6">
			<h2 className="text-2xl font-bold">Streaming</h2>
			{hasNothing && !countryCount && (
				<div className="mt-4">
					<InfoBox text="This title is currently not available on any streaming platform" />
				</div>
			)}
			{hasFlatrate && (
				<div>
					<div className="mt-6 mb-2 text-lg font-bold flex items-center">
						Watch now
						<span className="ml-3 inline-flex items-center rounded-sm bg-lime-700 px-2 h-4 text-xs font-medium text-yellow-100">
							Flatrate
						</span>
					</div>
					<div className="flex flex-wrap gap-4">
						{flatrateLinks.map((link) => {
							return (
								<a
									key={link.provider_id}
									href={getStreamingUrl(
										link,
										details,
										currentCountryCode,
										media_type,
									)}
									target="_blank"
									className="rounded-xl border-4 border-gray-600 hover:border-gray-500"
									rel="noreferrer"
								>
									<img
										className="w-28 h-28 rounded-lg"
										src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
										alt={link.provider_name}
									/>
								</a>
							)
						})}
					</div>
				</div>
			)}
			{hasBuy && (
				<div className="mt-10">
					<div className="mb-2 text-lg font-bold">Buy</div>
					<div className="flex flex-wrap gap-4">
						{buyLinks.map((link) => {
							return (
								<a
									key={link.display_priority}
									href={getStreamingUrl(
										link,
										details,
										currentCountryCode,
										media_type,
									)}
									target="_blank"
									className="rounded-xl border-4 border-gray-600 hover:border-gray-500"
									rel="noreferrer"
								>
									<img
										className="w-10 h-10 rounded-lg"
										src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
										alt={link.provider_name}
									/>
								</a>
							)
						})}
					</div>
				</div>
			)}
			{hasRent && (
				<div className="mt-6">
					<div className="mb-2 text-lg font-bold">Rent</div>
					<div className="flex flex-wrap gap-4">
						{rentLinks.map((link) => {
							return (
								<a
									key={link.display_priority}
									href={getStreamingUrl(
										link,
										details,
										currentCountryCode,
										media_type,
									)}
									target="_blank"
									className="rounded-xl border-4 border-gray-600 hover:border-gray-500"
									rel="noreferrer"
								>
									<img
										className="w-10 h-10 rounded-lg"
										src={`https://www.themoviedb.org/t/p/original/${link.provider_logo_path}`}
										alt={link.provider_name}
									/>
								</a>
							)
						})}
					</div>
				</div>
			)}
			{countryCount > 0 && (
				<div className="mt-6">
					<div className="mb-4 text-lg font-bold">
						Available in&nbsp;
						<span className="text-indigo-300">{countryCount}</span>&nbsp;
						{onlyOtherCountries ? "other " : ""}
						{countryCount === 1 ? "country" : "countries"}
					</div>
					<div className="flex flex-wrap gap-6">
						{countryCodes.map((countryCode) => (
							<Link
								key={countryCode}
								className="flex items-center gap-2 w-16 px-1 py-1 border-2 border-gray-600 bg-gray-800 text-sm hover:bg-gray-700"
								to={`?country=${countryCode}&tab=streaming`}
								prefetch="intent"
							>
								<img
									src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode}.svg`}
									alt={`Flag of ${countryCode}`}
									className="h-4"
								/>
								<span className="font-bold">{countryCode}</span>
							</Link>
						))}
					</div>
				</div>
			)}
			{!hasNothing && (
				<div className="mt-12 w-auto h-3 flex gap-2 items-center">
					<small>Streaming data by</small>
					<a
						href={links[0].tmdb_url}
						target="_blank"
						className=""
						rel="noreferrer"
					>
						<img alt="TMDB" className="h-3 w-auto" src={tmdb_logo} />
					</a>
					<small>and</small>
					<a
						href="https://justwatch.com"
						target="_blank"
						className="scale-150 ml-5"
						data-original="https://www.justwatch.com"
						rel="noreferrer"
					>
						<img
							alt="JustWatch"
							className="h-3 w-16"
							src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg"
						/>
					</a>
				</div>
			)}
		</div>
	)
}
