// Fixed words about the taste fingerprint that browser and server code share: the craft attributes (how well a title
// is made, which says little about taste since most loved titles are well made), the five families' names, and the
// kinds of title the profile counts. Browser-safe.
// The same craft set is CRAFT_KEYS in server/taste/taste.server.ts and the same family names are NAMES in
// server/taste-portrait/families.server.ts; server code can import these instead.
import type { FamilyId } from "~/server/taste-portrait/view"

export const CRAFT_KEYS: ReadonlySet<string> = new Set([
	"direction",
	"acting",
	"cinematography",
	"editing",
	"music_composition",
	"dialogue_quality",
	"narrative_structure",
	"rewatchability",
])

export const FAMILY_NAMES: Record<FamilyId, { name: string; line: string }> = {
	feel: { name: "Feel", line: "How it makes you feel" },
	humor: { name: "Humor", line: "What makes you laugh" },
	world: { name: "World", line: "What it's about" },
	story: { name: "Story", line: "How it's told" },
	craft: { name: "Craft", line: "How it looks and sounds" },
}

/** What the profile counts a title as: anime is counted apart from movies and shows. */
export type TitleKind = "movie" | "show" | "anime"
