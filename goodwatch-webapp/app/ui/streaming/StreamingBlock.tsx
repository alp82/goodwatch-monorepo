import { useNavigate } from "@remix-run/react"
import React, { useState } from "react"
import type {
	MovieDetails,
	StreamingLink,
	TVDetails,
} from "~/server/details.server"
import FilterCountries from "~/ui/filter/FilterCountries"
import StreamingBadges from "~/ui/streaming/StreamingBadges"
import { useDetailsTab } from "~/utils/navigation"

export interface StreamingBlockProps {
	details: MovieDetails | TVDetails
	media_type: "movie" | "tv"
	links: StreamingLink[]
	countryCodes: string[]
	currentCountryCode: string
}

export default function StreamingBlock({
	details,
	media_type,
	links = [],
	countryCodes = [],
	currentCountryCode,
}: StreamingBlockProps) {
	const { handleStreamingTab } = useDetailsTab()

	const [editing, setEditing] = useState(false)
	const toggleEditing = () => setEditing(!editing)

	const navigate = useNavigate()
	const handleCountryChange = (newCountry: string) => {
		navigate(`?tab=streaming&country=${newCountry}`)
	}

	return (
		<div className="divide-y divide-gray-600 overflow-visible rounded-lg bg-gray-900 bg-opacity-50 shadow">
			<div className="flex gap-2 items-center px-4 py-2 sm:px-6 font-bold">
				<button
					type="button"
					className="text-indigo-400 hover:underline"
					onClick={handleStreamingTab}
				>
					Streaming
				</button>{" "}
				in
				{editing ? (
					<FilterCountries
						type={media_type}
						selectedCountry={currentCountryCode}
						availableCountryCodes={countryCodes}
						onChange={handleCountryChange}
					/>
				) : (
					<button
						type="button"
						className="p-1 border-2 border-gray-600 hover:border-gray-400 cursor-pointer"
						onClick={toggleEditing}
					>
						<img
							src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${currentCountryCode}.svg`}
							alt={`Flag of ${currentCountryCode}`}
							className="h-4"
						/>
					</button>
				)}
			</div>
			<div className="px-4 py-2 sm:p-6">
				<StreamingBadges
					details={details}
					media_type={media_type}
					links={links}
					countryCodes={countryCodes}
				/>
			</div>
		</div>
	)
}
