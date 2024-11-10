import type { LoaderFunction } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type Genre,
	genreDuplicates,
	getGenresAll,
} from "~/server/genres.server"

type GetGenresResult = Genre[]

export const loader: LoaderFunction = async () => {
	const combinedGenres = await getGenresAll()

	const duplicateGenres = Object.values(genreDuplicates).flat()
	const genres = combinedGenres.reduce((genres, current) => {
		if (
			!genres.some((genre) => genre.id === current.id) &&
			!duplicateGenres.includes(current.name)
		) {
			genres.push(current)
		}
		return genres
	}, [] as Genre[])
	genres.sort((a, b) => a.name.localeCompare(b.name))
	return genres
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
