// A pick's name, apart from labels.ts so the start page's chips don't load the Watch next page's words.
import { WORD_BY_ID, groupNumber } from "~/domain/taste-picker"
import type { WatchNext } from "~/server/watch-next.server"

/** A pick's name: a taste group's ("Dark, psychological thrillers") or a word's ("Slow burn"). */
export function pickName(picker: WatchNext["picker"], id: string): string {
	const number = groupNumber(id)
	if (number !== null) return picker.groups.find((g) => g.id === id)?.name ?? ""
	return WORD_BY_ID[id]?.name ?? ""
}
