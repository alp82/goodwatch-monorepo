import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getTasteCreatorStats, type CreatorStat } from "~/server/taste-profile.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })

	if (!userId) {
		return { directors: [], actors: [] }
	}

	const { directors, actors } = await getTasteCreatorStats({ userId })
	return { directors, actors }
}

export const queryKeyTasteCreators = ["taste-profile-creators"]

export const useTasteCreators = (enabled = true) => {
	return useQuery<{ directors: CreatorStat[]; actors: CreatorStat[] }>({
		queryKey: queryKeyTasteCreators,
		queryFn: async () => await (await fetch("/api/taste-profile/creators")).json(),
		enabled,
	})
}
