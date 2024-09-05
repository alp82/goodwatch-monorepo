import React from "react"
import type {
	Score,
	UpdateScoresPayload,
	UpdateScoresResult,
} from "~/server/scores.server"
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

	const { submitProps } = useAPIAction<UpdateScoresPayload, UpdateScoresResult>(
		{
			url: "/api/update-scores",
			params: {
				tmdb_id,
				media_type,
				score,
			},
			onClick: children.props.onClick,
		},
	)

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
