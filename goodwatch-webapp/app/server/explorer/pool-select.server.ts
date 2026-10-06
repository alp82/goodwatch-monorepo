// Which snapshot rows make the Explorer's pool: the most voted movies and shows with a poster and a backdrop. It reads
// the snapshot's columns only. A facts object per row (238,000 of them) blocked the event loop for 500 to 850 ms after
// every snapshot reload.
import { FLAG_BACKDROP } from "~/server/title-snapshot/format.server"
import { FLAG_ADULT, FLAG_POSTER } from "~/server/title-snapshot/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"

const POOL = {
	movie: { minVotes: 800, size: 9000 },
	show: { minVotes: 200, size: 3000 },
}

/** Selects pool rows by votes descending, then snapshot row ascending, without creating title facts. */
export function selectCandidateRows(snapshot: TitleSnapshot): {
	movie: number[]
	show: number[]
} {
	const { pointIds, flags, votes } = snapshot.columns
	const found = { movie: [] as number[], show: [] as number[] }
	const images = FLAG_POSTER | FLAG_BACKDROP
	for (let row = 0; row < pointIds.length; row++) {
		const mediaType = pointIds[row] >= 2e12 ? "show" : "movie"
		if (
			(flags[row] & images) === images &&
			(flags[row] & FLAG_ADULT) === 0 &&
			votes[row] >= POOL[mediaType].minVotes
		)
			found[mediaType].push(row)
	}
	const top = (list: number[], size: number) =>
		list.sort((a, b) => votes[b] - votes[a] || a - b).slice(0, size)
	return {
		movie: top(found.movie, POOL.movie.size),
		show: top(found.show, POOL.show.size),
	}
}
