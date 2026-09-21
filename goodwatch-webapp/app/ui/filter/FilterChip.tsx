import { XMarkIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import type { ColorName } from "~/utils/color"

interface FilterChipParams {
	label: string
	color: ColorName
	isEditing?: boolean
	onEdit: () => void
	onRemove: () => void
	children: ReactNode
}

export default function FilterChip({
	label,
	color,
	isEditing = false,
	onEdit,
	onRemove,
	children,
}: FilterChipParams) {
	return (
		<FilterBarSection isCompact={true} isActive={false} color={color}>
			<span
				className={`flex items-center gap-2 py-0.5 ${isEditing ? "opacity-60" : ""}`}
			>
				<button
					type="button"
					className="flex flex-wrap items-center gap-2 px-1 cursor-pointer hover:brightness-125"
					aria-expanded={isEditing}
					onClick={onEdit}
				>
					<span className="font-extrabold">{label}</span>
					<span className="flex flex-wrap items-center gap-1 text-xs pointer-events-none">
						{children}
					</span>
				</button>
				<button
					type="button"
					className="p-0.5 rounded hover:bg-white/20 cursor-pointer"
					aria-label={`Remove ${label} filter`}
					onClick={onRemove}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</span>
		</FilterBarSection>
	)
}
