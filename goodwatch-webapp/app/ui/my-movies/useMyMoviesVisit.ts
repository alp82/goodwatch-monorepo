// My movies is open (#456): the visit is stored, and the movies that landed on the member's services are cleared
// wherever they show, as a visit of My shows does for its shows (useMyShowsVisit).
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { clearLanded } from "~/ui/navigation/useTonightsPick"
import { useUser } from "~/utils/auth"

export function useMyMoviesVisit(): void {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userId = user?.id
	useEffect(() => {
		if (!userId) return
		fetch("/api/newly-available", { method: "POST" })
			.then((response) => {
				// The answer says nothing: let go of it, or the request stays open.
				void response.body?.cancel()
				if (response.ok) return clearLanded(queryClient, userId, "movies")
			})
			// The signal then stays until the next visit.
			.catch(() => {})
	}, [userId, queryClient])
}
