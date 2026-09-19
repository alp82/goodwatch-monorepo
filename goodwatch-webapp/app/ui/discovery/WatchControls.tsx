import { useState } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import FilterCountries from "~/ui/filter/FilterCountries"
import type { WatchSelection } from "./useWatchability"
export default function WatchControls({
	selection,
}: { selection: WatchSelection }) {
	const { data: providers = [], isError } = useStreamingProviders()
	const [search, setSearch] = useState("")
	return (
		<fieldset className="my-3 p-3 rounded-xl bg-gray-800 border border-gray-600 space-y-3">
			{selection.preferencesError && (
				<p role="alert">
					Your selection is active, but could not be saved to your account.
					Please choose it again to retry.
				</p>
			)}
			<legend className="px-2 font-semibold">Your viewing options</legend>
			<div className="flex flex-wrap items-center gap-3">
				<span>Country</span>
				<FilterCountries
					mediaType="movie"
					selectedCountry={selection.country}
					onChange={selection.setCountry}
				/>
			</div>
			<details open={!selection.serviceIds.length}>
				<summary className="cursor-pointer">
					Services ({selection.serviceIds.length} selected)
				</summary>
				<label className="block mt-2">
					Find a service
					<input
						className="block w-full p-2 bg-gray-900 rounded"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						type="search"
					/>
				</label>
				{isError && (
					<p role="alert">Could not load services. Please try again.</p>
				)}
				<div className="mt-2 max-h-48 overflow-auto grid sm:grid-cols-2 gap-2">
					{providers
						.filter((provider) =>
							provider.name.toLowerCase().includes(search.toLowerCase()),
						)
						.map((provider) => (
							<label className="flex items-center gap-2" key={provider.id}>
								<input
									type="checkbox"
									checked={selection.serviceIds.includes(provider.id)}
									onChange={(event) =>
										selection.setServices(
											event.target.checked
												? [...selection.serviceIds, provider.id]
												: selection.serviceIds.filter(
														(id) => id !== provider.id,
													),
										)
									}
								/>
								{provider.name}
							</label>
						))}
				</div>
			</details>
			<label className="flex items-center gap-2">
				<input
					type="checkbox"
					checked={selection.includePaid}
					onChange={(event) => selection.setIncludePaid(event.target.checked)}
				/>
				Include rentals and purchases (extra cost)
			</label>
			<p className="text-sm text-gray-300">
				Included, free and ad-supported offers on your selected services are
				checked by default. A recent offer is not a guarantee of playback
				access.
			</p>
			{(!selection.country || !selection.serviceIds.length) && (
				<p role="status">
					Choose a country and at least one service to check availability. You
					can keep exploring without them.
				</p>
			)}
		</fieldset>
	)
}
