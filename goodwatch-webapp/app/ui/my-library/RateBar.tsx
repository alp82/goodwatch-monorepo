import { useRef } from "react"
import type { LibraryItem } from "~/server/my-library.server"
import type { Score } from "~/server/scores.server"
import ScoreDialog from "~/ui/scoring/ScoreDialog"

/** Library rows use the shared sheet/dialog; the page owns its list refresh after a score. */
export default function RateBar({
	item,
	score,
	onRated,
	onClose,
}: {
	item: LibraryItem
	score: number | null
	onRated: (item: LibraryItem, score: Score | null) => void
	onClose: () => void
}) {
	const opener = useRef<HTMLElement | null>(
		typeof document === "undefined"
			? null
			: (document.activeElement as HTMLElement),
	)
	const give = (value: Score | null) => {
		onRated(item, value)
		onClose()
	}
	return (
		<ScoreDialog
			title={item.title}
			open
			value={score as Score | null}
			busy={false}
			opener={opener}
			onRate={give}
			onClear={() => give(null)}
			onClose={onClose}
		/>
	)
}
