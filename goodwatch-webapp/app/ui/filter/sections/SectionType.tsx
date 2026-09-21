import { FilmIcon, TvIcon } from "@heroicons/react/20/solid"
import React, { useEffect } from "react"
import { discoverFilters } from "~/server/types/discover-types"
import EditableSection from "~/ui/filter/sections/EditableSection"
import RadioBlock, { type RadioOption } from "~/ui/form/RadioBlock"
import { Tag } from "~/ui/tags/Tag"

export type TitleType = "movie" | "show"

const typeOptions: (RadioOption & { name: TitleType })[] = [
	{
		name: "movie",
		label: "Movies",
		description: "Show only movies",
		icon: FilmIcon,
	},
	{
		name: "show",
		label: "Shows",
		description: "Show only TV shows",
		icon: TvIcon,
	},
]

interface SectionTypeParams {
	value?: TitleType
	onChange: (value: TitleType | undefined) => void
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionType({
	value,
	onChange,
	editing,
	onEdit,
	onClose,
}: SectionTypeParams) {
	const selectedOption = typeOptions.find((option) => option.name === value)

	useEffect(() => {
		if (editing && !value) {
			onChange(typeOptions[0].name)
		}
	}, [editing])

	const handleRemoveAll = () => {
		onChange(undefined)
		onClose()
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.type.label}
			color={discoverFilters.type.color}
			visible={Boolean(value)}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="flex flex-col flex-wrap gap-2">
					{isEditing && (
						<RadioBlock
							options={typeOptions}
							value={selectedOption}
							orientation="vertical"
							onChange={(option) => onChange(option.name as TitleType)}
						/>
					)}
					{selectedOption && (
						<Tag icon={selectedOption.icon}>{selectedOption.label}</Tag>
					)}
				</div>
			)}
		</EditableSection>
	)
}
