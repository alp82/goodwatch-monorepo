import { useFetcher } from "@remix-run/react"
import type React from "react"
import { useEffect, useState } from "react"
import { useUserSettings } from "~/routes/api.user-settings.get"
import type { Country } from "~/server/countries.server"
import { getCountryName } from "~/server/resources/country-names"
import NextBackButtons from "~/ui/button/NextBackButtons"
import YesNoButtons from "~/ui/button/YesNoButtons"
import { CountryFlag } from "~/ui/country/CountryFlag"
import FilterCountries from "~/ui/filter/FilterCountries"

interface SelectCountryProps {
	onSelect: (country: string) => void
}

export default function SelectCountry({ onSelect }: SelectCountryProps) {
	const { data: userSettings } = useUserSettings()

	// pre-selection

	const storedCountry =
		userSettings?.country_default || typeof window !== "undefined"
			? localStorage.getItem("country")
			: undefined

	// get all countries

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

	// selection mode

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
						<CountryFlag countryCode={userCountry} />
					</div>
					<div className="flex flex-col gap-2">
						<div className="text-center font-semibold">Is this correct?</div>
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
