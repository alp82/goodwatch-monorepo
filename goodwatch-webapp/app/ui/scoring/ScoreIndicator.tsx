
import { Score } from "~/server/scores.server"
import { scoreLabels, getVibeColorValue } from "~/utils/ratings"

interface ScoreIndicatorProps {
    score: Score
}

const ScoreIndicator = ({ score }: ScoreIndicatorProps) => {
    return (
        <div className="w-36 h-36 px-6 py-6 rounded-full bg-black/80 backdrop-blur-sm text-center">
            <div
                className="mb-0.5"
                style={{ color: getVibeColorValue(score) }}
            >
                {scoreLabels[score]}
            </div>
            <div
                className="text-5xl font-bold"
                style={{ color: getVibeColorValue(score) }}
            >
                {score}
            </div>
            <div className="text-xs text-gray-300 mt-1">/ 10</div>
        </div>
    )
}

export default ScoreIndicator