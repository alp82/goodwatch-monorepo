import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { type CountriesResults, getCountries } from "~/server/countries.server"

export type GetCountriesResult = CountriesResults

export const loader: LoaderFunction = async () => {
	const params = {}
	const countries = await getCountries(params)

	return json<GetCountriesResult>(countries)
}

// Query hook

export const queryKeyCountries = ["countries"]

export const useCountries = () => {
	const url = "/api/countries"
	return useQuery<GetCountriesResult>({
		queryKey: queryKeyCountries,
		queryFn: async ({ signal }) => {
			const response = await fetch(url, { signal })
			if (!response.ok) throw new Error("Could not load countries")
			return response.json()
		},
	})
}
