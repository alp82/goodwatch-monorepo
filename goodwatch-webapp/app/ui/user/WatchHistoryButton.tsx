import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import WatchHistoryAction from "~/ui/user/actions/WatchHistoryAction"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ActionButton from "~/ui/button/ActionButton"

export interface WatchHistoryButtonProps {
	media: MovieResult | ShowResult
	onChange?: () => void
}

export default function WatchHistoryButton({
	media,
	onChange,
}: WatchHistoryButtonProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[mediaType]?.[tmdb_id]
	const isInWatchHistory = Boolean(userDataItem?.onWatchHistory)
	const labelText = isInWatchHistory ? "Seen this" : "Mark as Seen"
	const labelAction = isInWatchHistory ? "Remove as Seen" : "Mark as Seen"

	return (
		<ActionButton
			media={media}
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
