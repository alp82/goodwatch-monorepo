import { useUser } from "~/utils/auth"
import { canGuestRate, guestLimitEvent } from "~/utils/guest-progress"
import React from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import {
	useScoreMutation,
	useWatchedMutation,
} from "~/hooks/useUserDataMutations"
import type { Score } from "~/server/scores.server"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionProps } from "~/ui/user/actions/types"

export interface ScoreActionProps extends UserActionProps {
	score: Score | null
	isGuest?: boolean
}

export default function ScoreAction({
	children,
	media,
	score,
	onChange,
	isGuest = false,
}: ScoreActionProps) {
	const { user } = useUser()
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { mutate: updateScore, isPending: isScorePending } = useScoreMutation()
	const { mutate: updateWatched, isPending: isWatchedPending } =
		useWatchedMutation()

	const handleClick = () => {
		if (!user && score !== null && !canGuestRate(mediaType, tmdb_id)) {
			window.dispatchEvent(new Event(guestLimitEvent))
			return
		}
		updateScore({
			mediaType,
			tmdbId: tmdb_id,
			score,
		})

		const watchHistoryAction = score === null ? "remove" : "add"
		if (user)
			updateWatched({
				mediaType,
				tmdbId: tmdb_id,
				action: watchHistoryAction,
			})

		onChange?.()
	}

	const isPending = isScorePending || isWatchedPending

	return (
		<UserAction
			instructions={<>Rate movies and shows to get better recommendations.</>}
			onChange={onChange}
			requiresLogin={false}
		>
			{React.cloneElement(children, {
				onClick: handleClick,
				disabled: isPending,
				style: isPending ? { pointerEvents: "none", opacity: 0.7 } : {},
			})}
		</UserAction>
	)
}
