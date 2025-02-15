import React, { useState } from "react"
import { discoverFilters, watchOptions } from "~/server/types/discover-types"
import UserAction from "~/ui/auth/UserAction"
import { Tag } from "~/ui/tags/Tag"
import { useUser } from "~/utils/auth"

export interface MyStreamingCheckboxProps {
	initialEnabled: boolean
	onChange: (filterByMyStreaming: boolean) => void
}

export const MyStreamingCheckbox = ({
	initialEnabled,
	onChange,
}: MyStreamingCheckboxProps) => {
	const streamingFilter = discoverFilters.streaming
	const loginInstructions = (
		<>
			Only show what's available on your <strong>streaming services</strong> in
			your <strong>country</strong> to quickly find what you're looking for.
		</>
	)

	const { user } = useUser()
	const isUserLoggedIn = Boolean(user)

	const [isEnabled, setIsEnabled] = useState(initialEnabled)
	const handleToggle = () => {
		onChange(!isEnabled)
		setIsEnabled((enabled) => !enabled)
	}

	const checked = isEnabled && isUserLoggedIn

	return (
		<UserAction instructions={loginInstructions}>
			<div
				className="pl-2 flex items-center gap-2 bg-black/40 hover:bg-black/70 border-2 border-transparent hover:border-emerald-600/60 cursor-pointer"
				onClick={handleToggle}
				onKeyUp={() => {}}
			>
				<input
					type="checkbox"
					checked={checked}
					className="w-4 h-4 text-emerald-600 bg-gray-300 border-gray-600 rounded focus:ring-emerald-600 ring-offset-gray-800 focus:ring-2 cursor-pointer"
				/>
				<Tag color={checked ? streamingFilter?.color : "white"}>
					Available on my Streaming Services
				</Tag>
			</div>
		</UserAction>
	)
}
