// Read across from lighter to darker, and down from calmer to more intense.
const rows = [
	["cozy", "romantic", "growing-up", "deep"],
	["funny", "quirky", "sad", "dark"],
	["magical", "trippy", "mysterious", "tense"],
	["adventurous", "otherworldly", "thrilling", "scary"],
]

export function moodGrid<T extends { place: { slug: string } }>(moods: readonly T[], cols: number) {
	const bySlug = new Map(moods.map((mood) => [mood.place.slug, mood]))
	return rows.flat().flatMap((slug, i) => {
		const mood = bySlug.get(slug)
		return mood ? [{ mood, row: Math.floor(i / cols), col: i % cols }] : []
	})
}
