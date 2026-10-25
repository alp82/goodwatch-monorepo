// Which parts of the score pill show, as class names: "hidden" for never, "" for always, else container-query classes
// that switch with the poster card's width. Pure, so it is tested without the app.
import type { CardSize, PartSize } from "./size"

/** The GoodWatch logo in its block, fixed sizes: on L, and on M from an 8rem card. */
const LOGO: Record<CardSize, string> = {
	S: "hidden",
	M: "hidden h-3 @min-[8rem]/card:inline",
	L: "h-3.5",
}

export interface PillParts {
	gw: string
	/** The state icon and its hairline. */
	mark: string
	/** "you" before the viewer's number. */
	label: string
	logo: string
	/** The pill itself. */
	pill: string
}

/**
 * A fixed size shows every part (S: one number, no icon). In a card ("auto"), with the viewer's score GoodWatch's
 * number shows only from 11rem and the icon never; without it the icon shows from 7.5rem; "you" is read out but not
 * shown under 6.5rem; the logo only beside a lone GoodWatch number, from 8rem.
 */
export function pillParts(
	size: PartSize,
	scored: boolean,
	hasGw: boolean,
	mark: boolean,
): PillParts {
	if (size !== "auto") {
		const fromM = size === "S" ? "hidden" : ""
		return {
			gw: scored ? fromM : "",
			mark: fromM,
			label: "",
			logo: LOGO[size],
			pill: "",
		}
	}
	return {
		gw: scored ? "hidden @min-[11rem]/card:inline-flex" : "",
		mark: scored ? "hidden" : "hidden @min-[7.5rem]/card:inline-flex",
		label: "sr-only @min-[6.5rem]/card:not-sr-only",
		logo: !scored && !mark ? "hidden h-3 @min-[8rem]/card:inline" : "hidden",
		// Only a state icon, which a card under 7.5rem leaves out: no pill there.
		pill: !scored && !hasGw ? "hidden @min-[7.5rem]/card:inline-flex" : "",
	}
}
