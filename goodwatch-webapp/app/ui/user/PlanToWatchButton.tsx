import { BookmarkIcon } from "@heroicons/react/20/solid"
import React from "react"
import { useUserData } from "~/routes/api.user-data"
import ToWatchAction from "~/ui/user/actions/ToWatchAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import ActionButton from "~/ui/button/ActionButton"

export interface PlanToWatchButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function PlanToWatchButton({
	details,
	onChange,
}: PlanToWatchButtonProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isInWishList = Boolean(userDataItem?.onWishList)
	const isInWatchHistory = userDataItem?.onWatchHistory
	const labelText = isInWatchHistory ? "Want to See Again" : "Want to See"
	const labelAction = isInWatchHistory ? "Want to See Again" : "Want to See"

	return (
		<ActionButton
			details={details}
			isActive={isInWishList}
			actionElement={ToWatchAction}
			iconElement={BookmarkIcon}
			onChange={onChange}
			bg="bg-amber-800"
			outline="outline-amber-300"
			color="text-amber-300"
			labelText={labelText}
			labelAction={labelAction}
		/>
	)
}
