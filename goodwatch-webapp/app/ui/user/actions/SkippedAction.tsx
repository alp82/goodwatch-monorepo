import React from "react"
import { useUserData } from "~/routes/api.user-data"
import type {
	UpdateSkippedPayload,
	UpdateSkippedResult,
} from "~/server/skipped.server"
import UserAction from "~/ui/auth/UserAction"
import type { UserActionDetails } from "~/ui/user/actions/types"
import { useAPIAction } from "~/utils/api-action"

export interface SkippedActionProps {
	children: React.ReactElement
	details: UserActionDetails
	onChange?: () => void
}

export default function SkippedAction({
	children,
	details,
	onChange,
}: SkippedActionProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()
	const action = userData?.[media_type]?.[tmdb_id]?.onSkipped ? "remove" : "add"

	const { submitProps } = useAPIAction<
		UpdateSkippedPayload,
		UpdateSkippedResult
	>({
		url: "/api/update-skipped",
		params: {
			tmdb_id,
			media_type,
			action,
		},
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
