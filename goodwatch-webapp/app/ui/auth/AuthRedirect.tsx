import { useLocation, useNavigate } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"

interface AuthRedirectProps {
	children: React.ReactNode
}

export const AuthRedirect = ({ children }: AuthRedirectProps) => {
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const location = useLocation()

	const hash = location.hash
	const isAuthRedirect = hash?.startsWith("#redirect=")

	useEffect(() => {
		if (isAuthRedirect) {
			queryClient.invalidateQueries({
				queryKey: queryKeyUserSettings,
			})
			queryClient.invalidateQueries({
				queryKey: queryKeyUserData,
			})

			const redirectUrl = decodeURIComponent(hash.replace("#redirect=", ""))
			navigate(redirectUrl, { replace: true })
		}
	}, [hash, navigate])

	return <>{!isAuthRedirect && children}</>
}
