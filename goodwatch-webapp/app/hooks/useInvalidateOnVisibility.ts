import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"

export const useInvalidateOnVisibility = () => {
	const queryClient = useQueryClient()

	useEffect(() => {
		let lastHiddenTime: number | null = null

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				lastHiddenTime = Date.now()
			} else if (document.visibilityState === "visible" && lastHiddenTime) {
				const hiddenDuration = Date.now() - lastHiddenTime

				if (hiddenDuration > 5000) {
					setTimeout(() => {
						queryClient.invalidateQueries({ queryKey: queryKeyUserData })
						queryClient.invalidateQueries({ queryKey: queryKeyUserSettings })
					}, 500)
				}

				lastHiddenTime = null
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [queryClient])
}
