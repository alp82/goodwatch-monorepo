// The contract between TasteMatch (../Compare.tsx) and the strip it renders (Strip.tsx).
import type { RefObject } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { Ready } from "./parts"

export interface TwinsProps {
	shell: ProfileShell
	/** The ready comparison (the thin case is handled before the strip renders). */
	compare: Ready
	/** Whether the expanded part ("Compare your tastes side by side") is open. */
	open: boolean
	/** Opens or closes it (also clears #compare on close). */
	toggle: () => void
	/** Attach to the strip's OUTERMOST element (the top of the first card): the header chip scrolls it to just under
	 * the sticky rows when it opens the comparison. */
	topRef: RefObject<HTMLDivElement>
	/** Reduced motion. */
	still: boolean
	/** The control's label. */
	label: string
	/** The id the expanded part must carry, for aria-controls and #compare. */
	sectionId: string
}
