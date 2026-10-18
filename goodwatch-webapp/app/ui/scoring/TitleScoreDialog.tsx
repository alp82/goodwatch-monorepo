import type { ComponentProps } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import { type ScoredMedia, useScoreAction } from "~/ui/user/actions/ScoreAction"
import ScoreDialog from "./ScoreDialog"

/** Title persistence for the shared dialog; loaded only when an interaction opens it. */
export default function TitleScoreDialog({
	media,
	onRated,
	...props
}: {
	media: ScoredMedia
	onRated?: () => void
} & Omit<
	ComponentProps<typeof ScoreDialog>,
	"title" | "value" | "busy" | "onRate" | "onClear"
>) {
	const score =
		useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const { rate, isPending } = useScoreAction(media)
	return (
		<ScoreDialog
			{...props}
			title={media.details.title}
			value={score}
			busy={isPending}
			onRate={(value) => {
				if (rate(value)) onRated?.()
			}}
			onClear={() => rate(null)}
		/>
	)
}
