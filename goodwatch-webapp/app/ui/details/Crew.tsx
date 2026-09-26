import {
	BriefcaseIcon,
	MegaphoneIcon,
	MusicalNoteIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import type { Crew as CrewType } from "~/server/types/details-types"
import { personPath } from "~/utils/helpers"

export interface CrewProps {
	crew: CrewType[]
}

/** The job and department of each crew line. A crew member shows when either matches. */
export const CREW_ROLES = {
	directors: { job: "Director", department: "Directing" },
	writers: { job: "Writer", department: "Writing" },
	producers: { job: "Producer", department: "Production" },
	composers: { job: "Original Music Composer", department: "Sound" },
} as const

export default function Crew({ crew }: CrewProps) {
	const filterCrew = (crew: CrewType[], { job, department }: { job: string; department: string }) => {
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

	const directors = filterCrew(crew, CREW_ROLES.directors)
	const writers = filterCrew(crew, CREW_ROLES.writers)
	const producers = filterCrew(crew, CREW_ROLES.producers)
	const composers = filterCrew(crew, CREW_ROLES.composers)

	const RenderInfo = ({
		title,
		Icon,
		people,
	}: {
		title: string
		Icon: React.ComponentType<{ className?: string }>
		people: CrewType[]
	}) => {
		if (people.length === 0) return null

		return (
			<div className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
				<div className="flex gap-2 w-48 flex-shrink-0 text-gray-400">
					<Icon className="w-6 h-6" />
					{title}:{" "}
				</div>
				<div className="font-semibold flex-1">
					{people.map((person, index) => (
						<React.Fragment key={person.credit_id}>
							{index > 0 && ", "}
							<Link
								to={personPath(person.id, person.name)}
								prefetch="intent"
								className="underline decoration-gray-600 underline-offset-4 hover:text-amber-300 hover:decoration-amber-300"
							>
								{person.name}
							</Link>
						</React.Fragment>
					))}
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
