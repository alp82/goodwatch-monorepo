import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	Score,
	UpdateScoresPayload,
	UpdateScoresResult,
} from "~/server/scores.server"
import type { UpdateWatchHistoryPayload } from "~/server/watchHistory.server"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface ScoreActionProps {
	children: React.ReactElement
	details: UserActionDetails
	score: Score | null
	onChange?: () => void
}

export default function ScoreAction({
	children,
	details,
	score,
	onChange,
}: ScoreActionProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const userScore = userData?.[media_type]?.[tmdb_id]?.score || null
	const watchHistoryAction = score === null ? "remove" : "add"

	const { submitProps } = useAPIAction<
		UpdateScoresPayload | UpdateWatchHistoryPayload,
		UpdateScoresResult
	>({
		endpoints: [
			{
				url: "/api/update-scores",
				params: {
					tmdb_id,
					media_type,
					score,
				},
			},
			{
				url: "/api/update-watch-history",
				params: {
					tmdb_id,
					media_type,
					action: watchHistoryAction,
				},
			},
		],
		onClick: children.props.onClick,
	})

	return (
		<UserAction
			instructions={
				<>Rate movies and tv shows to get better recommendations.</>
			}
			onChange={onChange}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	)
}
