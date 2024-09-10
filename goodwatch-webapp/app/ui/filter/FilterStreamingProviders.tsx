import React from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import Select, { type SelectItem } from "~/ui/form/Select"

export interface FilterCountriesProps {
	type: "movie" | "tv"
	selectedProviders: string[]
	onChange: (providers: string) => void
}

export default function FilterStreamingProviders({
	type,
	selectedProviders,
	onChange,
}: FilterCountriesProps) {
	const { data: streamingProviders } = useStreamingProviders()

	const selectItems =
		streamingProviders?.map((provider) => {
			return {
				key: provider.id.toString(),
				label: provider.name,
				icon: provider.logo_path
					? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
					: undefined,
			}
		}) || []

	const handleSelect = (selectedItems: SelectItem[]) => {
		const withStreamingProviders = selectedItems
			.map((item) => item.key)
			.join(",")
		onChange(withStreamingProviders)
		localStorage.setItem("withStreamingProviders", withStreamingProviders)
	}

	return (
		<div className="w-52">
			<Select<SelectItem>
				selectItems={selectItems}
				selectedItems={selectItems.filter((item) =>
					selectedProviders.includes(item.key),
				)}
				withSearch={true}
				withMultiSelection={true}
				onSelect={handleSelect}
			/>
		</div>
	)
}
