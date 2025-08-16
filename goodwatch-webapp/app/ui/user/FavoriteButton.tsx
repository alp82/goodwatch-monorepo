import { HeartIcon } from "@heroicons/react/24/solid"
import React from "react"
import { useUserData } from "~/routes/api.user-data"
import FavoriteAction from "~/ui/user/actions/FavoriteAction"
import ActionButton from "~/ui/button/ActionButton"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface FavoriteButtonProps {
	media: MovieResult | ShowResult
	onChange?: () => void
}

export default function FavoriteButton({
	media,
	onChange,
}: FavoriteButtonProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const userDataItem = userData?.[mediaType]?.[tmdb_id]
	const isFavorite = Boolean(userDataItem?.onFavorites)
	const labelText = isFavorite ? "Favorite" : "Favorite"
	const labelAction = isFavorite ? "Favorite" : "Favorite"

	return (
		<ActionButton
			media={media}
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
