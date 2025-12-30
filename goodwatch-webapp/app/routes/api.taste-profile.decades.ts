import type { LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getTasteDecadeStats, type DecadeStat } from "~/server/taste-profile.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })

	if (!userId) {
		return { decades: [] }
	}

	const decades = await getTasteDecadeStats({ userId })
	return { decades }
}

export const queryKeyTasteDecades = ["taste-profile-decades"]

export const useTasteDecades = (enabled = true) => {
	return useQuery<{ decades: DecadeStat[] }>({
		queryKey: queryKeyTasteDecades,
		queryFn: async () => await (await fetch("/api/taste-profile/decades")).json(),
		enabled,
	})
}
