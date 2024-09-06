import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateWatchHistoryPayload,
	UpdateWatchHistoryResult,
} from "~/server/watchHistory.server"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface WatchHistoryActionProps {
	children: React.ReactElement
	details: UserActionDetails
	actionOverwrite?: "add" | "remove"
}

export default function WatchHistoryAction({
	children,
	details,
	actionOverwrite,
}: WatchHistoryActionProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const toggleAction = userData?.[media_type]?.[tmdb_id]?.onWatchHistory
		? "remove"
		: "add"
	const action = actionOverwrite ? actionOverwrite : toggleAction

	const { submitProps } = useAPIAction<
		UpdateWatchHistoryPayload,
		UpdateWatchHistoryResult
	>({
		endpoints: [
			{
				url: "/api/update-watch-history",
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
			instructions={<>Your history shows every title you ever have watched.</>}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	)
}
