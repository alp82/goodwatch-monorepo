import { BookmarkIcon } from "@heroicons/react/20/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import ToWatchAction from "~/ui/user/actions/ToWatchAction"
import type { UserActionDetails } from "~/ui/user/actions/types"

export interface PlanToWatchButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function PlanToWatchButton({
	details,
	onChange,
}: PlanToWatchButtonProps) {
	const { tmdb_id, media_type } = details
	const [isActive, setIsActive] = useState(false)

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isInWishList = userDataItem?.onWishList
	const isInWatchHistory = userDataItem?.onWatchHistory

	const WishListIcon = BookmarkIcon
	const wishListColor =
		isInWishList || isActive ? "text-amber-300" : "text-gray-300"
	const wishlistText = isInWishList
		? isInWatchHistory
			? "Plan to Watch Again"
			: "Plan to Watch"
		: isInWatchHistory
			? "Watch Again"
			: "Plan to Watch"
	const wishlistAction = isInWishList
		? "Don't want to Watch"
		: isInWatchHistory
			? "Want to Watch Again"
			: "Want to Watch"

	return (
		<ToWatchAction details={details} onChange={onChange}>
			<button
				type="button"
				className={`${isInWishList ? "bg-amber-800" : "bg-zinc-700"} rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm md:text-md font-semibold text-white shadow-sm hover:bg-amber-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800/70`}
				onPointerEnter={() => setIsActive(true)}
				onPointerLeave={() => setIsActive(false)}
			>
				<WishListIcon className={`h-5 w-auto ${wishListColor}`} />
				{isActive ? wishlistAction : wishlistText}
			</button>
		</ToWatchAction>
	)
}
