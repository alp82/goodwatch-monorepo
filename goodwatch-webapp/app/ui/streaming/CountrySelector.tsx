import { useNavigate } from "@remix-run/react"
import React, { useState } from "react"
import FilterCountries from "~/ui/filter/FilterCountries"
import type { Section } from "~/utils/scroll"

export interface StreamingBlockProps {
	media_type: "movie" | "tv"
	countryCodes: string[]
	currentCountryCode: string
	navigateToSection: (section: Section) => void
}

export default function CountrySelector({
	media_type,
	countryCodes = [],
	currentCountryCode,
	navigateToSection,
}: StreamingBlockProps) {
	const [editing, setEditing] = useState(true)
	const toggleEditing = () => setEditing(!editing)

	const navigate = useNavigate()
	const handleCountryChange = (newCountry: string) => {
		navigate(`?country=${newCountry}`)
	}

	return (
		<>
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
					className="p-1 border-2 border-gray-600 hover:border-gray-400 font-bold cursor-pointer"
					onClick={toggleEditing}
				>
					<img
						src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${currentCountryCode}.svg`}
						alt={`Flag of ${currentCountryCode}`}
						className="h-4"
					/>
				</button>
			)}
		</>
	)
}
