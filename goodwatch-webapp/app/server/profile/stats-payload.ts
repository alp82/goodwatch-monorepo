import type { ProfileTaste } from "~/ui/profile/taste/model"
import { agreementTitle } from "~/ui/profile/taste/agreement"
import type { TasteStats } from "~/domain/profile-taste"

/** Keep the data used by both director rankings and every interactive stats panel. */
export function statsPayload(stats: TasteStats): TasteStats {
	const previews = (people: TasteStats["people"]["directors"]) =>
		people.map((person, index) => ({
			...person,
			titles: person.titles.slice(0, index < 4 ? 5 : 1),
		}))
	const names = (people: TasteStats["people"]["actors"]) =>
		people.map((person) => ({ ...person, titles: [] }))
	return {
		...stats,
		people: {
			directors: previews(stats.people.directors),
			bestDirectors: previews(stats.people.bestDirectors),
			actors: names(stats.people.actors),
			composers: names(stats.people.composers.slice(0, 3)),
			writers: names(stats.people.writers.slice(0, 3)),
		},
	}
}

/** The profile summary uses two titles per visible taste group and the first two crowd rows each way (the summary shows both firsts and the stronger runner-up).
 * Keep the agreement winner from the full pool and retain input order so ties stay stable.
 * The full portrait remains in its owner cache for /taste and share cards.
 */
export function statsTastePayload(taste: ProfileTaste): ProfileTaste {
	const keys = new Set(
		taste.sides.list.slice(0, 3).flatMap((group) => group.here.slice(0, 2)),
	)
	const agree = agreementTitle(taste.titles)
	if (agree) keys.add(agree.key)
	for (const row of [
		...taste.crowd.higher.slice(0, 2),
		...taste.crowd.lower.slice(0, 2),
	])
		if (row) keys.add(row.key)
	return {
		...taste,
		titles: Object.fromEntries(
			Object.entries(taste.titles).filter(([key]) => keys.has(key)),
		),
	}
}
