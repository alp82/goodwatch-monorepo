import { useCountries } from "~/routes/api.countries"
import Select, { type SelectItem } from "~/ui/form/Select"

export interface FilterCountriesProps {
	mediaType: "movie" | "show"
	selectedCountry: string
	availableCountryCodes?: string[]
	onChange: (country: string) => void
}

export default function FilterCountries({
	selectedCountry,
	availableCountryCodes,
	onChange,
}: FilterCountriesProps) {
	const countriesQuery = useCountries()
	const countries = countriesQuery.data || []

	const selectItems = countries.map((country) => {
		return {
			key: country.code,
			label: country.name,
			icon: `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.code}.svg`,
		}
	})
	selectItems.sort((a, b) => {
		const aIsAvailable = (availableCountryCodes || []).includes(a.label)
		const bIsAvailable = (availableCountryCodes || []).includes(b.label)

		if (aIsAvailable && !bIsAvailable) return -1
		if (!aIsAvailable && bIsAvailable) return 1

		return a.label.localeCompare(b.key)
	})

	const selectedItem = selectItems.find(
		(item) => item.key === selectedCountry,
	) || { key: selectedCountry, label: selectedCountry }

	const handleSelect = (selectedItem: SelectItem) => {
		const country = selectedItem.key
		onChange(country)
		localStorage.setItem("country", country)
	}

	return (
		<div className="w-full min-w-36 max-w-64 text-right">
			<Select<SelectItem>
				selectItems={selectItems}
				selectedItems={selectedItem}
				withSearch={true}
				isLoading={countriesQuery.isPending}
				onSelect={handleSelect}
			/>
			{countriesQuery.isError && (
				<p role="status" className="mt-2 text-sm text-gray-400">
					Countries could not be loaded.{" "}
					<button
						type="button"
						className="underline"
						disabled={countriesQuery.isFetching}
						onClick={() => countriesQuery.refetch()}
					>
						Try again
					</button>
				</p>
			)}
		</div>
	)
}
