// The member's hidden titles (marked Not interested), newest first: the Hidden titles sheet lists them, the Settings
// tile counts them. One query for both.
import { useQuery } from "@tanstack/react-query"
import type { TitleCard } from "~/server/title-cards.server"
import { useUser } from "~/utils/auth"

export type HiddenTitle = TitleCard & { hiddenAt: string; href: string }
export interface HiddenTitles {
	titles: HiddenTitle[]
}

export const queryKeyHiddenTitles = (userId?: string) =>
	["not-interested", userId] as const

export function useHiddenTitles() {
	const { user } = useUser()
	const queryKey = queryKeyHiddenTitles(user?.id)
	const query = useQuery<HiddenTitles>({
		queryKey,
		queryFn: async () => {
			const response = await fetch("/api/not-interested")
			if (!response.ok)
				throw new Error(`Hidden titles answered ${response.status}`)
			return await response.json()
		},
		enabled: Boolean(user?.id),
	})
	return { ...query, queryKey }
}
