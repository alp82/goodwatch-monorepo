import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateWishListPayload,
	UpdateWishListResult,
} from "~/server/wishList.server"
import UserAction from "~/ui/auth/UserAction"
import {
	UserActionDetails,
	type UserActionProps,
} from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface WishListActionProps extends UserActionProps {}

export default function ToWatchAction({
	children,
	details,
	onChange,
}: WishListActionProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const action = userData?.[media_type]?.[tmdb_id]?.onWishList
		? "remove"
		: "add"

	const { submitProps } = useAPIAction<
		UpdateWishListPayload,
		UpdateWishListResult
	>({
		endpoints: [
			{
				url: "/api/update-wish-list",
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
			instructions={<>Curate your wishlist to track what you want to watch.</>}
			onChange={onChange}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	)
}
