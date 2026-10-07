import { useUserScore } from "~/hooks/useUserDataAccessors"
import { type ScoredMedia, useScoreAction } from "~/ui/user/actions/ScoreAction"
import { ScoreControl, type ScoreControlProps } from "./ScoreControl"

/** The score control for one title: shows the person's score, saves a new one, and clears it. */
export function TitleScore({
	media,
	size,
	onRated,
}: {
	media: ScoredMedia
	size?: ScoreControlProps["size"]
	/** After a score was sent (not after clearing, and not when a guest hit the rating limit). */
	onRated?: () => void
}) {
	const value = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const { rate, isPending } = useScoreAction(media)
	return (
		<ScoreControl
			value={value}
			size={size}
			busy={isPending}
			onRate={(score) => {
				if (rate(score)) onRated?.()
			}}
			onClear={() => rate(null)}
		/>
	)
}
