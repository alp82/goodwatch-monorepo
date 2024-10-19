import React, { type ReactNode, useEffect } from "react"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import type { ColorName } from "~/utils/color"

interface SectionParams {
	label: string
	color: ColorName
	visible: boolean
	editing: boolean
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
	onEdit,
	onClose,
	onRemoveAll,
	children,
}: SectionParams) {
	// visibility & editing logic

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

	const [isVisible, setIsVisible] = React.useState(isEditing || visible)
	useEffect(() => {
		setIsVisible(isEditing || visible)
	}, [isEditing, visible])

	// update handlers

	const handleRemoveAll = () => {
		onRemoveAll()
		onClose()
		setIsEditing(false)
		setIsVisible(false)
	}

	// rendering

	if (!isVisible) return null

	return (
		<FilterBarSection
			label={label}
			color={color}
			isActive={isEditing}
			onToggle={onToggleEditing}
			onRemove={handleRemoveAll}
		>
			{children(isEditing)}
		</FilterBarSection>
	)
}
