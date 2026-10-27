/** Public catalog shape reserved before a member's watches and tracking code arrive. */
export interface EpisodeLayout {
	seasons: { number: number; count: number }[]
	note: string | null
}

export function episodeLayoutOf(
	episodes: readonly { season: number; displaySeason?: number }[],
	note: string | null = null,
): EpisodeLayout {
	const counts = new Map<number, number>()
	for (const episode of episodes) {
		const number = episode.displaySeason ?? episode.season
		counts.set(number, (counts.get(number) ?? 0) + 1)
	}
	return {
		seasons: [...counts]
			.sort(
				([a], [b]) =>
					Number(a === 0) - Number(b === 0) ||
					Number(a < 0) - Number(b < 0) ||
					a - b,
			)
			.map(([number, count]) => ({ number, count })),
		note,
	}
}

export function sameEpisodeLayout(a: EpisodeLayout, b: EpisodeLayout): boolean {
	return (
		a.note === b.note &&
		a.seasons.length === b.seasons.length &&
		a.seasons.every(
			(season, i) =>
				season.number === b.seasons[i].number &&
				season.count === b.seasons[i].count,
		)
	)
}
