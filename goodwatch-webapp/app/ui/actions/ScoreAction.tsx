import React from "react";
import type { MovieDetails, TVDetails } from "~/server/details.server";
import type {
	Score,
	UpdateScoresPayload,
	UpdateScoresResult,
} from "~/server/scores.server";
import UserAction from "~/ui/auth/UserAction";
import { useAPIAction } from "~/utils/api-action";

export interface ScoreActionProps {
	children: React.ReactElement;
	details: MovieDetails | TVDetails;
	score: Score | null;
}

export default function ScoreAction({
	children,
	details,
	score,
}: ScoreActionProps) {
	const { tmdb_id, media_type } = details;

	const { submitProps } = useAPIAction<UpdateScoresPayload, UpdateScoresResult>(
		{
			url: "/api/update-scores",
			params: {
				tmdb_id,
				media_type,
				score,
			},
			onClick: children.props.onClick,
		},
	);

	return (
		<UserAction
			instructions={
				<>Rate movies and tv shows to get better recommendations.</>
			}
		>
			{React.cloneElement(children, { ...submitProps })}
		</UserAction>
	);
}
