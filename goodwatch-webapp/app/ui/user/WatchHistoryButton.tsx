import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import WatchHistoryAction from "~/ui/user/actions/WatchHistoryAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import ActionButton from "~/ui/button/ActionButton"

export interface WatchHistoryButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function WatchHistoryButton({
	details,
	onChange,
}: WatchHistoryButtonProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isInWatchHistory = Boolean(userDataItem?.onWatchHistory)
	const labelText = isInWatchHistory ? "Seen this" : "Mark as Seen"
	const labelAction = isInWatchHistory ? "Remove as Seen" : "Mark as Seen"

	return (
		<ActionButton
			details={details}
			isActive={isInWatchHistory}
			actionElement={WatchHistoryAction}
			iconElement={EyeIcon}
			onChange={onChange}
			bg="bg-green-800"
			outline="outline-green-300"
			color="text-green-300"
			labelText={labelText}
			labelAction={labelAction}
		/>
	)
}
