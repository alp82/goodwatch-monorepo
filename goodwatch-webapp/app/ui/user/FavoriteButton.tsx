import { HeartIcon } from "@heroicons/react/24/solid"
import React from "react"
import { useUserData } from "~/routes/api.user-data"
import FavoriteAction from "~/ui/user/actions/FavoriteAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import ActionButton from "~/ui/button/ActionButton"

export interface FavoriteButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function FavoriteButton({
	details,
	onChange,
}: FavoriteButtonProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isFavorite = Boolean(userDataItem?.onFavorites)
	const labelText = isFavorite ? "Favorite" : "Favorite"
	const labelAction = isFavorite ? "Favorite" : "Favorite"

	return (
		<ActionButton
			details={details}
			isActive={isFavorite}
			actionElement={FavoriteAction}
			iconElement={HeartIcon}
			onChange={onChange}
			bg="bg-rose-800"
			outline="outline-rose-300"
			color="text-rose-300"
			labelText={labelText}
			labelAction={labelAction}
		/>
	)
}
