// The start page's search bar words: the six presets under the field and the field's own lines.
//
// A preset fills the field with its exact phrase and searches it like typed text; nothing is precomputed. The phrases
// are lower case without hyphens, as a person would type them, and the placeholder repeats none of them.

/** The presets, in the order the bar shows them. */
export const START_PRESETS = [
	"cheer me up",
	"rainy day whodunit",
	"severance but funny",
	"twist ending",
	"space adventure",
	"grown up cartoons",
] as const

/** The placeholder from 640 px wide, which the server renders. */
export const PLACEHOLDER_WIDE = "Describe a mood, a plot, or a title…"
/** The placeholder on phones, set after hydration (a placeholder change moves nothing). */
export const PLACEHOLDER_NARROW = "Mood, plot, title…"

/** The input's label. */
export const SEARCH_LABEL = "Search by mood, plot, or title"
