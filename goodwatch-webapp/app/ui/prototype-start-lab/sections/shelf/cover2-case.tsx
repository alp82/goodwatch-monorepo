// PROTOTYPE (start page lab): h "Covers in a case": g, plus a drawn Blu-ray case over each cover: a thin clear plastic
// rim with a faint highlight and the blue header band (8% of the cover, no text or logo), for scenes whose painted
// case is weak.
import type { SlotProps } from "../../lab/types"
import { CoverSlot2 } from "./cover2"

export function CasedCoverSlot(props: SlotProps) {
	return <CoverSlot2 {...props} cased />
}
