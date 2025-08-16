import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateSkippedPayload,
	UpdateSkippedResult,
} from "~/server/skipped.server"
import UserAction from "~/ui/auth/UserAction"
import {
	type UserActionProps,
} from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface SkippedActionProps extends UserActionProps {}

export default function SkippedAction({
	children,
	media,
	onChange,
}: SkippedActionProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details

	const { data: userData } = useUserData()
	const action = userData?.[mediaType]?.[tmdb_id]?.onSkipped ? "remove" : "add"

	const { submitProps } = useAPIAction<
		UpdateSkippedPayload,
		UpdateSkippedResult
	>({
		endpoints: [
			{
				url: "/api/update-skipped",
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
			instructions={<>Add titles you want to ignore for now.</>}
			onChange={onChange}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	)
}
