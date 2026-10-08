import UserAction from "~/ui/auth/UserAction"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { ActionButton } from "./ActionButton"
import { TitleScore } from "./TitleScore"
import { SEEN_INSTRUCTIONS, SEEN_SO_NOT_HIDEABLE, useTitleActions } from "./useTitleActions"

/**
 * The whole title action set at full size: the score control, then Want to See, Seen, and Not interested. The title
 * page and the phone sheet of a poster card show it.
 */
export function TitleActionSet({
	media,
	onHide,
	onOpenLog,
}: {
	media: ScoredMedia
	/** After Not interested was turned on; `undo` takes it back. */
	onHide?: (undo: () => void) => void
	/** The Seen button is about to open the movie's watch log: a sheet that holds this set makes room for it. */
	onOpenLog?: () => void
}) {
	const a = useTitleActions(media)
	return (
		<div className="@container">
			<TitleScore media={media} />
			<div className="mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-3">
				<ActionButton kind="want" label="long" active={a.want} disabled={a.wantPending} onClick={a.toggleWant} />
				<UserAction instructions={SEEN_INSTRUCTIONS}>
					<ActionButton
						kind="seen"
						label="long"
						active={a.seen}
						disabled={a.seenPending}
						{...a.seenLog}
						onClick={(event) => {
							a.toggleSeen(event)
							if (a.seenLog?.opensLog) onOpenLog?.()
						}}
					/>
				</UserAction>
				<ActionButton
					kind="hide"
					label="long"
					className="col-span-2 @lg:col-span-1"
					active={a.hidden}
					disabled={!a.canHide || a.hidePending}
					title={
						a.hidden
							? "Hidden from your recommendations. Press to bring it back."
							: a.canHide
								? "Hide it from your recommendations"
								: SEEN_SO_NOT_HIDEABLE
					}
					onClick={() => {
						if (a.hidden) a.unhide()
						else onHide ? onHide(a.hide()) : a.hide()
					}}
				/>
			</div>
		</div>
	)
}
