import { type LoaderFunction, json } from "@remix-run/node"
import {
	type GenresResults,
	getGenresMovie,
	getGenresTV,
} from "~/server/genres.server"

type LoaderData = {
	genres: Awaited<GenresResults>
}

export const loader: LoaderFunction = async () => {
	const genresMovie = await getGenresMovie({
		type: "default",
	})
	const genresTV = await getGenresTV({
		type: "default",
	})
	const genres = { genres: [...genresMovie.genres, ...genresTV.genres] }

	return json<LoaderData>({
		genres,
	})
}
