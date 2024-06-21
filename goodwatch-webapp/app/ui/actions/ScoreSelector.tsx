import { useLoaderData } from "@remix-run/react";
import React, { useEffect, useState } from "react";
import type { LoaderData } from "~/routes/movie.$movieKey";
import type { MovieDetails, TVDetails } from "~/server/details.server";
import type { Score } from "~/server/scores.server";
import ScoreAction from "~/ui/actions/ScoreAction";

interface ScoreSelectorProps {
	details: MovieDetails | TVDetails;
}

export default function ScoreSelector({ details }: ScoreSelectorProps) {
	const { tmdb_id, media_type } = details;

	const { userData } = useLoaderData<LoaderData>();
	const userScore = userData?.[media_type]?.[tmdb_id]?.score || null;
	const [score, setScore] = useState<Score | null>(userScore);
	useEffect(() => {
		if (score === userScore) return;
		setScore(userScore);
	}, [userScore]);

	const [hoveredScore, setHoveredScore] = useState<Score | null>(null);
	const [clearedScore, setClearedScore] = useState<Score | null>(null);

	const scoreLabels = [
		"Not Rated",
		"Unwatchable",
		"Terrible",
		"Bad",
		"Weak",
		"Mediocre",
		"Decent",
		"Good",
		"Great",
		"Excellent",
		"Must Watch",
	];

	const getColorForIndex = (index: Score | null) => {
		const hovered = index && hoveredScore && index <= hoveredScore;
		const scored = index && !hoveredScore && score && index <= score;

		if ((hovered || scored) && !clearedScore) {
			const vibeColorIndex = (hoveredScore || score || -1) * 10;
			return `bg-vibe-${vibeColorIndex}`;
		}
		return "bg-gray-600";
	};

	const getLabelText = () => {
		if (score !== clearedScore || hoveredScore !== clearedScore) {
			if (hoveredScore) return `${scoreLabels[hoveredScore]} (${hoveredScore})`;
			if (score) return `${scoreLabels[score]} (${score})`;
		}
		return scoreLabels[0];
	};

	const handlePointerEnter = (index: Score | null) => {
		setHoveredScore(index);
	};

	const handlePointerLeave = (index: Score | null) => {
		setHoveredScore(score);
		setClearedScore(null);
	};

	const handleClick = (index: Score | null) => {
		setScore((previousScore) => {
			const clearingScore = previousScore == index;
			if (clearingScore) {
				setClearedScore(index);
				return null;
			}

			return index;
		});
	};

	return (
		<div className="divide-y divide-gray-600 py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow">
			<div className="px-6 py-2">
				<span className="flex gap-2">
					Your score:
					<span className="font-semibold">{getLabelText()}</span>
				</span>
			</div>
			<div className="flex px-4 transition duration-150 ease-in-out">
				{Array.from({ length: 10 }, (_, i) => {
					const scoreIndex = (i + 1) as Score;
					return (
						<ScoreAction
							details={details}
							score={scoreIndex !== score ? scoreIndex : null}
							key={i + 1}
						>
							<div
								className="w-full py-4 md:py-6 transition duration-200 ease-in-out transform origin-50 hover:scale-y-125 cursor-pointer"
								onMouseEnter={() => handlePointerEnter(scoreIndex)}
								onMouseLeave={() => handlePointerLeave(scoreIndex)}
								onTouchStart={() => handlePointerEnter(scoreIndex)}
								onTouchEnd={() => handlePointerLeave(scoreIndex)}
								onClick={() => handleClick(scoreIndex)}
							>
								<div
									className={`h-6 w-full border-2 border-gray-800 rounded-md ${getColorForIndex(scoreIndex)}`}
								/>
							</div>
						</ScoreAction>
					);
				})}
			</div>
		</div>
	);
}
