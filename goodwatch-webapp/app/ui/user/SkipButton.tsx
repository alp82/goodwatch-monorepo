import { ForwardIcon } from "@heroicons/react/24/solid"
import React, { useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import SkippedAction from "~/ui/user/actions/SkippedAction"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface SkipButtonProps {
	media: MovieResult | ShowResult
	onChange?: () => void
}

export default function SkipButton({ media, onChange }: SkipButtonProps) {
	const { details, mediaType } = media
	const { tmdb_id } = details
	const [isActive, setIsActive] = useState(false)

	const { data: userData } = useUserData()
	const userDataItem = userData?.[mediaType]?.[tmdb_id]
	const isSkipped = userDataItem?.onSkipped

	const SkippedIcon = ForwardIcon
	const skippedColor = isSkipped || isActive ? "text-pink-500" : "text-gray-400"
	const skippedText = isSkipped ? "Skipped" : "Skip"
	const skippedAction = isSkipped ? "Don't skip" : "Skip"

	return (
		<SkippedAction media={media} onChange={onChange}>
			<button
				type="button"
				className={`${isSkipped ? "bg-slate-700" : "bg-zinc-700"} rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm md:text-md font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700`}
				onPointerEnter={() => setIsActive(true)}
				onPointerLeave={() => setIsActive(false)}
			>
				<SkippedIcon className={`h-5 w-auto ${skippedColor}`} />
				{isActive ? skippedAction : skippedText}
			</button>
		</SkippedAction>
	)
}
