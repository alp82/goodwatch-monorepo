import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TitleActionSet } from "~/ui/title-actions/TitleActionSet"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"

// The title actions on the title page: the score control, then Want to See, Seen, and Not interested. Not interested
// answers with a toast that can take it back; the button stays pressed while the title is hidden. The toast is fetched
// when the pointer, the keyboard focus, or a finger reaches the actions, so it is there by the press.
export default function ListActions({ media }: { media: MovieResult | ShowResult }) {
	const toast = useUndoToast()
	return (
		<div onPointerEnter={warmUndoToast} onPointerDown={warmUndoToast} onFocus={warmUndoToast}>
			<TitleActionSet
				media={media}
				onHide={(undo) => toast.say(`${media.details.title} is hidden from your recommendations`, undo)}
			/>
			{toast.node}
		</div>
	)
}
