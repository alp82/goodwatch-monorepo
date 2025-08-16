import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateFavoritesPayload,
	UpdateFavoritesResult,
} from "~/server/favorites.server"
import UserAction from "~/ui/auth/UserAction"
import {
	type UserActionProps,
} from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface FavoriteActionProps extends UserActionProps {}

export default function FavoriteAction({
	children,
	media,
	onChange,
}: FavoriteActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const action = userData?.[mediaType]?.[tmdb_id]?.onFavorites
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
					media_type: mediaType === "show" ? "tv" : "movie",
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
