import React, { type ReactNode, useEffect } from "react"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import FilterChip from "~/ui/filter/FilterChip"
import type { ColorName } from "~/utils/color"

interface SectionParams {
	label: string
	color: ColorName
	visible: boolean
	editing: boolean
	active: boolean
	onEdit: () => void
	onClose: () => void
	onRemoveAll: () => void
	children: (isEditing: boolean) => ReactNode
}

export default function EditableSection({
	label,
	color,
	visible,
	editing,
	active,
	onEdit,
	onClose,
	onRemoveAll,
	children,
}: SectionParams) {
	// editing logic

	const [isEditing, setIsEditing] = React.useState(editing)
	const onToggleEditing = () => {
		setIsEditing((prev) => {
			const next = !prev
			if (next) {
				onEdit()
			} else {
				onClose()
			}
			return next
		})
	}
	useEffect(() => {
		setIsEditing(editing)
	}, [editing])

	// update handlers

	const [hasRemoved, setHasRemoved] = React.useState(false)
	const handleRemoveAll = () => {
		setHasRemoved(true)
		onRemoveAll()
		onClose()
	}
	useEffect(() => {
		if (editing) {
			setHasRemoved(false)
		}
	}, [editing])
	useEffect(() => {
		if (visible) {
			setHasRemoved(false)
		}
	}, [visible])

	// visibility logic
	const skipSectionRender = (!isEditing && !visible) || hasRemoved
	if (skipSectionRender) return null

	// rendering

	// a chip while idle, the big box on its own line while editing
	return (
		<>
			<FilterChip
				label={label}
				color={color}
				isEditing={isEditing}
				onEdit={onToggleEditing}
				onRemove={handleRemoveAll}
			>
				{children(false)}
			</FilterChip>
			{isEditing && (
				<div className="order-last basis-full flex">
					<div className="flex min-w-[min(24rem,100%)] max-w-full">
						<FilterBarSection
							label={label}
							color={color}
							isActive={true}
							onClick={onToggleEditing}
							onRemove={handleRemoveAll}
						>
							{children(true)}
						</FilterBarSection>
					</div>
				</div>
			)}
		</>
	)
}
