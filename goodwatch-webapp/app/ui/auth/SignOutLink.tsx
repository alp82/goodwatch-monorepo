import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/solid"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"
import { useAuthClient } from "~/utils/auth-client"

interface SignOutLinkProps {
	active: boolean
}

export const SignOutLink = React.forwardRef<HTMLButtonElement, SignOutLinkProps>(function SignOutLink(
	{ active }: SignOutLinkProps,
	ref,
) {
	const auth = useAuthClient()
	const queryClient = useQueryClient()

	const handleSignOut = async () => {
		// Clear onboarding banner state
		sessionStorage.removeItem("onboarding-banner-dismissed")

		const result = await auth.signOut()
		if (!result.ok) console.error(`Sign-out failed: ${result.failure}`)

		queryClient.removeQueries({
			queryKey: queryKeyUserSettings,
		})
		queryClient.removeQueries({
			queryKey: queryKeyUserData,
		})
	}

	return (
		<button
			ref={ref}
			type="button"
			onClick={handleSignOut}
			className={`
			  w-full flex gap-2 items-center
        px-4 py-2 text-base hover:bg-gray-700 hover:text-white
        ${active ? "text-white" : "text-gray-300"}
        cursor-pointer
      `}
		>
			<ArrowRightStartOnRectangleIcon className="w-5 h-5" />
			Sign out
		</button>
	)
})
