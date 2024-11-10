import { cached } from "~/utils/cache"

export const genreDuplicates = {
	"Action & Adventure": ["Action", "Adventure"],
	"Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
	"War & Politics": ["War"],
}

export interface Genre {
	id: number
	name: string
}

export interface GenresResults {
	genres: Genre[]
}

export interface GenresMovieParams {
	type: "default"
}
export interface GenresTVParams {
	type: "default"
}

export const getGenresAll = async (params = {}) => {
	return await cached<{}, Genre[]>({
		name: "genres-movie",
		target: _getGenresAll,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	})
}

export async function _getGenresAll({}): Promise<Genre[]> {
	const genresMovie = await getGenresMovie({
		type: "default",
	})
	const genresTV = await getGenresTV({
		type: "default",
	})

	const combinedGenres = [...genresMovie.genres, ...genresTV.genres]

	return combinedGenres.reduce((genres, current) => {
		if (!genres.some((genre) => genre.id === current.id)) {
			genres.push(current)
		}
		return genres
	}, [] as Genre[])
}

export const getGenresMovie = async (params: GenresMovieParams) => {
	return await cached<GenresMovieParams, GenresResults>({
		name: "genres-movie",
		target: _getGenresMovie,
		params,
		ttlMinutes: 60 * 24,
	})
}

export async function _getGenresMovie({}: GenresMovieParams): Promise<GenresResults> {
	return await fetch(
		`https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
	).then((res) => res.json())
}

export const getGenresTV = async (params: GenresTVParams) => {
	return await cached<GenresTVParams, GenresResults>({
		name: "genres-tv",
		target: _getGenresTV,
		params,
		ttlMinutes: 60 * 24,
	})
}

export async function _getGenresTV({}: GenresTVParams): Promise<GenresResults> {
	return await fetch(
		`https://api.themoviedb.org/3/genre/tv/list?api_key=${process.env.TMDB_API_KEY}`,
	).then((res) => res.json())
}
