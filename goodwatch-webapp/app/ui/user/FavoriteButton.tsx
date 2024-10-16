import { HeartIcon } from "@heroicons/react/24/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import FavoriteAction from "~/ui/user/actions/FavoriteAction"
import type { UserActionDetails } from "~/ui/user/actions/types"

export interface FavoriteButtonProps {
	details: UserActionDetails
	onChange?: () => void
}

export default function FavoriteButton({
	details,
	onChange,
}: FavoriteButtonProps) {
	const { tmdb_id, media_type } = details
	const [isActive, setIsActive] = useState(false)

	const { data: userData } = useUserData()
	const userDataItem = userData?.[media_type]?.[tmdb_id]
	const isFavorite = userDataItem?.onFavorites

	const FavoriteIcon = HeartIcon
	const favoriteColor = isFavorite ? "text-rose-300" : "text-gray-300"
	const favoriteText = isFavorite ? "Favorite" : "Favorite"
	const favoriteAction = isFavorite
		? "Remove from Favorites"
		: "Add to Favorites"

	return (
		<FavoriteAction details={details} onChange={onChange}>
			<button
				type="button"
				className={`${isFavorite ? "bg-rose-800" : "bg-zinc-700"} rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm md:text-md font-semibold text-white shadow-sm hover:bg-rose-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-800/70`}
				onPointerEnter={() => setIsActive(true)}
				onPointerLeave={() => setIsActive(false)}
			>
				<FavoriteIcon className={`h-5 w-auto ${favoriteColor}`} />
				{isActive ? favoriteAction : favoriteText}
			</button>
		</FavoriteAction>
	)
}
