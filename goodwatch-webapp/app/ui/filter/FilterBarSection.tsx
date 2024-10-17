import type React from "react"
import type { ColorName } from "~/utils/color"

interface FilterBarSectionParams {
	label: string
	color: ColorName
	onSelect: () => void
	children: React.ReactNode
}

export default function FilterBarSection({
	label,
	color,
	onSelect,
	children,
}: FilterBarSectionParams) {
	const transparency = 50
	return (
		<div
			className={`flex flex-col flex-wrap gap-2 justify-between grow p-2 bg-gradient-to-br from-${color}-700/${transparency} via-${color}-900/${transparency} to-${color}-800/${transparency} hover:brightness-150`}
			onClick={onSelect}
			onKeyDown={() => null}
		>
			<div className="text-xs font-extrabold">{label}</div>
			<div className="flex flex-wrap items-center gap-1">{children}</div>
		</div>
	)
}
