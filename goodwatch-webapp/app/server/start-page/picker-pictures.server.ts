// The start page mood picker's tile pictures: a backdrop per mix and per word (mood, theme, style), none repeated.
//
// Each choice shows the most popular start title candidate (living-room/pool-keys: well rated, voted on, released)
// that has a backdrop and the choice: every part of a mix, or the word. Mixes go first, as the picker shows them
// first, then the words in the picker's order; a backdrop no earlier tile uses where one is left. Nothing about a
// viewer, so the answer is the same for everyone and kept per snapshot version and day. The browser asks for it once,
// when the picker first opens (routes/api.start-picker-pictures.ts), so the page's HTML doesn't carry it.
import {
	WORDS,
	WORD_BY_ID,
	type WordMasks,
	hasWord,
} from "~/domain/taste-picker"
import { poolCandidates } from "~/server/living-room/pool-keys.server"
import type { TitleDisplay } from "~/server/title-cards.server"
import { FLAG_BACKDROP } from "~/server/title-snapshot/format.server"
import type { TitleSnapshot } from "~/server/title-snapshot/snapshot.server"
import { MIXES } from "~/ui/start/moods/mixes"

export type PickerPictures = Record<string, string>

/** How far down the candidates a choice looks before it takes a backdrop an earlier tile uses. */
const LOOK = 400

type Snapshot = Pick<
	TitleSnapshot,
	"version" | "forEach" | "factsAt" | "rowOf" | "columns"
>

/** The choice ids in tile order and the title keys that show them. */
export function pickPictureKeys(
	candidates: readonly { key: number; masks: WordMasks }[],
): Map<string, number> {
	const choices = [
		...MIXES.map((mix) => ({
			id: mix.id,
			words: mix.parts.map((id) => WORD_BY_ID[id]),
		})),
		...WORDS.map((word) => ({ id: word.id, words: [word] })),
	]
	const used = new Set<number>()
	const out = new Map<string, number>()
	for (const choice of choices) {
		const fits = (masks: WordMasks) =>
			choice.words.every((word) => word && hasWord(masks, word))
		let first: number | null = null
		let pick: number | null = null
		for (let i = 0, seen = 0; i < candidates.length && seen < LOOK; i++) {
			const candidate = candidates[i]
			if (!fits(candidate.masks)) continue
			seen++
			first ??= candidate.key
			if (!used.has(candidate.key)) {
				pick = candidate.key
				break
			}
		}
		pick ??= first
		if (pick === null) continue
		used.add(pick)
		out.set(choice.id, pick)
	}
	return out
}

let memo: { version: string; today: number; pictures: PickerPictures } | null =
	null

/** The pictures by choice id ("g1", "m:funny", "t:war"): a TMDB backdrop path. Choices with none are left out. */
export async function loadPickerPictures(
	snapshot: Snapshot | null,
	displayFields: (keys: number[]) => Promise<Map<number, TitleDisplay>>,
	today = Math.floor(Date.now() / 86_400_000),
): Promise<PickerPictures | null> {
	if (!snapshot) return null
	if (memo?.version === snapshot.version && memo.today === today)
		return memo.pictures
	const { columns } = snapshot
	const candidates = poolCandidates(snapshot, today).all.flatMap(({ key }) => {
		const row = snapshot.rowOf(key)
		if (row < 0 || (columns.flags[row] & FLAG_BACKDROP) === 0) return []
		return [
			{
				key,
				masks: {
					moods: columns.moods[row],
					themes: columns.themes[row],
					styles: columns.styles[row],
				},
			},
		]
	})
	const keys = pickPictureKeys(candidates)
	const displays = await displayFields([...new Set(keys.values())])
	const pictures: PickerPictures = {}
	for (const [id, key] of keys) {
		const path = displays.get(key)?.backdrop_path
		if (path) pictures[id] = path
	}
	memo = { version: snapshot.version, today, pictures }
	return pictures
}
