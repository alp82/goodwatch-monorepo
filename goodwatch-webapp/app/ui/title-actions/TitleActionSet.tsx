import UserAction from "~/ui/auth/UserAction"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { ActionButton } from "./ActionButton"
import { TitleScore } from "./TitleScore"
import { SEEN_INSTRUCTIONS, SEEN_SO_NOT_HIDEABLE, useTitleActions } from "./useTitleActions"

/**
 * The whole title action set at full size: the score control, then Want to See, Seen, and Not interested. The
 * phone sheet of a poster card shows it.
 *
 * `layout="row"` is the title page's: the three buttons alone in one row that they fill, 36px high. The score has
 * its own place there, in the hero's ratings. On a phone Not interested is its icon alone, and it is left out
 * for a title that can't be hidden (one the person has seen or scored).
 */
export function TitleActionSet({
	media,
	onHide,
	onOpenLog,
	layout = "sheet",
}: {
	media: ScoredMedia
	layout?: "sheet" | "row"
	/** After Not interested was turned on; `undo` takes it back. */
	onHide?: (undo: () => void) => void
	/** The Seen button is about to open the movie's watch log: a sheet that holds this set makes room for it. */
	onOpenLog?: () => void
}) {
	const a = useTitleActions(media)
	const hideTitle = a.hidden
		? "Hidden from your recommendations. Press to bring it back."
		: a.canHide
			? "Hide it from your recommendations"
			: SEEN_SO_NOT_HIDEABLE
	const pressHide = () => {
		if (a.hidden) a.unhide()
		else onHide ? onHide(a.hide()) : a.hide()
	}
	if (layout === "row")
		return (
			<div data-title-actions className="flex min-w-0 gap-2">
				<ActionButton kind="want" label="long" size="sm" className="flex-1" rewatch={a.seen} active={a.want} disabled={a.wantPending} onClick={a.toggleWant} />
				<UserAction instructions={SEEN_INSTRUCTIONS}>
					<ActionButton
						kind="seen"
						label="long"
						size="sm"
						className="flex-1"
						active={a.seen}
						disabled={a.seenPending}
						{...a.seenLog}
						onClick={(event) => {
							a.toggleSeen(event)
							if (a.seenLog?.opensLog) onOpenLog?.()
						}}
					/>
				</UserAction>
				{(a.canHide || a.hidden) && (
					<ActionButton kind="hide" label="wide" size="sm" className="max-sm:w-9 max-sm:flex-none sm:flex-1" active={a.hidden} disabled={a.hidePending} title={hideTitle} onClick={pressHide} />
				)}
			</div>
		)
	return (
		<div className="@container">
			<TitleScore media={media} />
			<div className="mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-3">
				<ActionButton kind="want" label="long" rewatch={a.seen} active={a.want} disabled={a.wantPending} onClick={a.toggleWant} />
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
					title={hideTitle}
					onClick={pressHide}
				/>
			</div>
		</div>
	)
}
