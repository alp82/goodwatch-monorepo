// PROTOTYPE (Discover lab, round 21): the tab header and its search. Every tab has the same header row (sub-tabs left,
// one search right) and the search finds things in all four tabs; the variants differ in how the results show. The
// shell does the work (lab/header/); this entry only puts the choice in the lab bar, like "layout".
import type { MoodView, SectionVariant } from "../../types"

export type HeaderKey = "a" | "b" | "c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Results in place", View: () => null },
	{ key: "b", name: "Jump to it", View: () => null },
	{ key: "c", name: "Current tab first", View: () => null },
]

/** Mood's two sub-tabs per variant: hand-picked combinations first, then the columns you combine yourself. */
export const MOOD_NAMES: Record<HeaderKey, Record<MoodView, string>> = {
	a: { mixes: "Ready mixes", choose: "Mix your own" },
	b: { mixes: "Starters", choose: "Build your own" },
	c: { mixes: "Quick picks", choose: "Feel, about, style" },
}
