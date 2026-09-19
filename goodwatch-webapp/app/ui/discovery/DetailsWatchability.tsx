import { useNavigate, useLocation } from "@remix-run/react"
import { useState } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useWatchability, useWatchSelection } from "./useWatchability"
import WatchControls from "./WatchControls"
import InterestDiscovery from "./InterestDiscovery"

export default function DetailsWatchability({
	media,
	country,
}: { media: ScoringMedia; country: string }) {
	const selection = useWatchSelection(country)
	const navigate = useNavigate()
	const location = useLocation()
	const chooseCountry = (value: string) => {
		selection.setCountry(value)
		const params = new URLSearchParams(location.search)
		params.set("country", value)
		navigate(`${location.pathname}?${params}`, {
			replace: true,
			preventScrollReset: true,
		})
	}
	const check = useWatchability([media], selection, true)
	const result = check.results.get(`${media.media_type}-${media.tmdb_id}`)
	const { data: providers = [] } = useStreamingProviders()
	const [alternatives, setAlternatives] = useState(false)
	const ready = selection.country && selection.serviceIds.length > 0
	return (
		<div className="p-4 space-y-3">
			<WatchControls selection={{ ...selection, setCountry: chooseCountry }} />
			{ready && (
				<div role="status">
					{check.isFetching
						? "Checking current offers…"
						: result?.state === "watchable"
							? "Matching current offers"
							: result?.state === "no_match"
								? "No matching offer found"
								: "Availability unknown"}
				</div>
			)}
			{check.isError && (
				<p role="alert">
					Could not check current offers.{" "}
					<button
						type="button"
						className="underline"
						onClick={() => check.refetch()}
					>
						Try again
					</button>
				</p>
			)}
			{result?.state === "watchable" && (
				<ul className="space-y-2">
					{result.offers.map((offer, index) => {
						const name =
							providers.find((provider) => provider.id === offer.service_id)
								?.name || `Service ${offer.service_id}`
						const candidate = offer.stream_url || offer.tmdb_link
						const href =
							candidate && /^https?:\/\//i.test(candidate)
								? candidate
								: undefined
						return (
							<li key={`${offer.source}-${index}`}>
								<span>
									{name} ·{" "}
									{offer.offer_type === "flatrate"
										? "Included"
										: offer.offer_type}
									{offer.price_dollar != null
										? ` · $${offer.price_dollar}`
										: ""}
									{offer.quality ? ` · ${offer.quality}` : ""}
								</span>
								{href && (
									<>
										{" "}
										·{" "}
										<a
											href={href}
											target="_blank"
											rel="noreferrer"
											className="underline text-sky-200"
										>
											View offer
										</a>
									</>
								)}
								<small className="block text-gray-300">
									Checked {new Date(offer.checked_at).toLocaleDateString()} ·{" "}
									{offer.source === "tmdb_web" ? "TMDB web" : "TMDB providers"}
								</small>
							</li>
						)
					})}
				</ul>
			)}
			{ready && !check.isFetching && result?.state !== "watchable" && (
				<>
					<p className="text-sm text-gray-300">
						{result?.state === "no_match"
							? "Current checks found no offer on your selected services with these offer types."
							: "We cannot establish current offers for this selection. Checks at least 30 days old, missing evidence or conflicting sources stay unknown."}{" "}
						Keep this title in Want to See while you explore alternatives.
					</p>
					<button
						type="button"
						className="underline text-sky-200"
						onClick={() => setAlternatives(!alternatives)}
					>
						{alternatives ? "Hide alternatives" : "Find available alternatives"}
					</button>
				</>
			)}
			{alternatives && <InterestDiscovery initialWatch />}
		</div>
	)
}
