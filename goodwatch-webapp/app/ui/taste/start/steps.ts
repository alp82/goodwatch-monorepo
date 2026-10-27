// The three steps of a member's Taste start, and what the page says at each: bring your history, rate a few, your
// taste. Kept free of React so the wording can be tested.
import { LIKED_FROM, MIN_LIKED } from "../../../domain/taste-rules.ts"

export type StartStep = 1 | 2 | 3

export const STEP_LABELS: Record<StartStep, string> = {
	1: "Bring your history",
	2: "Rate a few",
	3: "Your taste",
}

/**
 * Liked titles before the taste is asked for, and the lowest liked score: the server's rule (~/domain/taste-rules),
 * shared with the rating flow. The server may want a few more to find groups.
 */
export const GOAL = MIN_LIKED
export const LIKED = LIKED_FROM

export interface StartState {
	step: StartStep
	liked: number
	/** The source the member picked or whose file they dropped. */
	source?: { name: string; connect?: boolean }
	/** A finished import's source, this visit or earlier. */
	importedFrom?: string
	/** The member's file is with its source's import. */
	file?: boolean
	/** The server found no groups yet when asked. */
	short?: boolean
}

export function startWords(s: StartState): { title: string; text: string } {
	if (s.step === 1) {
		if (s.source)
			return {
				title: `Bring your ${s.source.name} library`,
				text: s.file
					? "Check what GoodWatch found, then import it. Nothing changes before you do."
					: s.source.connect
						? `Connect ${s.source.name} once. GoodWatch shows what it found before anything changes.`
						: "Get the file, then drop it here. GoodWatch reads it on your device first.",
			}
		return {
			title: "Where do you keep track of what you watch?",
			text: "Bring it along and GoodWatch knows your taste right away. Nothing changes until you check it.",
		}
	}
	if (s.step === 2) {
		const left = Math.max(GOAL - s.liked, 0)
		return {
			title:
				s.short || left === 0
					? "Almost there. A few more you liked."
					: s.liked === 0
						? "What have you loved watching?"
						: `${left} more you liked.`,
			text: s.short
				? "GoodWatch needs a few more titles you liked to find what they share."
				: `Rate ${GOAL} titles you liked. GoodWatch groups what they share and finds more like them.`,
		}
	}
	return {
		title: "Your taste is ready.",
		text: `Built from ${s.liked.toLocaleString("en-US")} ${s.liked === 1 ? "title" : "titles"} you liked. GoodWatch grouped what they share.`,
	}
}

/** The line under each step's label. */
export function stepNote(n: StartStep, s: StartState): string {
	if (n === 1)
		return s.importedFrom ? `${s.importedFrom} imported` : "Optional · fastest"
	if (n === 2) return `${Math.min(s.liked, GOAL)} of ${GOAL} liked`
	return s.liked >= GOAL ? "Ready" : ""
}

/** How far the line between the steps is filled: 0, 1, or 2 of its two parts. */
export function stepsReached(s: StartState): 0 | 1 | 2 {
	if (s.step === 3 || s.liked >= GOAL) return 2
	if (s.step === 2 || s.importedFrom) return 1
	return 0
}
