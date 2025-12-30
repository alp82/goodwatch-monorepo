import React from "react"
import { useIsOnWishlist } from "~/hooks/useUserDataAccessors"
import { useWishlistMutation } from "~/hooks/useUserDataMutations"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionProps } from "~/ui/user/actions/types"

export interface WishListActionProps extends UserActionProps {}

export default function ToWatchAction({
	children,
	media,
	onChange,
}: WishListActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const isOnWishlist = useIsOnWishlist(mediaType, tmdb_id)
	const { mutate: updateWishlist, isPending } = useWishlistMutation()

	const handleClick = () => {
		const action = isOnWishlist ? "remove" : "add"

		updateWishlist({
			mediaType,
			tmdbId: tmdb_id,
			action,
		})

		onChange?.()
	}

	return (
		<UserAction
			instructions={<>Curate your wishlist to track what you want to watch.</>}
			onChange={onChange}
		>
			{React.cloneElement(children, {
				onClick: handleClick,
				disabled: isPending,
				style: isPending ? { pointerEvents: "none", opacity: 0.7 } : {},
			})}
		</UserAction>
	)
}
