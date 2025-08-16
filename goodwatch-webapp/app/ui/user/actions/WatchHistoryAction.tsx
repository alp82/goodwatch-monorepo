import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateWatchHistoryPayload,
	UpdateWatchHistoryResult,
} from "~/server/watchHistory.server"
import UserAction from "~/ui/auth/UserAction"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useAPIAction } from "~/utils/api-action"

export interface WatchHistoryActionProps {
	children: React.ReactElement
	media: MovieResult | ShowResult
	actionOverwrite?: "add" | "remove"
}

export default function WatchHistoryAction({
	children,
	media,
	actionOverwrite,
}: WatchHistoryActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const toggleAction = userData?.[mediaType]?.[tmdb_id]?.onWatchHistory
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
					media_type: mediaType === "show" ? "tv" : "movie",
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
