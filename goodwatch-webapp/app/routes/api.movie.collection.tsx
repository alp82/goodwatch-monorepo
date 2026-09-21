import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import type {
	MoviesInCollection,
	MovieCollectionParams,
} from "~/server/collection.server"
import { getMoviesInCollection } from "~/server/collection.server"
import type { MovieDetails } from "~/server/details.server"

type LoaderData = {
	collectionId: string
	movies: MovieDetails[]
}

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const collectionId = url.searchParams.get("collectionId") || ""
	const movieIds = url.searchParams.get("movieIds") || ""
	const moviesInCollection = await getMoviesInCollection({
		collectionId,
		movieIds,
	})

	return json<LoaderData>(moviesInCollection)
}

export const useMovieCollection = ({
	collectionId,
	movieIds,
}: MovieCollectionParams) =>
	useQuery<MoviesInCollection>({
		queryKey: ["movie-collection", collectionId, movieIds],
		enabled: Boolean(collectionId && movieIds),
		queryFn: async ({ signal }) => {
			const params = new URLSearchParams({ collectionId, movieIds })
			const response = await fetch(`/api/movie/collection?${params}`, {
				signal,
			})
			if (!response.ok) throw new Error("Could not load movie collection")
			return response.json()
		},
	})
