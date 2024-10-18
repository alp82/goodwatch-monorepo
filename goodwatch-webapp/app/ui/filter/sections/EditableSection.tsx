import React, { type ReactNode, useEffect } from "react"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import type { ColorName } from "~/utils/color"

interface SectionParams {
	label: string
	color: ColorName
	enabled: boolean
	editing: boolean
	onEdit: () => void
	onClose: () => void
	onRemoveAll: () => void
	renderEditing: () => ReactNode
	children: ReactNode
}

export default function EditableSection({
	label,
	color,
	enabled,
	editing,
	onEdit,
	onClose,
	onRemoveAll,
	renderEditing,
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

	const [isVisible, setIsVisible] = React.useState(isEditing || enabled)
	useEffect(() => {
		setIsVisible(isEditing || enabled)
	}, [isEditing, enabled])

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
			{isEditing ? renderEditing() : children}
		</FilterBarSection>
	)
}
