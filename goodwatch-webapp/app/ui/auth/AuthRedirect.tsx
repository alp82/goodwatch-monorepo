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

	const { hash } = location
	const isAuthRedirect = hash?.startsWith("#redirect=")

	useEffect(() => {
		if (isAuthRedirect) {
			queryClient.invalidateQueries()
			queryClient.refetchQueries()

			const redirectUrl = decodeURIComponent(hash.replace("#redirect=", ""))
			window.location.replace(redirectUrl)
			// navigate(redirectUrl, { replace: true })
		}
	}, [hash])

	if (isAuthRedirect) {
		return null
	}

	return <>{children}</>
}
