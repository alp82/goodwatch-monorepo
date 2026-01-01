import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"

export const useInvalidateOnVisibility = () => {
	const queryClient = useQueryClient()
	const timeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		let lastHiddenTime: number | null = null

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				lastHiddenTime = Date.now()
			} else if (document.visibilityState === "visible" && lastHiddenTime) {
				const hiddenDuration = Date.now() - lastHiddenTime

				if (hiddenDuration > 5000) {
					// Clear any existing timeout before scheduling a new one
					if (timeoutRef.current) {
						clearTimeout(timeoutRef.current)
					}
					
					timeoutRef.current = setTimeout(() => {
						queryClient.invalidateQueries({ queryKey: queryKeyUserData })
						queryClient.invalidateQueries({ queryKey: queryKeyUserSettings })
						timeoutRef.current = null
					}, 500)
				}

				lastHiddenTime = null
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			// Clear any pending timeout when component unmounts
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [queryClient])
}
