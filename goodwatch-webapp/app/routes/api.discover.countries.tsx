import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { type CountriesResults, getCountries } from "~/server/countries.server"

export type LoaderData = {
	countries: CountriesResults
}

export const loader: LoaderFunction = async () => {
	const params = {}
	const countries = await getCountries(params)

	return json<LoaderData>({
		countries,
	})
}
