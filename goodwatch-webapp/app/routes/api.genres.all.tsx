import type { LoaderFunction } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { type Genre, getGenresUnique } from "~/server/genres.server"

type GetGenresResult = Genre[]

export const loader: LoaderFunction = async () => {
	return await getGenresUnique()
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
