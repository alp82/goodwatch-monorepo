import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type StreamingCountriesResult,
	getStreamingCountries,
} from "~/server/streaming-countries.server"

// Every country's services of a title, for the country list of the title page's where-to-watch block.
//   /api/streaming-countries?type=movie&id=603&country=DE
export const loader = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const type = url.searchParams.get("type")
	const id = url.searchParams.get("id") ?? ""
	const country = (url.searchParams.get("country") ?? "").toUpperCase()
	if (
		(type !== "movie" && type !== "show") ||
		!/^\d{1,9}$/.test(id) ||
		!/^[A-Z]{2}$/.test(country)
	)
		throw new Response("Bad Request", { status: 400 })
	const result = await getStreamingCountries({
		mediaType: type,
		id: Number(id),
		country,
	})
	return json<StreamingCountriesResult>(result)
}

// Query hook

export const useStreamingCountries = (
	mediaType: "movie" | "show",
	id: number,
	country: string,
) =>
	useQuery<StreamingCountriesResult>({
		queryKey: ["streaming-countries", mediaType, id, country],
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`/api/streaming-countries?type=${mediaType}&id=${id}&country=${country}`,
				{ signal },
			)
			if (!response.ok)
				throw new Error("Could not load the countries' services")
			return response.json()
		},
	})
