import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TitleActionSet } from "~/ui/title-actions/TitleActionSet"
import { TrackedTitleActions, useEpisodeTracking } from "~/ui/tracking/gate"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"

// The title actions on the title page, the hero's "your show" or "your movie" block: Want to See, Seen, and Not
// interested in one row. The score has its own place in the hero's ratings (OwnScore). Not interested answers with a
// toast that can take it back; the button stays pressed while the title is hidden. The toast is fetched when the
// pointer, the keyboard focus, or a finger reaches the actions, so it is there by the press.
export default function ListActions({ media }: { media: MovieResult | ShowResult }) {
	const toast = useUndoToast()
	// A member with episode tracking gets the status line and the tracking actions in place of this row, once their
	// code is there (ui/tracking/gate.tsx).
	const tracking = useEpisodeTracking(media)
	const actions = (
		<TitleActionSet
			media={media}
			layout="row"
			onHide={(undo) => toast.say(`${media.details.title} is hidden from your recommendations`, undo)}
		/>
	)
	return (
		<div data-your-title onPointerEnter={warmUndoToast} onPointerDown={warmUndoToast} onFocus={warmUndoToast}>
			{tracking ? <TrackedTitleActions media={media}>{actions}</TrackedTitleActions> : actions}
			{toast.node}
		</div>
	)
}
