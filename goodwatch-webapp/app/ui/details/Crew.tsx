import {
	BriefcaseIcon,
	MegaphoneIcon,
	MusicalNoteIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/solid"
import React from "react"
import type { Cast } from "~/server/details.server"

export interface CrewProps {
	crew: Cast[]
}

export default function Crew({ crew }: CrewProps) {
	const filterCrew = (crew: Cast[], jobTitle: string) => {
		return (crew || [])
			.filter(
				(crewMember) =>
					(crewMember.job || "").includes(jobTitle) ||
					(crewMember.jobs || []).some((job) =>
						(job.job || "").includes(jobTitle),
					),
			)
			.sort((a, b) =>
				a.total_episode_count
					? b.total_episode_count - a.total_episode_count
					: 0,
			)
			.slice(0, 3)
	}

	const directors = filterCrew(crew, "Director")
	const writers = filterCrew(crew, "Writer")
	const producers = filterCrew(crew, "Producer")
	const composers = filterCrew(crew, "Composer")

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
