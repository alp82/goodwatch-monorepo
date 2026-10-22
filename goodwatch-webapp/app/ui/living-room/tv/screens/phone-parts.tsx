// Parts the phone's fixed screens share (480 x 270 canvas, nothing scrolls): the Expand key stacked in a narrow
// column.
import { Item, useTvView } from "../kit"

/** The Expand key's motif, as kit.tsx draws it: a small picture in its four brackets. */
const MOTIF = { w: 44, h: 32, arm: 9 }

/**
 * The Expand key in a narrow column: its motif over its words, which may take two lines. Where a row has no room
 * for the key's one-line form (kit.tsx, `Expand`). Same item, same look, same label for a screen reader.
 */
export function ExpandStack({ className = "" }: { className?: string }) {
	const { expands, expandLabel } = useTvView()
	const words = expandLabel ?? "Expand"
	return (
		<Item
			id="expand"
			label={expands ? `${words}: opens ${expands} on GoodWatch` : words}
			className={`tvc-x flex flex-col items-center justify-center gap-1.5 rounded-[18px] px-2 text-center text-[18px] leading-tight ${className}`}
		>
			<span className="relative block shrink-0" style={{ width: MOTIF.w, height: MOTIF.h }}>
				<span className="absolute inset-[30%] rounded-[3px] bg-current opacity-75" />
				{[0, 1, 2, 3].map((corner) => (
					<i
						key={corner}
						className="tvc-x-arm"
						data-corner={corner}
						style={{ width: MOTIF.arm, height: MOTIF.arm }}
					/>
				))}
			</span>
			<span>{words}</span>
		</Item>
	)
}
