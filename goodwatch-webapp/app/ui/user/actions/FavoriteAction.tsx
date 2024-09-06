import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateFavoritesPayload,
	UpdateFavoritesResult,
} from "~/server/favorites.server"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface FavoriteActionProps {
	children: React.ReactElement
	details: UserActionDetails
	onChange?: () => void
}

export default function FavoriteAction({
	children,
	details,
	onChange,
}: FavoriteActionProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const action = userData?.[media_type]?.[tmdb_id]?.onFavorites
		? "remove"
		: "add"

	const { submitProps } = useAPIAction<
		UpdateFavoritesPayload,
		UpdateFavoritesResult
	>({
		endpoints: [
			{
				url: "/api/update-favorites",
				params: {
					tmdb_id,
					media_type,
					action,
				},
			},
		],
	})

	return (
		<UserAction
			instructions={<>Save your all-time favorites.</>}
			onChange={onChange}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	)
}
