import React from "react"
import { useIsFavorite } from "~/hooks/useUserDataAccessors"
import { useFavoriteMutation } from "~/hooks/useUserDataMutations"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionProps } from "~/ui/user/actions/types"

export interface FavoriteActionProps extends UserActionProps {}

export default function FavoriteAction({
	children,
	media,
	onChange,
}: FavoriteActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const isFavorite = useIsFavorite(mediaType, tmdb_id)
	const { mutate: updateFavorite, isPending } = useFavoriteMutation()

	const handleClick = () => {
		updateFavorite({
			mediaType,
			tmdbId: tmdb_id,
			action: isFavorite ? "remove" : "add",
		})
		onChange?.()
	}

	return (
		<UserAction
			instructions={<>Save your all-time favorites.</>}
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
