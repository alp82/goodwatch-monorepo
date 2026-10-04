import { useNavigate } from "@remix-run/react"
import React, { useState } from "react"
import FilterCountries from "~/ui/filter/FilterCountries"
import type { Section } from "~/utils/scroll"
import { countryFlagUrl } from "~/utils/country-flag"

export interface StreamingBlockProps {
	mediaType: "movie" | "show"
	countryCodes: string[]
	currentCountryCode: string
	navigateToSection: (section: Section) => void
}

export default function CountrySelector({
	mediaType,
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
					mediaType={mediaType}
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
						src={countryFlagUrl(currentCountryCode)}
						alt={`Flag of ${currentCountryCode}`}
						className="h-4"
					/>
				</button>
			)}
		</>
	)
}
