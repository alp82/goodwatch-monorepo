// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// The play forms with their short names. Apart from play-forms.ts, so that the title route's script gets the names
// without the forms. Eighth round: the scrub forms (scrub-meta.ts) are play forms too, and the floating bar shows
// the seventh round's scrub strip next to them.
import { BEST_NAMES } from "~/ui/prototype-carousels/best-meta"
import { RING_NAMES } from "~/ui/prototype-carousels/rings-meta"
import { ROAM_NAMES } from "~/ui/prototype-carousels/roam-meta"
import { SCRUB_NAMES } from "~/ui/prototype-carousels/scrub-meta"

export const PLAY_NAMES: Record<string, string> = {
	play1: "P1 Six ways, fast",
	play2: "P2 Horizon",
	play3: "P3 Honeycomb",
	play4: "P4 Trait mixer",
	play5: "P5 Fingerprint hub",
	play6: "P6 Diff tiles",
	play7: "P7 Trait lens",
	play8: "P8 Scrub",
	play9: "P9 Blend",
	play10: "P10 Pick a path",
	...SCRUB_NAMES,
	...BEST_NAMES,
	...ROAM_NAMES,
	...RING_NAMES,
}
