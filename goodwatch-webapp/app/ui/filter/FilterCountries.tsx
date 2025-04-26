import { useFetcher } from "@remix-run/react"
import React, { useEffect } from "react"
import type { Country } from "~/server/countries.server"
import Select, { type SelectItem } from "~/ui/form/Select"

export interface FilterCountriesProps {
	type: "movie" | "tv"
	selectedCountry: string
	availableCountryCodes?: string[]
	onChange: (country: string) => void
}

export default function FilterCountries({
	selectedCountry,
	availableCountryCodes,
	onChange,
}: FilterCountriesProps) {
	const countriesFetcher = useFetcher<Country[]>()
	useEffect(() => {
		countriesFetcher.submit(
			{},
			{
				method: "get",
				action: "/api/countries",
			},
		)
	}, [])
	const countries = countriesFetcher.data || []

	const selectItems = countries.map((country) => {
		return {
			key: country.code,
			label: country.name,
			icon: `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.code}.svg`,
		}
	})
	selectItems.sort((a, b) => {
		const aIsAvailable = (availableCountryCodes || []).includes(a.key)
		const bIsAvailable = (availableCountryCodes || []).includes(b.key)

		if (aIsAvailable && !bIsAvailable) return -1
		if (!aIsAvailable && bIsAvailable) return 1

		return a.label.localeCompare(b.label)
	})

	const handleSelect = (selectedItem: SelectItem) => {
		const country = selectedItem.key
		onChange(country)
		localStorage.setItem("country", country)
	}

	return (
		<div className="min-w-40 w-64 max-w-64">
			{countriesFetcher.state === "idle" ? (
				<Select<SelectItem>
					selectItems={selectItems}
					selectedItems={selectItems.find(
						(item) => item.key === selectedCountry,
					)}
					withSearch={true}
					onSelect={handleSelect}
				/>
			) : (
				<span className="text-sm">Loading countries...</span>
			)}
		</div>
	)
}
