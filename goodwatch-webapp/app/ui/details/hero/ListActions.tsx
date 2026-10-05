import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TitleActionSet } from "~/ui/title-actions/TitleActionSet"
import { useUndoToast } from "~/ui/title-actions/UndoToast"

// The title actions on the title page: the score control, then Want to See, Seen, and Not interested. Not interested
// answers with a toast that can take it back; the button stays pressed while the title is hidden.
export default function ListActions({ media }: { media: MovieResult | ShowResult }) {
	const toast = useUndoToast()
	return (
		<>
			<TitleActionSet
				media={media}
				onHide={(undo) => toast.say(`${media.details.title} is hidden from your recommendations`, undo)}
			/>
			{toast.node}
		</>
	)
}
