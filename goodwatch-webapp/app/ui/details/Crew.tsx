import {
	BriefcaseIcon,
	MegaphoneIcon,
	MusicalNoteIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/solid"
import React from "react"
import type { Crew as CrewType } from "~/server/types/details-types"

export interface CrewProps {
	crew: CrewType[]
}

export default function Crew({ crew }: CrewProps) {
	const filterCrew = (crew: CrewType[], job: string, department: string) => {
		return (crew || [])
			.filter(
				(crewMember) =>
					crewMember.job === job || crewMember.department === department,
			)
			.sort((a, b) => (a.popularity ? b.popularity - a.popularity : 0))
			.sort((a, b) =>
				a.episode_count_total && b.episode_count_total
					? b.episode_count_total - a.episode_count_total
					: 0,
			)
			.slice(0, 3)
	}

	const directors = filterCrew(crew, "Director", "Directing")
	const writers = filterCrew(crew, "Writer", "Writing")
	const producers = filterCrew(crew, "Producer", "Production")
	const composers = filterCrew(crew, "Original Music Composer", "Sound")

	const RenderInfo = ({ title, Icon, people }) => {
		if (people.length === 0) return null

		return (
			<div className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
				<div className="flex gap-2 w-48 flex-shrink-0 text-gray-400">
					<Icon className="w-6 h-6" />
					{title}:{" "}
				</div>
				<div className="font-semibold flex-1">
					{people.map((person) => person.name).join(", ")}
				</div>
			</div>
		)
	}

	return (
		<>
			<h2 className="text-2xl font-bold">Crew</h2>
			<div className="my-4 flex flex-col gap-6">
				<RenderInfo
					title="Directed by"
					Icon={MegaphoneIcon}
					people={directors}
				/>
				<RenderInfo
					title="Written by"
					Icon={PencilSquareIcon}
					people={writers}
				/>
				<RenderInfo
					title="Produced by"
					Icon={BriefcaseIcon}
					people={producers}
				/>
				<RenderInfo
					title="Composed by"
					Icon={MusicalNoteIcon}
					people={composers}
				/>
			</div>
		</>
	)
}
