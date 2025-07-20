import type { MetaFunction } from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import React, { useEffect, useState } from "react"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import FilterCountries from "~/ui/filter/FilterCountries"
import { useSupabase, useUser } from "~/utils/auth"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Country Settings | GoodWatch" },
		{
			description:
				"Change your GoodWatch country settings. All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

export default function SettingsCountry() {
	const { data: userSettings } = useUserSettings()

	// pre-selection

	const storedCountry =
		userSettings?.country_default ||
		(typeof window !== "undefined"
			? localStorage.getItem("country")
			: undefined)

	// selection

	const [selectedCountry, setSelectedCountry] = useState<string | undefined>()
	const handleSelectCountry = (country: string) => {
		setSelectedCountry(country)
	}

	const setUserSettings = useSetUserSettings()

	const handleSubmit = () => {
		if (!selectedCountry) return
		setUserSettings.mutate({
			settings: {
				country_default: selectedCountry,
			},
		})
	}

	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex flex-col gap-4 text-lg lg:text-2xl text-gray-300">
				<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
					Country
				</h2>

				<FilterCountries
					mediaType="movie"
					selectedCountry={selectedCountry || storedCountry || ""}
					onChange={handleSelectCountry}
				/>

				<button
					type="submit"
					className="
							flex items-center gap-2 px-4 py-2 w-72
							border border-indigo-700 rounded-md bg-indigo-700 hover:bg-indigo-800
							text-center text-base font-medium text-gray-200 hover:text-white
						"
					onClick={handleSubmit}
				>
					Confirm Country
				</button>
			</div>
		</div>
	)
}
