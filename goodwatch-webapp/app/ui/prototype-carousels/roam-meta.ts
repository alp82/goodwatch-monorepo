// PROTOTYPE for "Prototype native-scroll carousels on title pages", tenth round. Throwaway code: not for production.
//
// What the tenth round's forms (roam1 to roam5) and their pack share: the plain words of the ninth round's twenty
// traits, the levels at which a title "has" a trait or is "without" it, and the rule that picks a title's three
// switches. Handed to the forms as plain data, because they run as an inline script.
import { BEST_WORDS, bestTraits } from "~/ui/prototype-carousels/best-meta"

export const ROAM_NAMES: Record<string, string> = {
	roam0: "N0 Rings, round ten",
	roam1: "N1 Rings",
	roam2: "N2 Spiral",
	roam3: "N3 Open field",
	roam4: "N4 Neighborhoods",
	roam5: "N5 With, without",
}

/** A title is "with" a trait from this level up, and "without" it from that level down. */
export const ROAM_WITH = 6
export const ROAM_WITHOUT = 4

export interface RoamExtra {
	/** Per trait: its plain word and its emoji. */
	w: Record<string, [string, string]>
	hi: number
	lo: number
}

export function roamExtra(): RoamExtra {
	const w: RoamExtra["w"] = {}
	for (const [key, word, emoji] of BEST_WORDS) w[key] = [word, emoji]
	return { w, hi: ROAM_WITH, lo: ROAM_WITHOUT }
}

const WORDS = new Set(BEST_WORDS.map(([key]) => key))

/** A switch as the pack and the browser name it: the trait and what flipping it asks for ("spectacle-", "romance+"). */
export const isSwitch = (value: string) =>
	WORDS.has(value.slice(0, -1)) && (value.endsWith("+") || value.endsWith("-"))

/**
 * A title's three switches: the two traits it is strongest on, which can be turned off ("-"), and one it has
 * little of, which can be turned on ("+"). Each from another family of traits, as the ninth round chose them.
 */
export function roamSwitches(
	center: (key: string) => number,
	near: ((key: string) => number)[],
): string[] {
	return bestTraits(center, near, 3).map(
		(key) => `${key}${center(key) >= ROAM_WITH ? "-" : "+"}`,
	)
}

/** A filter as its switches in a fixed order, so that one filter has one name. */
export const filterName = (switches: string[]) =>
	[...new Set(switches.filter(isSwitch))].sort().join(",")
