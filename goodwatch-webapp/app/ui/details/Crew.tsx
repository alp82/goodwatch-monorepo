import {
	BriefcaseIcon,
	MegaphoneIcon,
	MusicalNoteIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import type { CrewLines, CrewPerson } from "~/server/types/details-types"
import { personPath } from "~/utils/helpers"

export interface CrewProps {
	/** The four crew lines, already chosen and ordered by the details statement. */
	crew: CrewLines
}

export default function Crew({ crew }: CrewProps) {
	const { directors, writers, producers, composers } = crew

	const RenderInfo = ({
		title,
		Icon,
		people,
	}: {
		title: string
		Icon: React.ComponentType<{ className?: string }>
		people: CrewPerson[]
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
