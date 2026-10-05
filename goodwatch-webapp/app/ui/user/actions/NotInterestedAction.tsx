import React from "react"
import { useIsNotInterested } from "~/hooks/useUserDataAccessors"
import { useNotInterestedMutation } from "~/hooks/useUserDataMutations"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionProps } from "~/ui/user/actions/types"

export interface NotInterestedActionProps extends UserActionProps {}

export default function NotInterestedAction({
	children,
	media,
	onChange,
}: NotInterestedActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const isNotInterested = useIsNotInterested(mediaType, tmdb_id)
	const { mutate: updateNotInterested, isPending } = useNotInterestedMutation()

	const handleClick = () => {
		updateNotInterested({
			mediaType,
			tmdbId: tmdb_id,
			action: isNotInterested ? "remove" : "add",
		})
		onChange?.()
	}

	return (
		<UserAction
			requiresLogin={false}
			instructions={<>Hide titles you have not seen and do not want to watch.</>}
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
