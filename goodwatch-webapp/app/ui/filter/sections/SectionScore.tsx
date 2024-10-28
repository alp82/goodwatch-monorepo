import React, { useEffect } from "react"
import type { DiscoverParams } from "~/server/discover.server"
import { discoverFilters } from "~/server/types/discover-types"
import PresetButton from "~/ui/button/PresetButton"
import EditableSection from "~/ui/filter/sections/EditableSection"
import NumberInput from "~/ui/form/NumberInput"
import { RangeSlider } from "~/ui/form/RangeSlider"
import { useNav } from "~/utils/navigation"

const STEP_COUNT = 10

const presets = [
	{
		label: "The Good",
		minScore: 60,
		maxScore: 100,
	},
	{
		label: "The Best",
		minScore: 80,
		maxScore: 100,
	},
	{
		label: "The Ugly",
		minScore: 0,
		maxScore: 40,
	},
]

interface SectionScoreParams {
	params: DiscoverParams
	editing: boolean
	onEdit: () => void
	onClose: () => void
}

export default function SectionScore({
	params,
	editing,
	onEdit,
	onClose,
}: SectionScoreParams) {
	// data

	const [scoreValues, setScoreValues] = React.useState([
		params.minScore !== undefined
			? Number.parseInt(params.minScore)
			: presets[0].minScore,
		params.maxScore !== undefined
			? Number.parseInt(params.maxScore)
			: presets[0].maxScore,
	])
	const minScore =
		typeof scoreValues[0] === "number"
			? scoreValues[0]
			: Number.parseInt(params.minScore)
	const maxScore =
		typeof scoreValues[1] === "number"
			? scoreValues[1]
			: Number.parseInt(params.maxScore)

	// update handlers

	const { updateQueryParams } =
		useNav<Pick<DiscoverParams, "minScore" | "maxScore">>()
	useEffect(() => {
		if (
			!editing ||
			params.minScore !== undefined ||
			params.maxScore !== undefined
		)
			return

		updateQueryParams({
			minScore: presets[0].minScore.toString(),
			maxScore: presets[1].maxScore.toString(),
		})
	}, [editing, params.minScore, params.maxScore])

	const updateScores = (values: number[]) => {
		updateQueryParams({
			minScore: values[0].toString(),
			maxScore: values[1].toString(),
		})
	}

	const handlePreset = (preset: (typeof presets)[number]) => {
		const { minScore, maxScore } = preset
		setScoreValues([minScore, maxScore])
		updateQueryParams({
			minScore: minScore.toString(),
			maxScore: maxScore.toString(),
		})
	}
	const setMinScore = (value: string) => {
		const parsedMinScore = Number.parseInt(value)
		setScoreValues((prev) => [parsedMinScore, prev[1]])
	}
	const setMaxScore = (value: string) => {
		const parsedMaxScore = Number.parseInt(value)
		setScoreValues((prev) => [prev[0], parsedMaxScore])
	}
	const normalizeScores = () => {
		const realMinScore = Math.min(Math.max(scoreValues[0], 0), 100)
		const realMaxScore = Math.min(Math.max(scoreValues[1], 0), 100)
		const normalizedMinScore = Math.min(realMinScore, realMaxScore)
		const normalizedMaxScore = Math.max(realMinScore, realMaxScore)
		setScoreValues([normalizedMinScore, normalizedMaxScore])
		updateQueryParams({
			minScore: normalizedMinScore.toString(),
			maxScore: normalizedMaxScore.toString(),
		})
	}

	const handleRemoveAll = () => {
		updateQueryParams({
			minScore: undefined,
			maxScore: undefined,
		})
		onClose()
	}

	// rendering

	const getBgColorName = (score: number) => {
		const vibeColorIndex = Math.floor(score / 10) * 10
		return `bg-vibe-${vibeColorIndex}`
	}

	return (
		<EditableSection
			label={discoverFilters.score.label}
			color={discoverFilters.score.color}
			visible={params.minScore !== undefined || params.maxScore !== undefined}
			editing={editing}
			active={true}
			onEdit={onEdit}
			onClose={onClose}
			onRemoveAll={handleRemoveAll}
		>
			{(isEditing) => (
				<div className="w-full flex flex-col flex-wrap gap-2">
					{isEditing && (
						<div className="my-5 flex flex-col gap-6">
							<div className="hidden xs:block">
								<RangeSlider
									label="Select Score"
									values={scoreValues}
									min={0}
									max={100}
									step={STEP_COUNT}
									draggableTrack={true}
									onChange={setScoreValues}
									onFinalChange={updateScores}
								/>
							</div>
							<div className="flex justify-between gap-4">
								<div className="flex flex-wrap gap-2">
									{presets.map((preset) => (
										<PresetButton
											key={preset.label}
											active={
												minScore === preset.minScore &&
												maxScore === preset.maxScore
											}
											onClick={() => handlePreset(preset)}
										>
											{preset.label}
										</PresetButton>
									))}
								</div>
								<div className="mt-1 flex gap-3 items-center">
									<NumberInput
										name="minScore"
										placeholder="Min Score"
										value={minScore.toString() || ""}
										min={0}
										max={100}
										onChange={(event) => setMinScore(event.target.value)}
										onBlur={normalizeScores}
									/>
									<span className="italic">to</span>
									<NumberInput
										name="maxScore"
										placeholder="Max Score"
										value={maxScore.toString() || ""}
										min={0}
										max={100}
										onChange={(event) => setMaxScore(event.target.value)}
										onBlur={normalizeScores}
									/>
								</div>
							</div>
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						From{" "}
						<span
							className={`
								py-1 px-2
								font-extrabold text-lg
								${getBgColorName(minScore)}
							`}
						>
							{minScore}
						</span>{" "}
						to
						<span
							className={`
								py-1 px-2
								font-extrabold text-lg
								${getBgColorName(maxScore)}
							`}
						>
							{maxScore}
						</span>
					</div>
				</div>
			)}
		</EditableSection>
	)
}
