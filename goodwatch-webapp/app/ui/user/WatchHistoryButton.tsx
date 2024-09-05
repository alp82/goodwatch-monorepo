import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import WatchHistoryAction from "~/ui/user/actions/WatchHistoryAction"
import type { UserActionDetails } from "~/ui/user/actions/types"

export interface WatchHistoryButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function WatchHistoryButton({
	details,
	onChange,
}: WatchHistoryButtonProps) {
	const { tmdb_id, media_type } = details
	const [isActive, setIsActive] = useState(false)

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isInWatchHistory = userDataItem?.onWatchHistory

	const WatchHistoryIcon = isInWatchHistory && isActive ? EyeSlashIcon : EyeIcon
	const watchHistoryColor =
		isInWatchHistory && isActive ? "text-green-500" : "text-gray-400"
	const watchHistoryText = isInWatchHistory
		? "Already Watched"
		: "Add to Watched"
	const watchHistoryAction = isInWatchHistory
		? "Remove from Watched"
		: "Add to Watched"

	return (
		<WatchHistoryAction details={details} onChange={onChange}>
			<button
				type="button"
				className={`${isInWatchHistory ? "bg-slate-700" : "bg-zinc-700"} rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm md:text-md font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700`}
				onPointerEnter={() => setIsActive(true)}
				onPointerLeave={() => setIsActive(false)}
			>
				<WatchHistoryIcon className={`h-5 w-auto ${watchHistoryColor}`} />
				{isActive ? watchHistoryAction : watchHistoryText}
			</button>
		</WatchHistoryAction>
	)
}
