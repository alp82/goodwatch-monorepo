import { CheckIcon, XMarkIcon } from "@heroicons/react/20/solid"
import type React from "react"
import type { ColorName } from "~/utils/color"

interface FilterBarSectionParams {
	label?: string
	isCompact?: boolean
	color: ColorName
	isActive: boolean
	onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void
	onRemove?: () => void
	children: React.ReactNode
}

export default function FilterBarSection({
	label,
	isCompact = false,
	color,
	isActive = false,
	onClick,
	onRemove,
	children,
}: FilterBarSectionParams) {
	const transparency = isActive ? 80 : 50

	const isInteractive = onClick && (isCompact || !isActive)
	return (
		<div
			className={`
				flex flex-col flex-wrap gap-2 p-2 ${isCompact ? "justify-center" : "justify-between grow"}
				bg-gradient-to-br from-${color}-700/${transparency} via-${color}-900/${transparency} to-${color}-800/${transparency}
				border-4 ${isActive ? "border-white/50" : "border-white/10"}
				transition duration-150 
				${isActive ? "bg-[length:200%_200%] animate-gradient-x via-50% to-70%" : ""}
				${isInteractive ? "cursor-pointer hover:brightness-125" : ""}
			`}
			onClick={(e) => (isInteractive ? onClick(e) : null)}
			onKeyDown={() => null}
		>
			{label && (
				<div className="flex items-center justify-between text-xs">
					<span className="text-sm font-extrabold">{label}</span>
					{isActive && onClick && onRemove && (
						<span className="flex gap-2">
							<button
								type="button"
								className="
							flex items-center gap-1 py-0.5 px-1.5
							border-2 border-red-500/70 rounded
							bg-red-900/80 hover:bg-red-800/80 cursor-pointer
						"
								onClick={onRemove}
							>
								<XMarkIcon className="h-4 w-4" />
								Remove Filter
							</button>
							<button
								type="button"
								className="
							flex items-center gap-1 py-0.5 px-1.5
							border-2 border-green-500/70 rounded
							bg-green-900/80 hover:bg-green-800/80 cursor-pointer
						"
								onClick={onClick}
							>
								<CheckIcon className="h-4 w-4" />
								Apply Filter
							</button>
						</span>
					)}
				</div>
			)}
			<div className="flex flex-wrap items-center gap-1">{children}</div>
		</div>
	)
}
