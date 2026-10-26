/** A title mark's own write, before any read-back can see another tab's change. */
export type TitleMark = "score" | "want_to_see" | "not_interested"
export interface WrittenTitleMark {
	value: number | boolean | null
	updatedAt: string | null
}
export type TitleMarksWritten = Partial<Record<TitleMark, WrittenTitleMark>>
