import { useQuery } from "@tanstack/react-query"
import { useRouteLoaderData } from "@remix-run/react"
import { useGuestInteractions } from "~/utils/guest-progress"
import { useUserData } from "~/routes/api.user-data"
import { useUser } from "~/utils/auth"
import type { DiscoveryResult } from "~/server/interest-discovery.server"
export function useInterestDiscovery(genre = "") {
	const interactions = useGuestInteractions()
	const { user } = useUser()
	const { data: history } = useUserData()
	const initial = useRouteLoaderData("routes/taste.quiz") as
		| { discovery?: DiscoveryResult }
		| undefined
	const query = useQuery<DiscoveryResult>({
		queryKey: ["interest-discovery", user?.id, history, genre],
		initialDataUpdatedAt: 0,
		initialData:
			!genre && interactions.length === 0 ? initial?.discovery : undefined,
		queryFn: async () => {
			const response = await fetch("/api/interest-discovery", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ genre, interactions: user ? [] : interactions }),
			})
			if (!response.ok) throw new Error("Could not load suggestions")
			return response.json()
		},
	})
	// Hide newly acted-on titles immediately, including while fresh suggestions load.
	const excluded = new Set(
		["scores", "skipped", "watched", "wishlist"].flatMap((key) =>
			Object.keys(history?.[key] || {}),
		),
	)
	return {
		...query,
		data: query.data
			? {
					...query.data,
					recommendations: query.data.recommendations.filter(
						(title) => !excluded.has(`${title.media_type}-${title.tmdb_id}`),
					),
				}
			: undefined,
	}
}
