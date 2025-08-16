import { BookmarkIcon } from "@heroicons/react/20/solid"
import React from "react"
import { useUserData } from "~/routes/api.user-data"
import ToWatchAction from "~/ui/user/actions/ToWatchAction"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ActionButton from "~/ui/button/ActionButton"

export interface PlanToWatchButtonProps {
	media: MovieResult | ShowResult
	onChange?: () => void
}

export default function PlanToWatchButton({
	media,
	onChange,
}: PlanToWatchButtonProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[mediaType]?.[tmdb_id]
	const isInWishList = Boolean(userDataItem?.onWishList)
	const isInWatchHistory = userDataItem?.onWatchHistory
	const labelText = isInWatchHistory ? "Want to See Again" : "Want to See"
	const labelAction = isInWatchHistory ? "Want to See Again" : "Want to See"

	return (
		<ActionButton
			media={media}
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
