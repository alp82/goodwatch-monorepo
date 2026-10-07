import React from "react"
import { useSeenToggle } from "~/hooks/useSeenToggle"
import UserAction from "~/ui/auth/UserAction"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

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

	const { toggle, isPending } = useSeenToggle(mediaType, tmdb_id)

	const handleClick = () => {
		toggle(actionOverwrite)
	}

	return (
		<UserAction
			instructions={<>Your history shows every title you ever have watched.</>}
		>
			{React.cloneElement(children, {
				onClick: handleClick,
				disabled: isPending,
				style: isPending ? { pointerEvents: "none", opacity: 0.7 } : {},
			})}
		</UserAction>
	)
}
