// PROTOTYPE - throwaway (prototype/explore-r5). The card bench's data: real cards of every family, and the identity
// data the variants draw from. Address: /prototype/explore/_kit?bench=cards (&v=identity,peek &f=mood,genre).
import type { Family } from "../../../../kit/address"
import type { LoadArgs } from "../../../../kit/contract"
import type { CardData } from "../../../../kit/types"
import { cardData } from "../../cards.server"
import { type Marks, marksOf } from "./marks.server"

export interface BenchData {
	bench: "cards"
	marks: Marks
	only: string[]
	families: { family: Family; label: string; cards: CardData[] }[]
}

const SETS: { family: Family; label: string; n?: number }[] = [
	{ family: "mood", label: "Moods" },
	{ family: "genre", label: "Genres", n: 8 },
	{ family: "decade", label: "Decades" },
	{ family: "country", label: "Countries", n: 12 },
	{ family: "service", label: "Services", n: 8 },
	{ family: "theme", label: "Themes", n: 4 },
	{ family: "style", label: "Styles", n: 4 },
]

export async function loadBench({ kit, url }: LoadArgs): Promise<BenchData> {
	const wanted = (url.searchParams.get("f") ?? "").split(",").filter(Boolean)
	const families: BenchData["families"] = []
	for (const set of SETS) {
		if (wanted.length && !wanted.includes(set.family)) continue
		families.push({
			family: set.family,
			label: set.label,
			cards: await cardData(kit, set.family, { n: set.n, titles: 4 }),
		})
	}
	return {
		bench: "cards",
		marks: await marksOf(kit),
		only: (url.searchParams.get("v") ?? "").split(",").filter(Boolean),
		families,
	}
}
