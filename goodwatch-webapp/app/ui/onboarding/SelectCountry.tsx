import { useFetcher } from "@remix-run/react"
import type React from "react"
import { useEffect, useState } from "react"
import type { Country } from "~/server/countries.server"
import { getCountryName } from "~/server/resources/country-names"
import NextBackButtons from "~/ui/button/NextBackButtons"
import YesNoButtons from "~/ui/button/YesNoButtons"
import FilterCountries from "~/ui/filter/FilterCountries"

interface SelectCountryProps {
	onSelect: (country: string) => void
}

export default function SelectCountry({ onSelect }: SelectCountryProps) {
	const storedCountry =
		typeof window !== "undefined" ? localStorage.getItem("country") : undefined

	const guessCountryFetcher = useFetcher<{ country: string }>()
	useEffect(() => {
		guessCountryFetcher.submit(
			{},
			{
				method: "get",
				action: "/api/guess-country",
			},
		)
	}, [guessCountryFetcher.submit])
	const guessedCountry = guessCountryFetcher.data?.country
	const preselectedCountry = storedCountry || guessedCountry

	const countriesFetcher = useFetcher<{ countries: Country[] }>()
	useEffect(() => {
		countriesFetcher.submit(
			{},
			{
				method: "get",
				action: "/api/discover/countries",
			},
		)
	}, [countriesFetcher.submit])
	const countries = countriesFetcher.data?.countries || []

	// defaults or selection
	const [countrySelectionEnabled, setCountrySelectionEnabled] = useState(false)
	const handleCountryDeclined = () => {
		setCountrySelectionEnabled(true)
		setSelectedCountry(preselectedCountry)
	}
	const handleCountryBack = () => {
		setCountrySelectionEnabled(false)
	}

	// selection
	const [selectedCountry, setSelectedCountry] = useState<string | undefined>()
	const handleSelectCountry = (country: string) => {
		setSelectedCountry(country)
	}
	const handleCountryConfirmed = () => {
		if (!preselectedCountry) return
		onSelect(preselectedCountry)
	}
	const handleCountrySelected = () => {
		if (!selectedCountry) return
		onSelect(selectedCountry)
	}

	const userCountry = selectedCountry || preselectedCountry

	return (
		<>
			{countrySelectionEnabled ? (
				<>
					<FilterCountries
						type="movie"
						selectedCountry={preselectedCountry || ""}
						onChange={handleSelectCountry}
					/>
					<NextBackButtons
						onNext={handleCountrySelected}
						onBack={handleCountryBack}
					/>
				</>
			) : userCountry ? (
				<>
					<div className="mb-6 flex flex-col items-center gap-2">
						<div>
							<strong>{getCountryName(userCountry)}</strong>
							<span> ({userCountry})</span>
						</div>
						<img
							className="w-24"
							src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${userCountry}.svg`}
							alt={getCountryName(userCountry)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<div className="font-semibold">Is this correct?</div>
						<YesNoButtons
							onYes={handleCountryConfirmed}
							onNo={handleCountryDeclined}
						/>
					</div>
				</>
			) : (
				<>
					<div>Loading...</div>
				</>
			)}
		</>
	)
}
