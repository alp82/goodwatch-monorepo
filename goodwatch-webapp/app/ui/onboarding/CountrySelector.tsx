import { useState } from "react"
import FilterCountries from "~/ui/filter/FilterCountries"

interface CountrySelectorProps {
	initialCountry?: string
	onSelect: (country: string) => void
	onCancel?: () => void
}

export default function CountrySelector({ 
	initialCountry, 
	onSelect,
	onCancel 
}: CountrySelectorProps) {
	const [selectedCountry, setSelectedCountry] = useState<string | undefined>(initialCountry)

	const handleSelectCountry = (country: string) => {
		setSelectedCountry(country)
	}

	const handleConfirm = () => {
		if (selectedCountry) {
			onSelect(selectedCountry)
		}
	}

	return (
		<div className="space-y-4">
			<FilterCountries
				mediaType="movie"
				selectedCountry={selectedCountry || ""}
				onChange={handleSelectCountry}
			/>
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={handleConfirm}
					disabled={!selectedCountry}
					className="px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold text-sm sm:text-base transition-colors shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Confirm
				</button>
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="px-4 py-2 bg-white/10 text-white hover:bg-white/20 rounded-lg font-semibold text-sm sm:text-base transition-colors cursor-pointer"
					>
						Cancel
					</button>
				)}
			</div>
		</div>
	)
}
