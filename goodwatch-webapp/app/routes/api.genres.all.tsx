import { type LoaderFunction, json } from "@remix-run/node"
import { type Genre, getGenresMovie, getGenresTV } from "~/server/genres.server"

type LoaderData = {
	genres: Genre[]
}

export const loader: LoaderFunction = async () => {
	const genresMovie = await getGenresMovie({
		type: "default",
	})
	const genresTV = await getGenresTV({
		type: "default",
	})

	const combinedGenres = [...genresMovie.genres, ...genresTV.genres]

	const uniqueGenres = combinedGenres.reduce((genres, current) => {
		if (!genres.some((genre) => genre.id === current.id)) {
			genres.push(current)
		}
		return genres
	}, [] as Genre[])

	return json<LoaderData>({
		genres: uniqueGenres,
	})
}
