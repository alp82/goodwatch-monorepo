// The person's own control of one title, the same wherever a title is shown in full: the Seen and score box
// (SeenScore), then Want to See and Not interested in one row. The title page has it in its You block
// (ui/details/YouBlock.tsx), and the quick view (ui/quick-view) has it as its footer.
//
// - On the title page (`place="page"`) the box is taller from lg up and answers the page's own events, and a member
//   with episode tracking gets the show's status line and tracking actions around the row (ui/tracking/gate.tsx).
// - In the quick view the score picker and its questions open above the view (`layer`), and the row is the plain one;
//   a tracked show's toasts (Undo, Set a date) and its date dialog are hosted by the box (SeenScore), for the show the
//   view shows.
//
// Not interested answers with a toast that can take it back; the button stays pressed while the title is hidden. The
// toast is fetched when the pointer, the keyboard focus, or a finger reaches the row, so it is there by the press.
import { TrackedTitleActions, useEpisodeTracking } from "~/ui/tracking/gate"
import SeenScore, { type ControlMedia, type TitleChange } from "./SeenScore"
import { TitleActionSet } from "./TitleActionSet"
import { useUndoToast, warmUndoToast } from "./useUndoToast"

export type { ControlMedia, TitleChange }

/** The Seen and score box and the row under it, as two children of the caller's own column. */
export function TitleControl({
	media,
	place = "page",
	layer,
	onChange,
}: {
	media: ControlMedia
	place?: "page" | "view"
	/** The score picker's stacking layer, for a surface that is itself an overlay. */
	layer?: string
	onChange?: (change: TitleChange) => void
}) {
	return (
		<>
			<SeenScore
				media={media}
				className="w-full"
				onPage={place === "page"}
				layer={layer}
				onChange={onChange}
			/>
			<TitleRow
				media={media}
				page={place === "page"}
				onWant={(on) => onChange?.(on ? "want" : "unwant")}
			/>
		</>
	)
}

/** Want to See and Not interested in one row; on the title page, inside a tracked show's tracking block. */
function TitleRow({
	media,
	page,
	onWant,
}: {
	media: ControlMedia
	page: boolean
	onWant: (on: boolean) => void
}) {
	const toast = useUndoToast()
	// A member with episode tracking gets the status line and the tracking actions in place of this row on the title
	// page, once their code is there.
	const tracking = useEpisodeTracking(media) && page
	const actions = (
		<TitleActionSet
			media={media}
			layout="row"
			onWant={onWant}
			onHide={(undo) =>
				toast.say(
					`${media.details.title} is hidden from your recommendations`,
					undo,
				)
			}
		/>
	)
	return (
		<div
			data-your-title
			onPointerEnter={warmUndoToast}
			onPointerDown={warmUndoToast}
			onFocus={warmUndoToast}
		>
			{tracking ? (
				<TrackedTitleActions media={media}>{actions}</TrackedTitleActions>
			) : (
				actions
			)}
			{toast.node}
		</div>
	)
}
