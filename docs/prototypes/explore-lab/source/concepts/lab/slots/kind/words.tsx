// PROTOTYPE - throwaway (prototype/explore-r5). Kind control "Three words": the plain answer, for comparison. Both is
// spelled out as a third option and the pill travels between three words.
import { Link } from "@remix-run/react"
import type { Kind } from "../../../../kit/address"
import type { SlotVariant } from "../../contract"
import type { KindProps } from "./slot"
import { Track, W, WORD, WORD_LIT, byKind, kindNotes, useShownKind, useWindow } from "./track"

const CELLS: { kind: Kind; label: string; width: number }[] = [
	{ kind: "movie", label: "Movies", width: W.movie },
	{ kind: "show", label: "Shows", width: W.show },
	{ kind: "all", label: "Both", width: W.both },
]
const TOTAL = CELLS.reduce((sum, c) => sum + c.width, 0) + W.gap * (CELLS.length - 1)
const startOf = (kind: Kind) => {
	let x = 0
	for (const c of CELLS) {
		if (c.kind === kind) return x
		x += c.width + W.gap
	}
	return 0
}

function View({ kinds }: KindProps) {
	const k = byKind(kinds)
	const shown = useShownKind(kinds)
	const cell = CELLS.find((c) => c.kind === shown) ?? CELLS[0]
	const lit = useWindow(startOf(shown), startOf(shown) + cell.width)
	return (
		<Track
			label="Movies, shows, or both"
			total={TOTAL}
			l={lit.l}
			r={lit.r}
			lit={CELLS.map((c, i) => (
				<span
					key={c.kind}
					className={WORD_LIT}
					style={{ width: c.width, marginLeft: i ? W.gap : 0 }}
				>
					{c.label}
				</span>
			))}
		>
			{CELLS.map((c, i) => (
				<Link
					key={c.kind}
					to={k[c.kind].href}
					prefetch="intent"
					aria-current={shown === c.kind ? "page" : undefined}
					aria-label={c.kind === "all" ? "Movies and shows together" : undefined}
					className={`${WORD} hover:bg-white/10`}
					style={{ width: c.width, marginLeft: i ? W.gap : 0 }}
				>
					{c.label}
				</Link>
			))}
		</Track>
	)
}

export const variant: SlotVariant<never, KindProps> = {
	id: "words",
	name: "Three words",
	what: "The plain answer: Movies, Shows, Both as three options. Nothing to discover, one more word in the row.",
	order: 4,
	View,
	notes: kindNotes,
}
