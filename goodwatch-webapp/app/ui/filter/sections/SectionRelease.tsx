import { CalendarDaysIcon } from "@heroicons/react/24/solid"
import React, { useEffect } from "react"
import type { DiscoverParams } from "~/server/discover.server"
import { discoverFilters } from "~/server/types/discover-types"
import PresetButton from "~/ui/button/PresetButton"
import EditableSection from "~/ui/filter/sections/EditableSection"
import NumberInput from "~/ui/form/NumberInput"
import { RangeSlider } from "~/ui/form/RangeSlider"
import { Tag } from "~/ui/tags/Tag"
import { useNav } from "~/utils/navigation"

const STEP_COUNT = 10

const earliestReleaseYear = 1900
const currentYear = new Date().getFullYear()

const presets = [
	{
		label: "Since 2000",
		minYear: 2000,
		maxYear: currentYear,
	},
	{
		label: "Last 2 years",
		minYear: currentYear - 2,
		maxYear: currentYear,
	},
	{
		label: "Last 5 years",
		minYear: currentYear - 5,
		maxYear: currentYear,
	},
	{
		label: "Last decade",
		minYear: 2010,
		maxYear: 2020,
	},
	{
		label: "All until today",
		minYear: earliestReleaseYear,
		maxYear: currentYear,
	},
]

interface SectionReleaseParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionRelease({
	params,
	editing,
	onEdit,
	onClose,
}: SectionReleaseParams) {
	// data

	const [yearValues, setYearValues] = React.useState([
		params.minYear !== undefined
			? Number.parseInt(params.minYear)
			: presets[0].minYear,
		params.maxYear !== undefined
			? Number.parseInt(params.maxYear)
			: presets[0].maxYear,
	])
	const minYear =
		typeof yearValues[0] === "number"
			? yearValues[0]
			: Number.parseInt(params.minYear)
	const maxYear =
		typeof yearValues[1] === "number"
			? yearValues[1]
			: Number.parseInt(params.maxYear)

	// update handlers

	const { updateQueryParams } =
		useNav<Pick<DiscoverParams, "minYear" | "maxYear">>()
	useEffect(() => {
		if (
			!editing ||
			params.minYear !== undefined ||
			params.maxYear !== undefined
		)
			return

		const defaultPreset = presets[0]
		setYearValues([defaultPreset.minYear, defaultPreset.maxYear])
		updateQueryParams({
			minYear: defaultPreset.minYear.toString(),
			maxYear: defaultPreset.maxYear.toString(),
		})
	}, [editing, params.minYear, params.maxYear])

	const updateYears = (values: number[]) => {
		updateQueryParams({
			minYear: values[0].toString(),
			maxYear: values[1].toString(),
		})
	}

	const handlePreset = (preset: (typeof presets)[number]) => {
		const { minYear, maxYear } = preset
		setYearValues([minYear, maxYear])
		updateQueryParams({
			minYear: minYear.toString(),
			maxYear: maxYear.toString(),
		})
	}
	const setMinYear = (value: string) => {
		const parsedMinYear = Number.parseInt(value)
		if (!parsedMinYear) return
		setYearValues((prev) => [parsedMinYear, prev[1]])
	}
	const setMaxYear = (value: string) => {
		const parsedMaxYear = Number.parseInt(value)
		if (!parsedMaxYear) return
		setYearValues((prev) => [prev[0], parsedMaxYear])
	}
	const normalizeYears = () => {
		const realMinYear = Math.min(
			Math.max(yearValues[0], earliestReleaseYear),
			currentYear,
		)
		const realMaxYear = Math.min(
			Math.max(yearValues[1], earliestReleaseYear),
			currentYear,
		)
		const normalizedMinYear = Math.min(realMinYear, realMaxYear)
		const normalizedMaxYear = Math.max(realMinYear, realMaxYear)
		setYearValues([normalizedMinYear, normalizedMaxYear])
		updateQueryParams({
			minYear: normalizedMinYear.toString(),
			maxYear: normalizedMaxYear.toString(),
		})
	}

	const handleRemoveAll = () => {
		updateQueryParams({
			minYear: undefined,
			maxYear: undefined,
		})
		onClose()
	}

	// rendering

	return (
		<EditableSection
			label={discoverFilters.release.label}
			color={discoverFilters.release.color}
			visible={params.minYear !== undefined || params.maxYear !== undefined}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="w-full flex flex-col flex-wrap gap-2">
					{isEditing && (
						<div className="my-5 flex flex-col gap-6 overflow-x-hidden">
							<div className="hidden xs:block">
								<RangeSlider
									label="Select Score"
									values={yearValues}
									min={earliestReleaseYear}
									max={currentYear}
									step={STEP_COUNT}
									draggableTrack={true}
									onChange={setYearValues}
									onFinalChange={updateYears}
								/>
							</div>
							<div className="flex justify-between gap-4">
								<div className="flex flex-wrap gap-2">
									{presets.map((preset) => (
										<PresetButton
											key={preset.label}
											active={
												minYear === preset.minYear && maxYear === preset.maxYear
											}
											onClick={() => handlePreset(preset)}
										>
											{preset.label}
										</PresetButton>
									))}
								</div>
								<div className="mt-1 flex gap-3 items-center">
									<NumberInput
										name="minYear"
										placeholder="Min Year"
										value={minYear.toString() || ""}
										onChange={(event) => setMinYear(event.target.value)}
										onBlur={normalizeYears}
									/>
									<span className="italic">to</span>
									<NumberInput
										name="maxYear"
										placeholder="Max Year"
										value={maxYear.toString() || ""}
										onChange={(event) => setMaxYear(event.target.value)}
										onBlur={normalizeYears}
									/>
								</div>
							</div>
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<Tag icon={CalendarDaysIcon}>
							{minYear} - {maxYear}
						</Tag>
					</div>
				</div>
			)}
		</EditableSection>
	)
}
