// Quick list's own words. Everything the rating flow also says comes from its words (rating-flow/words.ts), so the
// same thing has the same name in both modes.
import { answerWords } from "../rating-flow/flow.ts"
import type { QuickAnswer } from "./model.ts"

export const QUICK_WORDS = {
	mode: "Rating mode",
	oneAtATime: "One at a time",
	quick: "Quick list",
	yourScores: "Your scores",
	head: "Titles you haven't rated",
	line: "Score what you've seen. Mark the rest Haven't seen it.",
	search: "Search all titles",
	searching: "Searching…",
	searchUnavailable: "Search isn't available right now. Try again in a moment.",
	noResults: "No titles match this search.",
	noMatch: "Nothing unrated matches these filters.",
	lookFurther: "Look further",
	title: "Title",
	year: "Year",
	selectRow: (title: string) => `Select ${title}`,
	selectAll: "Select all unanswered rows",
	selected: (n: number) => `${n} selected`,
	scoreAs: (n: number) => `Score ${n} as`,
	clearSelection: "Clear selection",
	stillSaving: (n: number) => `${n === 1 ? "1 title was" : `${n} titles were`} still saving; try ${n === 1 ? "it" : "them"} again.`,
	undo: "Undo",
	cleared: "Score cleared",
	titles: (n: number) => `${n} titles`,
	saveFailed: (title: string) => `Couldn't save ${title}. Try again.`,
	undoFailed: (title: string) => `Couldn't undo ${title}. Try again.`,
} as const

/** An answer in a few words, the rating flow's: "Scored 8", "Haven't seen it", "Want to See", "Not interested". */
export const answerLabel = (a: QuickAnswer | null) => (a ? answerWords(a) : QUICK_WORDS.cleared)
