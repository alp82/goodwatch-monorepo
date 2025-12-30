import React from "react"
import { useIsSkipped } from "~/hooks/useUserDataAccessors"
import { useSkippedMutation } from "~/hooks/useUserDataMutations"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionProps } from "~/ui/user/actions/types"

export interface SkippedActionProps extends UserActionProps {}

export default function SkippedAction({
	children,
	media,
	onChange,
}: SkippedActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const isSkipped = useIsSkipped(mediaType, tmdb_id)
	const { mutate: updateSkipped, isPending } = useSkippedMutation()

	const handleClick = () => {
		updateSkipped({
			mediaType,
			tmdbId: tmdb_id,
			action: isSkipped ? "remove" : "add",
		})
		onChange?.()
	}

	return (
		<UserAction
			instructions={<>Add titles you want to ignore for now.</>}
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
