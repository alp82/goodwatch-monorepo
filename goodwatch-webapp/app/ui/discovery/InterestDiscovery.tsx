import { Link } from "@remix-run/react"
import { useContext, useEffect, useState } from "react"
import { useInterestDiscovery } from "./useInterestDiscovery"
import { useWatchability, useWatchSelection } from "./useWatchability"
import WatchControls from "./WatchControls"
import RecommendationSwiper from "~/ui/taste/components/RecommendationSwiper"
import {
	readExploration,
	rememberExploration,
	TasteTitleLink,
	TasteExplorationContext,
	uniqueTitles,
} from "~/ui/taste/exploration"
import type { Recommendation } from "~/ui/taste/types"

export default function InterestDiscovery({
	initialWatch = false,
}: { initialWatch?: boolean }) {
	const rememberOrigin = useContext(TasteExplorationContext)
	const [genre, setGenre] = useState("")
	const [watch, setWatch] = useState(initialWatch)
	const [restored, setRestored] = useState(false)
	useEffect(() => {
		const saved = readExploration().discovery
		setGenre(saved?.genre || "")
		setWatch(
			initialWatch ||
				new URLSearchParams(location.search).get("watch") === "1" ||
				saved?.watch ||
				false,
		)
		setRestored(true)
	}, [initialWatch])
	useEffect(() => {
		if (restored) rememberExploration({ discovery: { genre, watch } })
	}, [genre, watch, restored])
	const query = useInterestDiscovery(genre)
	const broader = useInterestDiscovery()
	const titles = query.data?.recommendations || []
	const selection = useWatchSelection()
	const check = useWatchability(titles, selection, watch)
	const broaderTitles = (broader.data?.recommendations || []).filter(
		(title) =>
			!titles.some(
				(item) =>
					item.media_type === title.media_type &&
					item.tmdb_id === title.tmdb_id,
			),
	)
	const broaderCheck = useWatchability(
		broaderTitles,
		selection,
		watch && !!genre,
	)
	const getState = (title: Recommendation) =>
		check.results.get(`${title.media_type}-${title.tmdb_id}`)?.state
	const matches = watch
		? titles.filter((title) => getState(title) === "watchable")
		: titles
	const uncertain = titles.filter((title) => getState(title) === "unknown")
	const noMatch = titles.filter((title) => getState(title) === "no_match")
	const nearby = watch
		? broaderTitles.filter(
				(title) =>
					broaderCheck.results.get(`${title.media_type}-${title.tmdb_id}`)
						?.state === "watchable",
			)
		: broaderTitles
	const genres = [
		...new Set(
			[
				...(broader.data?.recommendations || []).flatMap(
					(title) => title.genres || [],
				),
				genre,
			].filter(Boolean),
		),
	].sort()
	const previews = (items: Recommendation[]) => (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
			{items.slice(0, 4).map((title) => (
				<TasteTitleLink
					key={`${title.media_type}-${title.tmdb_id}`}
					media={title}
					className="underline text-sky-200"
				>
					{title.title} {title.release_year && `(${title.release_year})`}
				</TasteTitleLink>
			))}
		</div>
	)
	return (
		<TasteExplorationContext.Provider
			value={() => {
				rememberOrigin?.()
				rememberExploration({
					titles: uniqueTitles(watch ? matches : titles),
					view: "picks",
					scrollY: window.scrollY,
				})
			}}
		>
			<section className="space-y-4" aria-label="Discovery suggestions">
				<div className="flex flex-wrap justify-between gap-3 items-center">
					<div>
						<h2 className="text-xl font-semibold">
							{query.data?.basis === "personalized"
								? "Suggestions from your interests"
								: "General suggestions"}
						</h2>
						<p className="text-sm text-gray-300">
							{query.data?.basis === "personalized"
								? "Informed by titles you like and Want to See."
								: "Explore now. Rating familiar titles is optional."}{" "}
							Availability does not limit discovery.
						</p>
					</div>
					<Link to="/wishlist" className="text-sky-200 underline">
						Choose from Wishlist
					</Link>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<label>
						Genre{" "}
						<select
							className="ml-2 p-2 rounded bg-gray-800"
							value={genre}
							onChange={(event) => setGenre(event.target.value)}
						>
							<option value="">All genres</option>
							{genres.map((value) => (
								<option key={value}>{value}</option>
							))}
						</select>
					</label>
					<button
						type="button"
						aria-pressed={watch}
						className="px-3 py-2 rounded border border-sky-500 text-sky-200"
						onClick={() => setWatch(!watch)}
					>
						{watch ? "Back to interest discovery" : "What can I watch?"}
					</button>
				</div>
				{watch && <WatchControls selection={selection} />}
				{(query.isLoading || (watch && check.isFetching)) && (
					<p role="status">
						{query.isLoading
							? "Finding suggestions…"
							: "Checking current offers…"}
					</p>
				)}
				{(query.isError || (watch && check.isError)) && (
					<p role="alert">
						Could not{" "}
						{query.isError ? "load suggestions" : "check availability"}.{" "}
						<button
							className="underline"
							onClick={() => {
								query.refetch()
								if (watch) check.refetch()
							}}
							type="button"
						>
							Try again
						</button>
					</p>
				)}
				{watch && (
					<h3 className="font-semibold">
						Confirmed matches in this selection ({matches.length})
					</h3>
				)}
				{!!matches.length && <RecommendationSwiper recommendations={matches} />}
				{!matches.length && !query.isLoading && (
					<p>
						{watch
							? "No confirmed watchable matches in these suggestions. Unknown availability is not proof that a title is unavailable."
							: "No fresh suggestions for this selection."}
					</p>
				)}
				{watch &&
					!!selection.country &&
					!!selection.serviceIds.length &&
					!check.isFetching && (
						<div className="text-sm text-gray-300 space-y-2">
							{!!uncertain.length && (
								<details>
									<summary className="cursor-pointer">
										Availability unknown ({uncertain.length})
									</summary>
									<p>
										Current offers could not be established. These titles remain
										discoverable and can be marked Want to See.
									</p>
									{previews(uncertain)}
								</details>
							)}
							{!!noMatch.length && (
								<details>
									<summary className="cursor-pointer">
										No matching offer found ({noMatch.length})
									</summary>
									<p>
										Current checks found no offer matching your country,
										services and offer types. You can still mark these titles
										Want to See.
									</p>
									{previews(noMatch)}
								</details>
							)}
						</div>
					)}
				{matches.length < 5 && !query.isLoading && (
					<aside
						className="border-t border-gray-700 pt-3 space-y-3"
						aria-label="Nearby directions"
					>
						<h3 className="font-semibold">Nearby directions</h3>
						{!!genre && !!nearby.length && (
							<div>
								<p>
									Try other genres
									{watch ? ", keeping your viewing options" : ""}. Preview only:
									relaxes the {genre} constraint.
								</p>
								{previews(nearby)}
								<button
									type="button"
									className="underline text-sky-200"
									onClick={() => setGenre("")}
								>
									Explore all genres
								</button>
							</div>
						)}
						{watch && !!(titles.length || broaderTitles.length) && (
							<div>
								<p>
									Keep exploring{" "}
									{titles.length ? genre || "these interests" : "other genres"}{" "}
									without an availability requirement. These previews are not
									confirmed watchable matches.
								</p>
								{previews(titles.length ? titles : broaderTitles)}
								<button
									type="button"
									className="underline text-sky-200"
									onClick={() => {
										setWatch(false)
										if (!titles.length) setGenre("")
									}}
								>
									Explore without availability filtering
								</button>
							</div>
						)}
						{!watch && !nearby.length && (
							<p>
								Try another genre or rate familiar titles to refine your
								interests.{" "}
								<Link className="underline text-sky-200" to="/wishlist">
									Your Wishlist
								</Link>{" "}
								is also available.
							</p>
						)}
					</aside>
				)}
			</section>
		</TasteExplorationContext.Provider>
	)
}
