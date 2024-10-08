import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type Genre,
	getGenresAll,
	getGenresMovie,
	getGenresTV,
} from "~/server/genres.server"

type GetGenresResult = Genre[]

export const loader: LoaderFunction = async () => {
	const genres = await getGenresAll()
	return json<GetGenresResult>(genres)
}

// Query hook

export const queryKeyGenres = ["genres"]

export const useGenres = () => {
	const url = new URL("/api/genres/all", "https://goodwatch.app")

	return useQuery<GetGenresResult>({
		queryKey: queryKeyGenres,
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
	})
}
