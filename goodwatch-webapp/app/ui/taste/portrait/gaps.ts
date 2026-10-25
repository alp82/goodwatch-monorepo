// Where you part ways: the server's genre and trait gaps (everyone.server.ts picks, folds TV genres and evens the two
// lists), named for display on one scale. Pure, for the Taste page's You vs everyone.

/** A gap as the everyone view gives it: a genre name or a fingerprint key, the gap on the 1 to 10 scale. */
export interface Gap {
	id: string
	name: string
	delta: number
}

export interface GapRow {
	id: string
	label: string
	emoji?: string
	delta: number
}

/** Genres by name, traits by their fingerprint label and emoji, and the largest gap shown, for one scale across both. */
export function gapRows(
	groups: { genres: Gap[]; traits: Gap[] },
	attribute: (key: string) => { label: string; emoji: string } | null,
) {
	const genres: GapRow[] = groups.genres.map((g) => ({
		id: g.id,
		label: g.name,
		delta: g.delta,
	}))
	const traits: GapRow[] = groups.traits.map((g) => {
		const a = attribute(g.id)
		return {
			id: g.id,
			label: a?.label ?? g.name,
			emoji: a?.emoji,
			delta: g.delta,
		}
	})
	const max = Math.max(
		0.1,
		...[...genres, ...traits].map((g) => Math.abs(g.delta)),
	)
	return { genres, traits, max }
}
