import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getTasteGenreStats, type GenreStat } from "~/server/taste-profile.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })

	if (!userId) {
		return { genres: [] }
	}

	const genres = await getTasteGenreStats({ userId })
	return { genres }
}

export const queryKeyTasteGenres = ["taste-profile-genres"]

export const useTasteGenres = (enabled = true) => {
	return useQuery<{ genres: GenreStat[] }>({
		queryKey: queryKeyTasteGenres,
		queryFn: async () => await (await fetch("/api/taste-profile/genres")).json(),
		enabled,
	})
}
