import React, { useState } from "react"
import { discoverFilters, watchOptions } from "~/server/types/discover-types"
import UserAction from "~/ui/auth/UserAction"
import { Tag } from "~/ui/tags/Tag"
import { useUser } from "~/utils/auth"

export interface DidntWatchCheckboxProps {
	initialEnabled: boolean
	onChange: (filterByDidntWatch: boolean) => void
}

export const DidntWatchCheckbox = ({
	initialEnabled,
	onChange,
}: DidntWatchCheckboxProps) => {
	const watchFilter = discoverFilters.watch
	const didntWatchOption = watchOptions.find(
		(option) => option.name === "didnt-watch",
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
		<UserAction instructions={watchFilter.loginInstructions}>
			<div
				className="pl-2 flex items-center gap-2 bg-black/40 hover:bg-black/70 border-2 border-transparent hover:border-orange-600/60 cursor-pointer"
				onClick={handleToggle}
				onKeyUp={() => {}}
			>
				<input
					type="checkbox"
					checked={checked}
					className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-600 ring-offset-gray-800 focus:ring-2 cursor-pointer"
				/>
				<Tag
					color={checked ? didntWatchOption?.color : "gray"}
					icon={didntWatchOption?.icon}
				>
					{didntWatchOption?.label}
				</Tag>
			</div>
		</UserAction>
	)
}
