import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/solid"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { queryKeyUserData } from "~/routes/api.user-data"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"
import { useSupabase } from "~/utils/auth"

interface SignOutLinkProps {
	active: boolean
}

export const SignOutLink = ({ active }: SignOutLinkProps) => {
	const { supabase } = useSupabase()
	const queryClient = useQueryClient()

	const handleSignOut = async () => {
		if (!supabase) return

		const { error } = await supabase.auth.signOut()
		if (error) console.error(error)

		queryClient.invalidateQueries({
			queryKey: queryKeyUserSettings,
		})
		queryClient.invalidateQueries({
			queryKey: queryKeyUserData,
		})
	}

	return (
		<button
			type="button"
			onClick={handleSignOut}
			className={`
			  w-full flex gap-2 items-center
        px-4 py-2 text-base hover:bg-gray-800 hover:text-white
        ${active ? "text-white" : "text-gray-300"}
      `}
		>
			<ArrowRightStartOnRectangleIcon className="w-5 h-5" />
			Sign out
		</button>
	)
}
