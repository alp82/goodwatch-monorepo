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
			<>
				<div className="flex gap-1">
					<Icon className="w-6 h-6" />
					{title}:{" "}
				</div>
				<div className="sm:col-span-3 pb-6 font-semibold">
					{people.map((person) => person.name).join(", ")}
				</div>
			</>
		)
	}

	return (
		<>
			<h2 className="text-2xl font-bold">Crew</h2>
			<div className="my-4 grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-4">
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
