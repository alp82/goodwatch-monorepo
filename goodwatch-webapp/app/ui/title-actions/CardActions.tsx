// The title actions of a poster card, loaded on demand by TitleActionsFrame: the hover row (Want to See, then Seen
// and the score side by side, then Not interested), the score popover, the phone sheet, and the "Hidden" tile.
// Marking a title Seen from the row opens the score popover (useTitleActions asks for it).
import { type RefObject, useContext, useEffect, useRef } from "react"
import UserAction from "~/ui/auth/UserAction"
import TitleScoreDialog from "~/ui/scoring/TitleScoreDialog"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { ActionButton, ScoreButton } from "./ActionButton"
import { TitleActionSet } from "./TitleActionSet"
import type { ActionsPlacement, OpenActions } from "./TitleActionsFrame"
import { HideFeedbackContext } from "./hide-feedback"
import { SEEN_INSTRUCTIONS, SEEN_SO_NOT_HIDEABLE, useTitleActions } from "./useTitleActions"

const ROW_AT: Record<ActionsPlacement, string> = {
	bottom: "bottom-2.5",
	raised: "bottom-14",
	top: "top-2.5",
}
export default function CardActions({
	media,
	frame,
	placement,
	touch,
	open,
	setOpen,
	tile,
	setTile,
}: {
	media: ScoredMedia
	frame: RefObject<HTMLDivElement>
	placement: ActionsPlacement
	touch: boolean
	open: OpenActions
	setOpen: (open: OpenActions) => void
	tile: boolean
	setTile: (tile: boolean) => void
}) {
	const a = useTitleActions(media)
	const scoreButton = useRef<HTMLButtonElement>(null)
	const sheetOpener = useRef<HTMLElement | null>(null)
	if (open === "sheet") sheetOpener.current = frame.current?.querySelector<HTMLElement>("[aria-haspopup=dialog]") ?? null
	const undo = useRef<() => void>(() => {})

	const feedback = useContext(HideFeedbackContext)
	const onHide = (takeBack: () => void) => {
		setOpen(null)
		if (feedback) return feedback(media, takeBack)
		undo.current = takeBack
		setTile(true)
	}
	// The tile goes when hiding failed and the mutation put the title back.
	const failed = tile && !a.hidden && !a.hidePending
	useEffect(() => {
		if (failed) setTile(false)
	}, [failed, setTile])

	if (tile)
		return (
			<div className="absolute inset-0 flex flex-col justify-center gap-2 rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/10">
				<p className="text-sm font-bold text-white">Hidden</p>
				<p className="line-clamp-3 text-xs text-gray-400">
					{media.details.title} won't show in your recommendations.
				</p>
				<button
					type="button"
					onClick={() => {
						undo.current()
						setTile(false)
					}}
					className="mt-1 cursor-pointer self-start rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-amber-300 hover:bg-white/20"
				>
					Undo
				</button>
			</div>
		)

	return (
		<>
			{!touch && (
				<div
					className={`absolute inset-x-2.5 z-20 hidden gap-1 rounded-lg bg-gray-900/90 p-1 transition-opacity can-hover:grid can-hover:grid-cols-3 ${ROW_AT[placement]} ${
						open === "score" ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
					}`}
				>
					<ActionButton
						kind="want"
						label="none"
						size="sm"
						rewatch={a.seen}
						active={a.want}
						disabled={a.wantPending}
						onClick={a.toggleWant}
					/>
					<UserAction instructions={SEEN_INSTRUCTIONS}>
						<ActionButton
							kind="seen"
							label="none"
							size="sm"
							active={a.seen}
							disabled={a.seenPending}
							{...a.seenLog}
							onClick={(event) => a.toggleSeen(event, () => setOpen("score"))}
						/>
					</UserAction>
					<ScoreButton
						ref={scoreButton}
						className="col-span-3 row-start-2"
						score={a.score}
						aria-haspopup="dialog"
						aria-expanded={open === "score"}
						onClick={() => setOpen(open === "score" ? null : "score")}
					/>
					<ActionButton
						kind="hide"
						label="none"
						size="sm"
						active={a.hidden}
						disabled={!a.canHide || a.hidePending}
						title={a.hidden ? "Not interested. Press to bring it back." : a.canHide ? "Not interested" : SEEN_SO_NOT_HIDEABLE}
						onClick={() => (a.hidden ? a.unhide() : onHide(a.hide()))}
					/>
				</div>
			)}
			{open !== null && <TitleScoreDialog
				media={media} open onClose={() => setOpen(null)}
				opener={touch ? sheetOpener : scoreButton}
				onRated={() => setOpen(null)}
				footer={open === "sheet" ? <TitleActionSet media={media} scoring={false} onHide={onHide} onOpenLog={() => setOpen(null)} /> : undefined}
			/>}
		</>
	)
}
