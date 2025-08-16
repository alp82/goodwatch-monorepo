import type React from "react"
import type { ComponentType, HTMLAttributes } from "react"
import { useState } from "react"
import type {
	UserActionDetails,
	UserActionProps,
} from "~/ui/user/actions/types"
import type { BgColor, OutlineColor, TextColor } from "~/utils/color"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface ActionButtonProps {
	media: MovieResult | ShowResult
	isActive: boolean
	actionElement: React.ComponentType<UserActionProps>
	iconElement: ComponentType<HTMLAttributes<SVGElement>>
	bg: BgColor
	outline: OutlineColor
	color: TextColor
	labelText: string
	labelAction: string
	onChange?: () => void
}

export default function ActionButton({
	media,
	isActive,
	actionElement,
	iconElement,
	bg,
	outline,
	color,
	labelText,
	labelAction,
	onChange,
}: ActionButtonProps) {
	const [isHovered, setIsHovered] = useState(false)

	const ActionElement = actionElement
	const IconElement = iconElement

	const currentBg = isActive || isHovered ? bg : "bg-zinc-700"
	const currentColor = isActive || isHovered ? color : "text-gray-300"

	return (
		<ActionElement media={media} onChange={onChange}>
			<button
				type="button"
				className={`
					rounded-md w-full px-1 py-2 lg:px-3.5 lg:py-2.5
					flex items-center justify-center gap-2
					text-xs md:text-sm lg:text-md font-semibold text-white cursor-pointer
					${currentBg} hover:${currentBg}/70 shadow-sm
					focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:${outline}/70
				`}
				onPointerEnter={() => setIsHovered(true)}
				onPointerLeave={() => setIsHovered(false)}
			>
				<IconElement className={`h-4 lg:h-5 w-auto ${currentColor}`} />
				{isHovered ? labelAction : labelText}
			</button>
		</ActionElement>
	)
}
