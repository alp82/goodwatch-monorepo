import { MegaphoneIcon, PencilSquareIcon } from "@heroicons/react/24/solid";
import React from "react";
import type { Cast } from "~/server/details.server";

export interface CrewProps {
	crew: Cast[];
}

export default function Crew({ crew }: CrewProps) {
	const directors = (crew || [])
		.filter(
			(crewMember) =>
				crewMember.job === "Director" ||
				(crewMember.jobs || []).some((job) => job.job === "Director"),
		)
		.sort((a, b) =>
			a.total_episode_count ? b.total_episode_count - a.total_episode_count : 0,
		)
		.slice(0, 3);

	const writers = (crew || [])
		.filter(
			(crewMember) =>
				crewMember.job === "Executive Producer" ||
				(crewMember.jobs || []).some((job) => job.job === "Writer"),
		)
		.sort((a, b) =>
			a.total_episode_count ? b.total_episode_count - a.total_episode_count : 0,
		)
		.slice(0, 3);

	return (
		<div className="m-6">
			{directors.length > 0 && (
				<div className="mt-4 flex gap-2">
					<MegaphoneIcon className="w-6 h-6" />
					Directed by:{" "}
					<span className="font-bold">
						{directors.map((director) => director.name).join(", ")}
					</span>
				</div>
			)}
			{writers.length > 0 && (
				<div className="mt-4 flex gap-2">
					<PencilSquareIcon className="w-6 h-6" />
					Written by:{" "}
					<span className="font-bold">
						{writers.map((writer) => writer.name).join(", ")}
					</span>
				</div>
			)}
		</div>
	);
}
